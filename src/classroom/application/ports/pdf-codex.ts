/**
 * PdfCodex — the two-way PDF port.
 *
 *  - `markdownToPdf` renders markdown into a PDF document (bytes) with a themeable
 *    look. It is the refactored jsPDF exporter, now a pure markdown → PDF renderer.
 *  - `pdfToMarkdown` extracts the text of an uploaded PDF so it can be ingested as
 *    lesson markdown by the use case.
 *
 * The interface is a plain type (zero bundle cost). The server/client boundary is
 * enforced by WHERE the concrete adapter is imported — never by this file:
 *   - the client (result panels) imports the client-safe renderer directly;
 *   - the use case reaches `pdfToMarkdown` only through the server composite,
 *     wired in `classroom.module.ts`.
 */

/**
 * Visual theme for {@link PdfCodex.markdownToPdf}. Plain, serializable data — no
 * jsPDF dependency — so both the client renderer and any caller can share it.
 * Colors are CSS hex strings (jsPDF accepts them directly).
 */
export interface PdfTheme {
  colors: {
    /** Body text. */
    fg: string;
    /** Secondary / metadata text. */
    muted: string;
    /** Headings (h2) and answer keys. */
    accent: string;
    /** The thin rule drawn under a document title. */
    rule: string;
  };
  /** Page margin, in points. */
  margin: number;
  /** Multiplies every font size (1 = the default scale). */
  fontScale: number;
}

/** The default "dossier" look — indigo accents, matching the on-screen panels. */
export const DOSSIER_THEME: PdfTheme = {
  colors: { fg: "#18181b", muted: "#71717a", accent: "#4f46e5", rule: "#ebebed" },
  margin: 48,
  fontScale: 1,
};

/** A sober, ink-only look (no colored accents) for neutral printouts. */
export const PLAIN_THEME: PdfTheme = {
  colors: { fg: "#18181b", muted: "#555555", accent: "#18181b", rule: "#dddddd" },
  margin: 56,
  fontScale: 1,
};

/** Theme used when a caller passes none. */
export const DEFAULT_THEME: PdfTheme = DOSSIER_THEME;

export interface PdfCodex {
  /** Render markdown into a themed PDF document. Returns the raw PDF bytes. */
  markdownToPdf(markdown: string, theme?: PdfTheme): Uint8Array;
  /** Extract the text of a PDF as markdown, for ingestion into the loop. */
  pdfToMarkdown(pdf: Uint8Array): Promise<string>;
}
