import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  isBeaconEvent,
  isValidSessionId,
  normalizePayload,
  resolveEventKey,
  type SessionLookup,
} from "@/lib/tracking/beacon";

// -- Cloudflare env type -------------------------------------------------------
interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

// -- Request body shape --------------------------------------------------------
interface BeaconBody {
  sessionId?: unknown;
  event?: unknown;
  payload?: unknown;
}

/** The session's visit_server row from D1 (idx_events_session). */
function sessionLookup(db: D1Database): SessionLookup {
  return {
    visitServerRow(sessionId) {
      return db
        .prepare("SELECT key FROM events WHERE session_id = ? AND event = 'visit_server' ORDER BY id LIMIT 1")
        .bind(sessionId)
        .first<{ key: string | null }>();
    },
  };
}

// -- POST handler --------------------------------------------------------------
export async function POST(request: NextRequest) {
  // Always return 204 regardless of outcome - beacon is fire-and-forget.
  // Errors must never surface to the visitor.
  try {
    const ctx = await getCloudflareContext();
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    // -- Parse and validate body -----------------------------------------------
    let body: BeaconBody;
    try {
      body = (await request.json()) as BeaconBody;
    } catch {
      // Malformed JSON - silently ignore
      return new NextResponse(null, { status: 204 });
    }

    const { sessionId, event, payload } = body;

    // sessionId is required - without it we can't correlate events
    if (!isValidSessionId(sessionId)) {
      return new NextResponse(null, { status: 204 });
    }

    // Only accept known event names to prevent garbage data
    if (!isBeaconEvent(event)) {
      return new NextResponse(null, { status: 204 });
    }

    // The key comes from the session's visit_server row only. Anything the
    // client sent (body key, Referer) is ignored (src/lib/tracking/beacon.ts).
    const key = await resolveEventKey(sessionLookup(db), sessionId);

    const ts = new Date().toISOString();
    const payloadJson = normalizePayload(payload);

    // -- Write event to D1 -----------------------------------------------------
    await db
      .prepare(`
        INSERT INTO events
          (session_id, key, tier, event, ts, country, city, referer, ua, cf_threat_score, has_js, payload)
        VALUES
          (?, ?, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, ?)
      `)
      .bind(sessionId, key, event, ts, payloadJson)
      .run();

    // -- Update has_js on the visit_server row for this session ----------------
    // This is the core bot-detection signal: a visit_server row with has_js=0
    // after a few seconds = likely bot or instant bounce.
    // We only do this for visit_confirmed to avoid redundant updates.
    if (event === "visit_confirmed") {
      await db
        .prepare(`
          UPDATE events
          SET has_js = 1
          WHERE session_id = ?
            AND event = 'visit_server'
            AND has_js = 0
        `)
        .bind(sessionId)
        .run();
    }
  } catch (err) {
    // Log for debugging but never expose to client
    console.error("[analytics] /api/beacon error:", err);
  }

  return new NextResponse(null, { status: 204 });
}
