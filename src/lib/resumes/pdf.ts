import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";

/**
 * Resume PDF link handling (server side only; pdf-lib never reaches a client
 * chunk). A version PDF carries the placeholder short link in at least one
 * link annotation; stamping replaces the placeholder with the application's
 * key when the PDF is downloaded, and nothing stamped is stored.
 */

export const KEY_PLACEHOLDER = "__KEY__";
export const PLACEHOLDER_URI = `https://samueljbaker.dev/v/${KEY_PLACEHOLDER}`;

interface UriAction {
  dict: PDFDict;
  uri: string;
}

/** Every Link annotation with a URI action, across all pages. */
function uriActions(pdf: PDFDocument): UriAction[] {
  const out: UriAction[] = [];
  const link = PDFName.of("Link");
  const uriName = PDFName.of("URI");
  for (const page of pdf.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const annot = pdf.context.lookup(annots.get(i));
      if (!(annot instanceof PDFDict)) continue;
      if (annot.get(PDFName.of("Subtype")) !== link) continue;
      const action = pdf.context.lookup(annot.get(PDFName.of("A")));
      if (!(action instanceof PDFDict)) continue;
      if (action.get(PDFName.of("S")) !== uriName) continue;
      const value = action.get(uriName);
      const uri = value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : null;
      if (uri !== null) out.push({ dict: action, uri });
    }
  }
  return out;
}

/** Number of link annotations whose URI is exactly the placeholder. Throws on an unreadable PDF. */
export async function countPlaceholderLinks(bytes: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  return uriActions(pdf).filter((a) => a.uri === PLACEHOLDER_URI).length;
}

/** The PDF with __KEY__ replaced by `key` in every matching link URI. */
export async function stampPdf(bytes: Uint8Array, key: string): Promise<{ bytes: Uint8Array; stamped: number }> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  let stamped = 0;
  for (const a of uriActions(pdf)) {
    if (!a.uri.includes(KEY_PLACEHOLDER)) continue;
    a.dict.set(PDFName.of("URI"), PDFString.of(a.uri.split(KEY_PLACEHOLDER).join(key)));
    stamped++;
  }
  return { bytes: await pdf.save({ useObjectStreams: false }), stamped };
}

/** All link URIs in the PDF, for evidence and tests. */
export async function listLinkUris(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  return uriActions(pdf).map((a) => a.uri);
}

/** A one-page PDF with one link annotation per URI, for tests and evidence. */
export async function makePdfWithLinks(uris: string[], text = "Samuel Baker"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  page.drawText(text, { x: 72, y: 720, size: 18 });
  const refs = uris.map((uri, i) =>
    pdf.context.register(
      pdf.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [72, 700 - i * 20, 300, 716 - i * 20],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(uri) },
      })
    )
  );
  page.node.set(PDFName.of("Annots"), pdf.context.obj(refs));
  return pdf.save({ useObjectStreams: false });
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  let out = "";
  for (const b of new Uint8Array(digest)) out += b.toString(16).padStart(2, "0");
  return out;
}
