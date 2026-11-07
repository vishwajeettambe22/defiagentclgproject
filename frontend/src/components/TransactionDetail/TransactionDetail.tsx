/**
 * Transaction Detail modal/panel.
 * Full drill-down view of a single transaction including integrity status.
 * FR-08: Transaction record viewing and integrity verification.
 */
import React, { useState } from "react";
import type { TransactionDetail as TxDetail, IntegrityResult } from "../../types";
import * as api from "../../services/api";

interface Props {
  detail: TxDetail;
  onClose: () => void;
}

function Row({ label, value, mono, link }: {
  label: string; value?: string | null; mono?: boolean; link?: string;
}) {
  if (!value) return null;
  return (
    <div style={r.row}>
      <span style={r.label}>{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ ...r.value, color: "#388bfd", fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 12 : 14 }}>
          {value}
        </a>
      ) : (
        <span style={{ ...r.value, fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 12 : 14 }}>
          {value}
        </span>
      )}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  completed: "#3fb950", validation_failed: "#f85149", failed: "#f85149",
  user_rejected: "#d29922", user_cancelled: "#d29922", executing: "#79c0ff",
  pending: "#79c0ff", preview_shown: "#8b949e",
};

export function TransactionDetail({ detail, onClose }: Props) {
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await api.verifyIntegrity(detail.request_id);
      setIntegrity(r);
    } catch { /* ignore */ }
    setVerifying(false);
  };

  const opLabel = detail.token_out
    ? `${detail.token_in} → ${detail.token_out}`
    : `${detail.amount ?? ""} ${detail.token_in ?? ""}`.trim();

  const statusColor = STATUS_COLOR[detail.status] ?? "#6e7681";
  const shortHash = (h?: string | null) => h ? `${h.slice(0, 14)}...${h.slice(-8)}` : null;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.mHeader}>
          <div>
            <div style={s.opLabel}>{(detail.operation ?? "Transaction").toUpperCase()}</div>
            <div style={{ ...s.status, color: statusColor }}>
              {detail.status.replace(/_/g, " ").toUpperCase()}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          {/* User's original command */}
          <div style={s.section}>
            <div style={s.sLabel}>Your Request</div>
            <div style={s.quote}>"{detail.natural_language_input}"</div>
          </div>

          {/* Intent details */}
          <div style={s.section}>
            <div style={s.sLabel}>Transaction Details</div>
            <Row label="Operation" value={detail.operation} />
            <Row label="Amount / Tokens" value={opLabel || undefined} />
            {detail.recipient && <Row label="Recipient" value={detail.recipient} mono />}
            <Row label="Network" value="Sepolia Testnet" />
            {detail.confidence != null && (
              <Row label="AI Confidence" value={`${(detail.confidence * 100).toFixed(0)}%`} />
            )}
          </div>

          {/* Validation */}
          {detail.validation_status && (
            <div style={s.section}>
              <div style={s.sLabel}>Validation</div>
              <div style={{ ...s.badge, background: detail.validation_status === "passed" ? "#0d2918" : "#1c1010", borderColor: detail.validation_status === "passed" ? "#238636" : "#da3633" }}>
                <span style={{ color: detail.validation_status === "passed" ? "#3fb950" : "#f85149", fontWeight: 700 }}>
                  {detail.validation_status === "passed" ? "✓ PASSED" : "✗ FAILED"}
                </span>
                {detail.validation_summary && <span style={s.vSummary}>{detail.validation_summary}</span>}
              </div>
              {detail.validation_checks && (
                <div style={s.checks}>
                  {Object.entries(detail.validation_checks).map(([k, v]) => (
                    <div key={k} style={s.checkRow}>
                      <span style={{ color: v ? "#3fb950" : "#f85149" }}>{v ? "✓" : "✗"}</span>
                      <span style={s.checkName}>{k.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Blockchain */}
          {detail.blockchain_tx_hash && (
            <div style={s.section}>
              <div style={s.sLabel}>Blockchain Record</div>
              <Row label="Tx Hash" value={shortHash(detail.blockchain_tx_hash)} mono
                   link={detail.explorer_url ?? undefined} />
              {detail.block_number && <Row label="Block" value={`#${detail.block_number.toLocaleString()}`} />}
              {detail.gas_used && <Row label="Gas Used" value={detail.gas_used} />}
              {detail.executed_at && <Row label="Submitted" value={new Date(detail.executed_at).toLocaleString()} />}
              {detail.confirmed_at && <Row label="Confirmed" value={new Date(detail.confirmed_at).toLocaleString()} />}
            </div>
          )}

          {/* Integrity */}
          {detail.integrity_hash && (
            <div style={s.section}>
              <div style={s.sLabel}>Transaction Integrity (FR-08)</div>
              <Row label="Integrity Hash" value={shortHash(detail.integrity_hash)} mono />
              {detail.integrity_anchor_tx && (
                <Row label="On-chain Anchor" value={shortHash(detail.integrity_anchor_tx)} mono />
              )}

              {integrity ? (
                <div style={{ ...s.integrityBox, borderColor: integrity.is_intact ? "#238636" : "#da3633" }}>
                  <div style={{ fontWeight: 700, color: integrity.is_intact ? "#3fb950" : "#f85149" }}>
                    {integrity.is_intact ? "✓ Integrity Verified" : "⚠ Integrity Check Failed"}
                  </div>
                  <div style={s.intMsg}>{integrity.verification_message}</div>
                  <div style={s.intHash}>Computed: {integrity.computed_hash.slice(0, 20)}…</div>
                </div>
              ) : (
                <button style={s.verifyBtn} onClick={verify} disabled={verifying}>
                  {verifying ? "Verifying…" : "🔐 Verify Integrity"}
                </button>
              )}
            </div>
          )}
        </div>

        <div style={s.footer}>
          <span style={s.reqId}>ID: {detail.request_id.slice(0, 16)}…</span>
          <span style={s.date}>{new Date(detail.created_at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#161b22", border: "1px solid #30363d", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column" },
  mHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px 16px", borderBottom: "1px solid #21262d" },
  opLabel: { fontSize: 20, fontWeight: 800, color: "#e6edf3" },
  status: { fontSize: 12, fontWeight: 600, marginTop: 4 },
  closeBtn: { background: "transparent", border: "none", color: "#6e7681", cursor: "pointer", fontSize: 18, padding: 4 },
  body: { padding: "0 24px", flex: 1 },
  section: { padding: "16px 0", borderBottom: "1px solid #21262d" },
  sLabel: { fontSize: 11, fontWeight: 700, color: "#6e7681", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  quote: { fontSize: 14, color: "#79c0ff", fontStyle: "italic", background: "#0d1117", padding: "10px 14px", borderRadius: 8, borderLeft: "3px solid #1f6feb" },
  badge: { padding: "10px 14px", borderRadius: 8, border: "1px solid", display: "flex", flexDirection: "column", gap: 6 },
  vSummary: { fontSize: 12, color: "#8b949e", lineHeight: 1.4 },
  checks: { display: "flex", flexDirection: "column", gap: 6, marginTop: 10 },
  checkRow: { display: "flex", gap: 8, alignItems: "center" },
  checkName: { fontSize: 13, color: "#8b949e", textTransform: "capitalize" },
  verifyBtn: { marginTop: 10, padding: "8px 16px", background: "transparent", border: "1px solid #388bfd", borderRadius: 6, color: "#388bfd", cursor: "pointer", fontSize: 13 },
  integrityBox: { marginTop: 10, padding: 12, borderRadius: 8, border: "1px solid", background: "#0d1117" },
  intMsg: { fontSize: 13, color: "#8b949e", marginTop: 6, lineHeight: 1.4 },
  intHash: { fontSize: 11, color: "#6e7681", marginTop: 6, fontFamily: "monospace" },
  footer: { display: "flex", justifyContent: "space-between", padding: "12px 24px", borderTop: "1px solid #21262d" },
  reqId: { fontSize: 11, color: "#6e7681", fontFamily: "monospace" },
  date: { fontSize: 11, color: "#6e7681" },
};

const r: Record<string, React.CSSProperties> = {
  row: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0" },
  label: { fontSize: 13, color: "#6e7681", flexShrink: 0, marginRight: 12 },
  value: { fontSize: 14, color: "#e6edf3", textAlign: "right", wordBreak: "break-all" },
};
