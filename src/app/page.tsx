"use client";

import { useState } from "react";

import { ResultPanels } from "./_classroom/ResultPanels";
import { Scene } from "./_classroom/Scene";
import { useClassroomRun } from "./_classroom/use-classroom-run";

export default function Home() {
  const { state, start, stop } = useClassroomRun();
  const [markdown, setMarkdown] = useState("");
  const [title, setTitle] = useState("");
  const [loadingDemo, setLoadingDemo] = useState(false);

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

  const launch = () => {
    if (!markdown.trim()) return;
    start({ markdown, title: title.trim() || undefined });
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 64px" }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>
          ClassroomSim <span style={{ color: "var(--accent)" }}>·</span> boucle d’amélioration pédagogique
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14, maxWidth: 760, lineHeight: 1.55 }}>
          Déposez une leçon. Des classes d’élèves-agents la restituent, un prof-agent diagnostique, un autre réécrit, un
          fact-checker valide, puis des agents produisent évaluations, exercices et fiches — le tout en direct.
        </p>
      </header>

      {/* Deposit */}
      <section style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 20, background: "var(--surface)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre (optionnel — sinon déduit du markdown)"
            style={{ flex: 1, minWidth: 220, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, background: "#fff", color: "var(--foreground)" }}
          />
          <button onClick={loadDemo} disabled={loadingDemo} style={ghostBtn}>
            {loadingDemo ? "Chargement…" : "Charger la leçon de démo"}
          </button>
        </div>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="# Titre de la leçon&#10;&#10;Collez ici la leçon en markdown…"
          rows={8}
          style={{ width: "100%", padding: 12, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontFamily: "var(--font-geist-mono, monospace)", background: "#fff", color: "var(--foreground)", resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button onClick={launch} disabled={state.running || !markdown.trim()} style={primaryBtn}>
            {state.running ? "Boucle en cours…" : "Lancer la boucle"}
          </button>
          {state.running && (
            <button onClick={stop} style={ghostBtn}>
              Arrêter
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
                {state.usage.calls} appels · {state.usage.inputTokens + state.usage.outputTokens} tokens · ~$
                {state.usage.estimatedCostUsd.toFixed(4)}
              </span>
            </div>
          )}

          {/* Live scene */}
          <Scene state={state} />

          {/* Result layer */}
          <h2 style={{ fontSize: 18, marginTop: 20, marginBottom: 10 }}>Résultats</h2>
          <ResultPanels state={state} />

          {state.logs.length > 0 && (
            <details style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
              <summary>Journal ({state.logs.length})</summary>
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
