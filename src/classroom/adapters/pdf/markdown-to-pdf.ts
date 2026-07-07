/**
 * markdown → PDF renderer (jsPDF). Client-safe and pure: it imports ONLY jsPDF,
 * so it is the module the result panels (client) import directly, and the module
 * the server `PdfCodex` composite reuses for its `markdownToPdf`.
 *
 * This is the refactor of the former `pdf-dossier` layout engine: the `Pdf` layout
 * helper and `renderMarkdown` now live here, driven by a {@link PdfTheme} instead
 * of hard-coded constants, and the entry point returns raw PDF bytes.
 */
import { jsPDF } from "jspdf";

import { DEFAULT_THEME, type PdfTheme } from "@/classroom/application/ports/pdf-codex";

function clean(s: string): string {
  return (
    s
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      // Strip *emphasis* underscores boundary-safely: `_x_` → `x`, while leaving
      // snake_case (no leading space/paren, no trailing space/punct) intact.
      .replace(/(^|[\s(])_(?=\S)([^_\n]+?)_(?=[\s).,;:!?]|$)/g, "$1$2")
  );
}

/** Thin layout helper over jsPDF: cursor, page breaks, headings, lists. */
class Pdf {
  private doc: jsPDF;
  private y: number;
  private pageW: number;
  private pageH: number;
  private contentW: number;

  constructor(private readonly theme: PdfTheme) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.pageW = this.doc.internal.pageSize.getWidth();
    this.pageH = this.doc.internal.pageSize.getHeight();
    this.contentW = this.pageW - theme.margin * 2;
    this.y = theme.margin;
  }

  private ensure(space: number) {
    if (this.y + space > this.pageH - this.theme.margin) {
      this.doc.addPage();
      this.y = this.theme.margin;
    }
  }

  private write(
    text: string,
    opts: { size?: number; style?: "normal" | "bold" | "italic"; color?: string; gap?: number; indent?: number } = {},
  ) {
    const { size = 11, style = "normal", color = this.theme.colors.fg, gap = 5, indent = 0 } = opts;
    const s = size * this.theme.fontScale;
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(s);
    this.doc.setTextColor(color);
    const lines = this.doc.splitTextToSize(text, this.contentW - indent) as string[];
    const lh = s * 1.36;
    for (const ln of lines) {
      this.ensure(lh);
      this.doc.text(ln, this.theme.margin + indent, this.y);
      this.y += lh;
    }
    this.y += gap;
  }

  title(text: string) {
    this.ensure(40);
    this.write(text, { size: 21, style: "bold", gap: 4 });
    this.doc.setDrawColor(this.theme.colors.rule);
    this.doc.line(this.theme.margin, this.y, this.pageW - this.theme.margin, this.y);
    this.y += 12;
  }
  h2(text: string) {
    this.ensure(26);
    this.y += 6;
    this.write(text, { size: 15, style: "bold", color: this.theme.colors.accent, gap: 4 });
  }
  h3(text: string) {
    this.ensure(20);
    this.write(text, { size: 12.5, style: "bold", gap: 3 });
  }
  para(text: string) {
    this.write(text, { gap: 6 });
  }
  muted(text: string) {
    this.write(text, { size: 9.5, color: this.theme.colors.muted, gap: 6 });
  }
  answerKey(text: string) {
    this.write(`Answer key: ${text}`, { size: 10, style: "italic", color: this.theme.colors.accent, gap: 7 });
  }
  bullet(text: string) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(11 * this.theme.fontScale);
    this.doc.setTextColor(this.theme.colors.fg);
    const lines = this.doc.splitTextToSize(text, this.contentW - 16) as string[];
    const lh = 11 * this.theme.fontScale * 1.36;
    this.ensure(lh);
    this.doc.text("•", this.theme.margin, this.y);
    for (const ln of lines) {
      this.ensure(lh);
      this.doc.text(ln, this.theme.margin + 14, this.y);
      this.y += lh;
    }
    this.y += 2;
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.doc.output("arraybuffer") as ArrayBuffer);
  }
}

/** Render one markdown document onto the page. */
function renderMarkdown(p: Pdf, md: string) {
  const buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      p.para(clean(buf.join(" ")));
      buf.length = 0;
    }
  };
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^#\s+/.test(line)) {
      flush();
      p.title(clean(line.replace(/^#\s+/, "")));
    } else if (/^##\s+/.test(line)) {
      flush();
      p.h2(clean(line.replace(/^##\s+/, "")));
    } else if (/^###\s+/.test(line)) {
      flush();
      p.h3(clean(line.replace(/^###\s+/, "")));
    } else if (/^\s*(?:[-*]\s+)?_?answer key:_?/i.test(line)) {
      // Convention: an "_Answer key:_ …" line (bulleted or not) renders as a styled
      // answer key, so a markdown-sourced dossier keeps the old exporter's look.
      flush();
      const m = line.match(/^\s*(?:[-*]\s+)?_?answer key:_?\s*(.*)$/i);
      p.answerKey(clean(m?.[1] ?? ""));
    } else if (/^\s*[-*]\s+/.test(line)) {
      flush();
      p.bullet(clean(line.replace(/^\s*[-*]\s+/, "")));
    } else if (/^\s{4,}\S/.test(line)) {
      flush();
      p.muted(line.trim());
    } else if (line.trim() === "") {
      flush();
    } else {
      buf.push(line.trim());
    }
  }
  flush();
}

/**
 * Render markdown into a themed PDF and return its bytes. The one entry point
 * behind {@link PdfCodex.markdownToPdf}.
 */
export function markdownToPdf(markdown: string, theme: PdfTheme = DEFAULT_THEME): Uint8Array {
  const p = new Pdf(theme);
  renderMarkdown(p, markdown);
  return p.toBytes();
}
