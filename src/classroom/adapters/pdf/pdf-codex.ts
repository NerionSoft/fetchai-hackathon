/**
 * ServerPdfCodex — the server-side composite implementing the {@link PdfCodex}
 * port. It wires the client-safe jsPDF renderer (`markdownToPdf`) to the
 * server-only text extractor (`pdfToMarkdown`).
 *
 * Server-only: it transitively imports the PDF extractor (unpdf), so it must
 * never reach a client bundle. Only `classroom.module.ts` constructs it.
 */
import "server-only";

import type { PdfCodex, PdfTheme } from "@/classroom/application/ports/pdf-codex";

import { markdownToPdf } from "./markdown-to-pdf";
import { pdfToMarkdown } from "./pdf-extractor";

export class ServerPdfCodex implements PdfCodex {
  markdownToPdf(markdown: string, theme?: PdfTheme): Uint8Array {
    return markdownToPdf(markdown, theme);
  }

  pdfToMarkdown(pdf: Uint8Array): Promise<string> {
    return pdfToMarkdown(pdf);
  }
}
