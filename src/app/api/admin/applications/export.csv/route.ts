import { getCloudflareContext } from "@opennextjs/cloudflare";
import { applicationsCsv } from "@/lib/applications/csv";
import { type ApplicationEnv, listAllEvents, listApplications } from "@/lib/applications/store";

export const dynamic = "force-dynamic";

/** Applications plus events as CSV: the input for the model's section 6 script. Behind Access. */
export async function GET() {
  try {
    const { ANALYTICS_DB: db } = (await getCloudflareContext({ async: true })).env as unknown as ApplicationEnv;
    const [rows, events] = await Promise.all([listApplications(db), listAllEvents(db)]);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(applicationsCsv(rows, events), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="applications-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/admin/applications/export.csv] error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
