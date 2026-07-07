"use client";

import { useRef, useState } from "react";

import { ResultPanels } from "@/presentation/features/classroom/ResultPanels";
import { Scene } from "@/presentation/features/classroom/Scene";
import { useClassroomRun } from "@/presentation/features/classroom/use-classroom-run";

/** Read a File into base64 (without the `data:…;base64,` prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface AttachedPdf {
  filename: string;
  data: string;
}

export default function Home() {
  const { state, start, stop } = useClassroomRun();
  const [markdown, setMarkdown] = useState("");
  const [title, setTitle] = useState("");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [pdfs, setPdfs] = useState<AttachedPdf[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      const res = await fetch("/api/classroom/demo");
      const data = await res.json();
      if (data.markdown) {
        setMarkdown(data.markdown);
        setTitle(data.title ?? "");
      }
    } finally {
      setLoadingDemo(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added = await Promise.all(
      Array.from(files).map(async (file) => ({ filename: file.name, data: await fileToBase64(file) })),
    );
    setPdfs((prev) => [...prev, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePdf = (i: number) => setPdfs((prev) => prev.filter((_, idx) => idx !== i));

  const hasText = markdown.trim().length > 0;
  const canLaunch = hasText || pdfs.length > 0;

  const launch = () => {
    if (!canLaunch) return;
    start({
      title: title.trim() || undefined,
      markdown: hasText ? markdown : undefined,
      inputs: pdfs.length ? pdfs.map((p) => ({ kind: "pdf" as const, filename: p.filename, data: p.data })) : undefined,
    });
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 64px" }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>
          ClassroomSim <span style={{ color: "var(--accent)" }}>·</span> pedagogical improvement loop
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14, maxWidth: 760, lineHeight: 1.55 }}>
          Drop in a lesson. Classes of student-agents re-explain it, a teacher-agent diagnoses, another rewrites, a
          fact-checker validates, then agents produce evaluations, exercises, and revision sheets — all live.
        </p>
      </header>

      {/* Deposit */}
      <section style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 20, background: "var(--surface)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional — otherwise inferred from the markdown)"
            style={{ flex: 1, minWidth: 220, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, background: "#fff", color: "var(--foreground)" }}
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={state.running} style={ghostBtn}>
            + Attach PDF
          </button>
          <button onClick={loadDemo} disabled={loadingDemo} style={ghostBtn}>
            {loadingDemo ? "Loading…" : "Load demo lesson"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            style={{ display: "none" }}
          />
        </div>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="# Lesson title&#10;&#10;Paste the lesson in markdown here… (or attach a PDF above)"
          rows={8}
          style={{ width: "100%", padding: 12, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontFamily: "var(--font-geist-mono, monospace)", background: "#fff", color: "var(--foreground)", resize: "vertical" }}
        />
        {pdfs.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {pdfs.map((p, i) => (
              <span key={i} style={pdfChip}>
                📄 {p.filename}
                <button onClick={() => removePdf(i)} disabled={state.running} style={pdfChipX} aria-label={`Remove ${p.filename}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button onClick={launch} disabled={state.running || !canLaunch} style={primaryBtn}>
            {state.running ? "Loop running…" : "Run the loop"}
          </button>
          {state.running && (
            <button onClick={stop} style={ghostBtn}>
              Stop
            </button>
          )}
        </div>
      </section>

      {state.error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: 12, borderRadius: 8, marginBottom: 14 }}>
          {state.error}
        </div>
      )}

      {(state.running || state.done) && (
        <>
          {/* Token / cost counter */}
          {state.usage && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ ...chip, background: "var(--surface-2)", color: "var(--foreground)" }}>
                {state.usage.calls} calls · {state.usage.inputTokens + state.usage.outputTokens} tokens · ~$
                {state.usage.estimatedCostUsd.toFixed(4)}
              </span>
            </div>
          )}

          {/* Live scene */}
          <Scene state={state} />

          {/* Result layer */}
          <h2 style={{ fontSize: 18, marginTop: 20, marginBottom: 10 }}>Results</h2>
          <ResultPanels state={state} />

          {state.logs.length > 0 && (
            <details style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
              <summary>Log ({state.logs.length})</summary>
              <ul>
                {state.logs.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </main>
  );
}

const primaryBtn: React.CSSProperties = {
  background: "#18181b",
  color: "#fff",
  border: "1px solid #18181b",
  borderRadius: 10,
  padding: "9px 18px",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  transition: "opacity .15s ease",
};
const ghostBtn: React.CSSProperties = {
  background: "#fff",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
};
const chip: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 500,
  letterSpacing: ".01em",
};
const pdfChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12.5,
  padding: "5px 6px 5px 11px",
  borderRadius: 999,
  background: "var(--surface-2, #f4f4f5)",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
};
const pdfChipX: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  color: "var(--muted)",
  padding: "0 2px",
};
