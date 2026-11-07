/**
 * IntegrityVerifier — step-by-step integrity verification panel.
 * FR-08: Tamper-evident transaction record verification.
 */
import React, { useState } from "react";
import type { IntegrityResult } from "../../types";
import * as api from "../../services/api";

interface Props { recentRequestIds: string[] }

export function IntegrityVerifier({ recentRequestIds }: Props) {
  const [requestId, setRequestId] = useState(recentRequestIds[0] ?? "");
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!requestId.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.verifyIntegrity(requestId.trim());
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    }
    setLoading(false);
  };

  const steps = result ? [
    { label: "Canonical record located", ok: true },
    { label: "Integrity hash recomputed", ok: !!result.computed_hash },
    { label: "Stored hash retrieved", ok: !!result.stored_hash },
    { label: "Hashes match — record intact", ok: result.is_intact },
  ] : [];

  return (
    <div style={s.card}>
      <h3 style={s.title}>🔐 Transaction Integrity Verification</h3>
      <p style={s.desc}>
        Enter a transaction request ID to verify that the application record has not been
        tampered with since it was created. The system recomputes the SHA-256 hash and
        compares it to the stored value.
      </p>

      <div style={s.inputRow}>
        <select
          style={s.select}
          value={requestId}
          onChange={e => setRequestId(e.target.value)}
        >
          <option value="">— Select a transaction —</option>
          {recentRequestIds.map(id => (
            <option key={id} value={id}>{id.slice(0, 20)}…</option>
          ))}
        </select>
        <span style={s.or}>or</span>
        <input
          style={s.input}
          placeholder="Paste request ID"
          value={requestId}
          onChange={e => setRequestId(e.target.value)}
        />
      </div>

      <button style={s.btn} onClick={verify} disabled={loading || !requestId.trim()}>
        {loading ? "Verifying…" : "Verify Integrity"}
      </button>

      {error && <div style={s.error}>{error}</div>}

      {result && (
        <div style={{ ...s.result, borderColor: result.is_intact ? "#238636" : "#da3633" }}>
          <div style={s.steps}>
            {steps.map((step, i) => (
              <div key={i} style={s.step}>
                <span style={{ color: step.ok ? "#3fb950" : "#f85149", fontSize: 18 }}>
                  {step.ok ? "✓" : "✗"}
                </span>
                <span style={{ ...s.stepLabel, color: step.ok ? "#e6edf3" : "#f85149" }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ ...s.verdict, color: result.is_intact ? "#3fb950" : "#f85149" }}>
            {result.is_intact ? "✓ Record integrity confirmed" : "⚠ Integrity check failed — record may be tampered"}
          </div>
          <p style={s.msg}>{result.verification_message}</p>

          <div style={s.hashes}>
            <div style={s.hashRow}>
              <span style={s.hashLabel}>Computed hash:</span>
              <code style={s.hash}>{result.computed_hash.slice(0, 32)}…</code>
            </div>
            {result.stored_hash && (
              <div style={s.hashRow}>
                <span style={s.hashLabel}>Stored hash:</span>
                <code style={s.hash}>{result.stored_hash.slice(0, 32)}…</code>
              </div>
            )}
            {result.anchor_tx_hash && (
              <div style={s.hashRow}>
                <span style={s.hashLabel}>On-chain anchor:</span>
                <a href={`https://sepolia.etherscan.io/tx/${result.anchor_tx_hash}`}
                   target="_blank" rel="noopener noreferrer" style={{ ...s.hash, color: "#388bfd" }}>
                  {result.anchor_tx_hash.slice(0, 20)}…
                </a>
              </div>
            )}
          </div>

          <div style={s.note}>
            <strong>On-chain vs Off-chain:</strong> The integrity hash is a SHA-256 of the
            application record (off-chain). The blockchain holds the transaction execution
            hash and the integrity anchor. Both together provide tamper-evidence.
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 24 },
  title: { fontSize: 18, fontWeight: 700, color: "#e6edf3", marginBottom: 8 },
  desc: { fontSize: 13, color: "#8b949e", lineHeight: 1.6, marginBottom: 20 },
  inputRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  select: { padding: "10px 12px", borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13, flex: 1, minWidth: 180 },
  or: { color: "#6e7681", fontSize: 12 },
  input: { padding: "10px 12px", borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13, flex: 2 },
  btn: { padding: "10px 24px", borderRadius: 8, border: "none", background: "#1f6feb", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  error: { color: "#f85149", fontSize: 13, marginTop: 12 },
  result: { marginTop: 20, padding: 20, borderRadius: 10, border: "1px solid", background: "#0d1117" },
  steps: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 },
  step: { display: "flex", alignItems: "center", gap: 10 },
  stepLabel: { fontSize: 14 },
  verdict: { fontSize: 16, fontWeight: 700, marginBottom: 8 },
  msg: { fontSize: 13, color: "#8b949e", lineHeight: 1.5, marginBottom: 16 },
  hashes: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  hashRow: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" },
  hashLabel: { fontSize: 12, color: "#6e7681", flexShrink: 0 },
  hash: { fontSize: 11, fontFamily: "monospace", color: "#8b949e", wordBreak: "break-all" },
  note: { fontSize: 12, color: "#6e7681", lineHeight: 1.6, padding: "12px 0", borderTop: "1px solid #21262d" },
};
