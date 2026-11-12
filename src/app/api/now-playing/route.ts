import { getCloudflareContext } from "@opennextjs/cloudflare";

type LastFmImage = { ["#text"]?: string; size?: string };
type LastFmTrack = {
  name?: string;
  url?: string;
  artist?: { ["#text"]?: string } | string;
  album?: { ["#text"]?: string } | string;
  image?: LastFmImage[];
  ["@attr"]?: { nowplaying?: string };
  date?: { uts?: string };
};

function pickLargestImage(images?: LastFmImage[]) {
  if (!images?.length) return undefined;
  const sorted = [...images].sort(
    (a, b) => (a["#text"]?.length ?? 0) - (b["#text"]?.length ?? 0)
  );
  const url = sorted[sorted.length - 1]?.["#text"];
  return url || undefined;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

interface CloudflareEnv {
  LASTFM_API_KEY?: string;
  LASTFM_USER?: string;
}

// Upstream budget per Last.fm call; the client polls every 15 s.
const UPSTREAM_TIMEOUT_MS = 4_000;

async function readSecrets(): Promise<{ apiKey?: string; user?: string }> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    if (env.LASTFM_API_KEY && env.LASTFM_USER) {
      return { apiKey: env.LASTFM_API_KEY, user: env.LASTFM_USER };
    }
  } catch {
    // No Cloudflare context (plain next start); fall through to process.env.
  }
  // Dev fallback only: .env* under next dev.
  return { apiKey: process.env.LASTFM_API_KEY, user: process.env.LASTFM_USER };
}

export async function GET() {
  const { apiKey, user } = await readSecrets();

  const cacheHeaders = {
    // Cloudflare cache (s-maxage) for 5s, allow serving stale while revalidating for 30s
    "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
  };
  // Failures must not be cached at the edge (F38).
  const errorHeaders = { "Cache-Control": "no-store" };

  if (!apiKey || !user) {
    return Response.json(
      { ok: false, error: "Missing LASTFM_API_KEY or LASTFM_USER." },
      { status: 500, headers: errorHeaders }
    );
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", user);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: { "User-Agent": "samueljbaker.dev (Last.fm now-playing)" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      return Response.json(
        { ok: false, error: `Last.fm HTTP ${res.status}` },
        { status: 502, headers: errorHeaders }
      );
    }

    const json = (await res.json()) as any;

    const track = asArray<LastFmTrack>(json?.recenttracks?.track)[0];
    if (!track?.name) {
      return Response.json(
        { ok: true, isPlaying: false },
        { status: 200, headers: cacheHeaders }
     ); 
    }

    const isPlaying = track?.["@attr"]?.nowplaying === "true";
    const title = track.name ?? "";
    const artist =
      typeof track.artist === "string"
        ? track.artist
        : track.artist?.["#text"] ?? "";
    const album =
      typeof track.album === "string" ? track.album : track.album?.["#text"] ?? "";
    const trackUrl = track.url ?? "";
    let imageUrl = pickLargestImage(track.image);

    if (!imageUrl && title && artist) {
      const infoUrl = new URL("https://ws.audioscrobbler.com/2.0/");
      infoUrl.searchParams.set("method", "track.getInfo");
      infoUrl.searchParams.set("api_key", apiKey);
      infoUrl.searchParams.set("artist", artist);
      infoUrl.searchParams.set("track", title);
      infoUrl.searchParams.set("autocorrect", "1");
      infoUrl.searchParams.set("format", "json");

      const infoRes = await fetch(infoUrl.toString(), {
        cache: "no-store",
        headers: { "User-Agent": "samueljbaker.dev (Last.fm now-playing)" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (infoRes.ok) {
        const infoJson = (await infoRes.json()) as any;
        imageUrl = pickLargestImage(infoJson?.track?.album?.image) ?? imageUrl;
      }
    }

    return Response.json(
      {
        ok: true,
        isPlaying,
        title,
        artist,
        album,
        trackUrl,
        imageUrl,
        playedAtUts: track?.date?.uts ? Number(track.date.uts) : undefined,
      },
      { status: 200, headers: cacheHeaders }
    );
  } catch {
    return Response.json(
      { ok: false, error: "Failed to reach Last.fm." },
      { status: 502, headers: errorHeaders }
    );
  }
}
