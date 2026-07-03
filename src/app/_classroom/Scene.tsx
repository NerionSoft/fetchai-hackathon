"use client";

/**
 * Le "monde SVG" — disposition immersive : dans chaque classe, les élèves-agents
 * sont assis en DEMI-CERCLE face à un TABLEAU ; pendant la phase de diagnostic,
 * des lignes de flux animées remontent des élèves vers le tableau. La salle des
 * profs aligne les agents enseignants devant leur propre tableau.
 *
 * 100% SVG/CSS, aucune image, positions fixes (aucun déplacement d'agent).
 */
import type { Lane } from "@/classroom/events";
import { PROVIDER_COLORS } from "@/classroom/colors";
import { CLASS_META } from "@/classroom/roster";
import type { AgentView, RunState } from "./use-classroom-run";

const SLOT = 158; // horizontal spacing per agent
const R = 25; // circle radius
const APEX_Y = 192; // y of the middle (board-facing) seat
const DIP = 60; // how much the outer seats drop
const STAFF_Y = 196;
const BUBBLE_W = 142;
const BUBBLE_H = 96;
const BOARD_Y = 12;
const BOARD_H = 44;
const HEIGHT = 322;

const LANES: { lane: Lane; title: string; subtitle: string }[] = [
  { lane: "A", title: `Classe A — ${CLASS_META.A.nom}`, subtitle: CLASS_META.A.role },
  { lane: "B", title: `Classe B — ${CLASS_META.B.nom}`, subtitle: CLASS_META.B.role },
  { lane: "C", title: `Classe C — ${CLASS_META.C.nom}`, subtitle: CLASS_META.C.role },
  { lane: "staff", title: "Salle des profs (agents enseignants)", subtitle: "Diagnostic → réécriture → fact-check → production" },
];

interface Pt {
  x: number;
  y: number;
}

/** Seats on a board-facing bowl: middle nearest the board, ends lower. */
function seatPositions(count: number, staff: boolean): Pt[] {
  const center = (count - 1) / 2;
  const maxD = center || 1;
  return Array.from({ length: count }, (_, i) => {
    const x = (i + 0.5) * SLOT;
    const d = Math.abs(i - center) / maxD;
    const y = staff ? STAFF_Y : APEX_Y + DIP * d * d;
    return { x, y };
  });
}

function AgentNode({ agent, at }: { agent: AgentView; at: Pt }) {
  const { meta, status } = agent;
  const { x: cx, y: cy } = at;
  const dim = status === "en_attente";
  const failed = status === "echec";
  const fill = failed ? "#d4d4d8" : `hsl(${meta.hue} 52% 57%)`;
  const stroke = failed ? "#a1a1aa" : `hsl(${meta.hue} 45% 42%)`;

  const showBubble = status !== "en_attente";
  const bubbleText =
    status === "termine" ? agent.summary ?? "" : status === "echec" ? agent.error ?? "échec" : agent.buffer;
  const mono = status === "parle";
  const by = Math.max(BOARD_Y + BOARD_H + 4, cy - R - 8 - BUBBLE_H);

  return (
    <g className="cs-agent" opacity={dim ? 0.45 : 1}>
      {showBubble && (
        <foreignObject x={cx - BUBBLE_W / 2} y={by} width={BUBBLE_W} height={BUBBLE_H}>
          <div
            className="cs-bubble cs-fade-in"
            style={{
              boxSizing: "border-box",
              height: "100%",
              border: `1px solid ${failed ? "#d4d4d8" : "var(--border)"}`,
              borderRadius: 10,
              background: failed ? "var(--surface-2)" : "#ffffff",
              color: "var(--foreground)",
              padding: "6px 8px",
              boxShadow: "0 1px 2px rgba(0,0,0,.05)",
            }}
          >
            {status === "reflechit" ? (
              <span className="cs-dots cs-thinking" style={{ margin: "auto", fontSize: 18 }} />
            ) : (
              <div
                className="cs-bubble-inner"
                style={{ fontFamily: mono ? "var(--font-geist-mono, monospace)" : "inherit", wordBreak: "break-word" }}
              >
                {bubbleText}
              </div>
            )}
          </div>
        </foreignObject>
      )}

      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        className={status === "reflechit" ? "cs-thinking" : undefined}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
        {meta.label}
      </text>
      {failed && (
        <text x={cx + R - 4} y={cy - R + 8} textAnchor="middle" fontSize={14} fill="#b91c1c">
          ✕
        </text>
      )}
      <circle cx={cx + R - 3} cy={cy - R + 3} r={5} fill={PROVIDER_COLORS[meta.provider] ?? "#999"} stroke="#fff" strokeWidth={1} />

      {meta.niveau ? (
        <text x={cx} y={cy + R + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill="currentColor">
          {meta.niveau} · {meta.style?.replace("S-", "")}
        </text>
      ) : (
        <text x={cx} y={cy + R + 16} textAnchor="middle" fontSize={10} fill="currentColor">
          {meta.role.replace(/^Prof |Concepteur d'|Concepteur de /, "")}
        </text>
      )}
      <text x={cx} y={cy + R + 30} textAnchor="middle" fontSize={9} fill="var(--muted)">
        {meta.provider}
      </text>
    </g>
  );
}

function LaneScene({
  agents,
  title,
  subtitle,
  staff,
  flowing,
}: {
  agents: AgentView[];
  title: string;
  subtitle: string;
  staff: boolean;
  flowing: boolean;
}) {
  const width = Math.max(agents.length, 1) * SLOT;
  const pts = seatPositions(agents.length, staff);
  const boardX = width / 2 - 120;
  const boardCx = width / 2;
  const boardBottom = BOARD_Y + BOARD_H;

  return (
    <section style={{ marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h3>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>{subtitle}</p>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 14, background: "#fff" }}>
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width="100%"
          style={{ minWidth: width, maxWidth: "100%", display: "block" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* tableau */}
          <rect x={boardX} y={BOARD_Y} width={240} height={BOARD_H} rx={8} fill="#1f2937" stroke="#111827" />
          <text x={boardCx} y={BOARD_Y + BOARD_H / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#e5e7eb">
            {staff ? "Tableau — production" : "Tableau"}
          </text>

          {/* flow lines élèves → tableau pendant le diagnostic */}
          {flowing &&
            !staff &&
            pts.map((p, i) => (
              <line
                key={`flow-${i}`}
                x1={p.x}
                y1={p.y - R}
                x2={boardCx}
                y2={boardBottom}
                stroke="var(--accent)"
                strokeWidth={1.2}
                opacity={0.5}
                className="cs-flow"
              />
            ))}

          {agents.map((a, i) => (
            <AgentNode key={a.meta.agentId} agent={a} at={pts[i]} />
          ))}
        </svg>
      </div>
    </section>
  );
}

export function Scene({ state }: { state: RunState }) {
  const flowing: boolean = state.phase === "diagnose";
  const byLane = (lane: Lane) =>
    state.order.map((id) => state.agents[id]).filter((a): a is AgentView => !!a && a.meta.lane === lane);

  return (
    <div>
      {LANES.map(({ lane, title, subtitle }) => {
        const agents = byLane(lane);
        if (agents.length === 0) return null;
        return (
          <LaneScene
            key={lane}
            agents={agents}
            title={title}
            subtitle={subtitle}
            staff={lane === "staff"}
            flowing={flowing}
          />
        );
      })}
    </div>
  );
}
