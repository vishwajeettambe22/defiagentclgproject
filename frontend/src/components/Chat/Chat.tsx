import React, { useState } from "react";
import type { WorkflowStage, DeFiIntent } from "../../types";

interface Props {
  onSubmit: (input: string) => void;
  stage: WorkflowStage;
  intent?: DeFiIntent | null;
  disabled: boolean;
}

const EXAMPLES = [
  "Swap 10 USDC for ETH",
  "Transfer 0.05 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "Stake 0.1 ETH",
];

const STAGE_MSG: Partial<Record<WorkflowStage, string>> = {
  parsing: "🤖 Understanding your request…",
  validating: "🔍 Running security validation…",
  previewing: "📋 Building transaction preview…",
  submitting: "📤 Submitting to blockchain…",
  pending: "⏳ Waiting for blockchain confirmation…",
};

export function Chat({ onSubmit, stage, intent, disabled }: Props) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) { onSubmit(input.trim()); setInput(""); }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>💬 AI DeFi Command</h2>
        <p style={s.sub}>
          Describe what you want to do in plain English. The AI will interpret it,
          validate it, and show you a full preview before any signing occurs.
        </p>
      </div>

      {/* AI interpreted intent display */}
      {intent && stage !== "idle" && (
        <div style={s.intentCard}>
          <div style={s.intentHeader}>🤖 I understood your request as:</div>
          <div style={s.intentGrid}>
            <IntentRow label="Operation" value={(intent.operation ?? "").toUpperCase()} highlight />
            {intent.token_in && <IntentRow label="Token" value={intent.token_in} />}
            {intent.token_out && <IntentRow label="Receive" value={intent.token_out} />}
            {intent.amount != null && <IntentRow label="Amount" value={String(intent.amount)} highlight />}
            {intent.recipient && <IntentRow label="Recipient" value={`${intent.recipient.slice(0,10)}…`} mono />}
            <IntentRow label="AI Confidence" value={`${Math.round((intent.confidence ?? 0) * 100)}%`} />
          </div>
        </div>
      )}

      {/* Stage progress */}
      {stage !== "idle" && STAGE_MSG[stage] && (
        <div style={s.stageBar}>
          <div style={s.stageSpinner} />
          <span>{STAGE_MSG[stage]}</span>
        </div>
      )}

      {/* Input */}
      {(stage === "idle" || stage === "failed" || stage === "user_cancelled") && (
        <>
          <form onSubmit={handleSubmit} style={s.form}>
            <input
              style={s.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder='e.g. "Swap 10 USDC for ETH"'
              disabled={disabled}
              autoFocus
            />
            <button style={s.sendBtn} type="submit" disabled={disabled || !input.trim()}>
              Send ↵
            </button>
          </form>
          <div style={s.examples}>
            <span style={s.exLabel}>Try:</span>
            {EXAMPLES.map(ex => (
              <button key={ex} style={s.exBtn} onClick={() => setInput(ex)} disabled={disabled}>
                {ex}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function IntentRow({ label, value, highlight, mono }: {
  label: string; value: string; highlight?: boolean; mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #21262d" }}>
      <span style={{ fontSize: 12, color: "#6e7681" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: highlight ? 700 : 500, color: highlight ? "#79c0ff" : "#e6edf3", fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 24 },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 700, color: "#e6edf3", marginBottom: 6 },
  sub: { fontSize: 13, color: "#8b949e", lineHeight: 1.5 },
  intentCard: { background: "#0d1117", border: "1px solid #1f6feb", borderRadius: 10, padding: 16, marginBottom: 16 },
  intentHeader: { fontSize: 13, color: "#79c0ff", fontWeight: 600, marginBottom: 10 },
  intentGrid: { display: "flex", flexDirection: "column", gap: 0 },
  stageBar: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0d1117", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#8b949e" },
  stageSpinner: { width: 14, height: 14, borderRadius: "50%", border: "2px solid #30363d", borderTopColor: "#1f6feb", flexShrink: 0 },
  form: { display: "flex", gap: 8, marginBottom: 12 },
  input: { flex: 1, padding: "12px 16px", borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 14, outline: "none" },
  sendBtn: { padding: "12px 20px", borderRadius: 8, border: "none", background: "#1f6feb", color: "#fff", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  examples: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  exLabel: { fontSize: 12, color: "#6e7681" },
  exBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: 12 },
};
