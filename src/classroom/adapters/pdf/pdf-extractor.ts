/**
 * PDF → markdown text extraction (server-only), via `unpdf` — a serverless build
 * of pdf.js that needs no worker setup and runs inside a `runtime = "nodejs"`
 * route. The `server-only` guard makes it a hard build error if this module (and
 * thus unpdf) is ever pulled into a client bundle.
 *
 * Extraction is best-effort text, not layout-faithful markdown: pages are joined
 * with blank lines. That is enough to feed the loop, which reasons over prose.
 */
import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

/** Extract the text of a PDF as plain markdown (paragraph-per-page). */
export async function pdfToMarkdown(pdf: Uint8Array): Promise<string> {
  const doc = await getDocumentProxy(pdf);
  const { text } = await extractText(doc, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]).map((t) => t.trim()).filter(Boolean);
  return pages.join("\n\n");
}
