import { describe, expect, it } from "vitest";
import { countPlaceholderLinks, listLinkUris, makePdfWithLinks, PLACEHOLDER_URI, sha256Hex, stampPdf } from "./pdf";

describe("resume pdf links", () => {
  it("counts only exact placeholder links", async () => {
    const pdf = await makePdfWithLinks([PLACEHOLDER_URI, "https://github.com/samueljbaker", PLACEHOLDER_URI, "https://samueljbaker.dev/v/__KEY__/x"]);
    expect(await countPlaceholderLinks(pdf)).toBe(2);
    expect(await countPlaceholderLinks(await makePdfWithLinks(["https://samueljbaker.dev"]))).toBe(0);
    expect(await countPlaceholderLinks(await makePdfWithLinks([]))).toBe(0);
  });

  it("stamps the key into every placeholder link and leaves the rest", async () => {
    const pdf = await makePdfWithLinks([PLACEHOLDER_URI, "https://github.com/samueljbaker"]);
    const { bytes, stamped } = await stampPdf(pdf, "ab3kx7qz");
    expect(stamped).toBe(1);
    expect(await listLinkUris(bytes)).toEqual(["https://samueljbaker.dev/v/ab3kx7qz", "https://github.com/samueljbaker"]);
    expect(await countPlaceholderLinks(bytes)).toBe(0);
    // the source is untouched
    expect(await countPlaceholderLinks(pdf)).toBe(1);
  });

  it("rejects bytes that are not a PDF", async () => {
    await expect(countPlaceholderLinks(new TextEncoder().encode("hello"))).rejects.toThrow();
  });

  it("hashes bytes to 64 hex characters", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
