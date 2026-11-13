import { getCloudflareContext } from "@opennextjs/cloudflare";
import { stampPdf } from "@/lib/resumes/pdf";
import { getVersion, type ResumeEnv } from "@/lib/resumes/store";

export const dynamic = "force-dynamic";

/**
 * The application's resume: the version PDF from R2 with the application's
 * key stamped into every placeholder link. Behind the Access middleware.
 * Nothing stamped is stored. 409 when the application has no key or version.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return new Response("Bad id", { status: 400 });

  try {
    const { ANALYTICS_DB: db, R2_ASSETS: bucket } = (await getCloudflareContext({ async: true })).env as unknown as ResumeEnv;
    const app = await db
      .prepare("SELECT key, resume_version_id FROM applications WHERE id = ?")
      .bind(id)
      .first<{ key: string | null; resume_version_id: string | null }>();
    if (!app) return new Response("Not found", { status: 404 });
    if (!app.key || !app.resume_version_id) return new Response("Application has no key or resume version yet.", { status: 409 });

    const version = await getVersion(db, app.resume_version_id);
    if (!version) return new Response("Resume version not found.", { status: 409 });
    const object = await bucket.get(version.r2_key);
    if (!object) return new Response("Resume PDF missing from storage.", { status: 404 });

    const { bytes } = await stampPdf(new Uint8Array(await object.arrayBuffer()), app.key);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Samuel_Baker_Resume.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/admin/applications/resume.pdf] error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
