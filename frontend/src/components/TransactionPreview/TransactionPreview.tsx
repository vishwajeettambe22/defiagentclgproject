/**
 * TransactionPreview component.
 * FR-05: Pre-execution transaction preview.
 * NFR-02: Clear separation between preview and execution.
 *
 * The "Approve" button does NOT execute the transaction automatically.
 * It triggers the MetaMask popup — the user must approve there too.
 */

import React, { useState } from "react";
import type { TransactionPreview as TPreview } from "../../types";

interface Props {
  preview: TPreview;
  walletAddress: string;
  onApprove: (txHash: string) => void;
  onReject: () => void;
  onExecute: (preview: TPreview) => Promise<string>;
}

export function TransactionPreview({ preview, onApprove, onReject, onExecute }: Props) {
  const [executing, setExecuting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const handleApprove = async () => {
    setExecuting(true);
    setTxError(null);
    try {
      // This calls MetaMask — user must approve in the MetaMask popup
      const txHash = await onExecute(preview);
      onApprove(txHash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed or was rejected.";
      setTxError(msg);
      setExecuting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.previewBadge}>📋 TRANSACTION PREVIEW</span>
        <p style={styles.notice}>
          Review all details carefully. No blockchain transaction will occur until you
          approve in your MetaMask wallet.
        </p>
      </div>

      <div style={styles.details}>
        <DetailRow label="Operation" value={preview.operation} highlight />
        {preview.token && <DetailRow label="Token" value={preview.token} />}
        {preview.amount && <DetailRow label="Amount" value={preview.amount} highlight />}
        {preview.recipient && <DetailRow label="Recipient" value={preview.recipient} mono />}
        <DetailRow label="Network" value={preview.network} />
        {preview.estimated_gas && <DetailRow label="Est. Gas" value={preview.estimated_gas} />}
      </div>

      <div style={styles.security}>
        <div style={styles.sectionLabel}>Security Checks</div>
        {preview.security_checks.map((c, i) => (
          <div key={i} style={styles.securityItem}>✓ {c}</div>
        ))}
      </div>

      {preview.contract_assurance && (
        <div style={styles.assurance}>
          <div style={styles.sectionLabel}>Smart Contract Assurance (LeVer)</div>
          <div style={styles.assuranceItem}>
            {preview.contract_assurance.label}
            {preview.contract_assurance.open_findings > 0 &&
              ` · ${preview.contract_assurance.open_findings} reviewed finding(s) open`}
          </div>
          <div style={styles.assuranceNote}>{preview.contract_assurance.note}</div>
        </div>
      )}

      <div style={styles.warnings}>
        <div style={styles.sectionLabel}>⚠️ Warnings</div>
        {preview.warnings.map((w, i) => (
          <div key={i} style={styles.warningItem}>{w}</div>
        ))}
      </div>

      <div style={styles.instruction}>{preview.authorization_instruction}</div>

      {txError && (
        <div style={styles.txError}>❌ {txError}</div>
      )}

      <div style={styles.actions}>
        <button style={styles.rejectBtn} onClick={onReject} disabled={executing}>
          ✗ Reject
        </button>
        <button style={styles.approveBtn} onClick={handleApprove} disabled={executing}>
          {executing ? "⏳ Opening MetaMask..." : "✓ Approve in Wallet"}
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight, mono }: {
  label: string; value: string; highlight?: boolean; mono?: boolean;
}) {
  return (
    <div style={detailStyles.row}>
      <span style={detailStyles.label}>{label}</span>
      <span style={{
        ...detailStyles.value,
        color: highlight ? "#79c0ff" : "#e6edf3",
        fontFamily: mono ? "monospace" : "inherit",
        fontSize: mono ? 12 : 14,
      }}>
        {value}
      </span>
    </div>
  );
}

const detailStyles: Record<string, React.CSSProperties> = {
  row: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #21262d" },
  label: { fontSize: 13, color: "#6e7681", fontWeight: 500 },
  value: { fontSize: 14, textAlign: "right", maxWidth: "60%" },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#161b22", border: "2px solid #1f6feb", borderRadius: 12, padding: 24,
  },
  header: { marginBottom: 20 },
  previewBadge: {
    display: "inline-block", padding: "4px 10px", borderRadius: 6,
    background: "#1f6feb", color: "white", fontSize: 12, fontWeight: 700, marginBottom: 10,
  },
  notice: { fontSize: 13, color: "#8b949e", lineHeight: 1.5 },
  details: { marginBottom: 20 },
  security: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "#6e7681", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  securityItem: { fontSize: 13, color: "#3fb950", padding: "2px 0" },
  assurance: { marginBottom: 16, padding: 12, background: "#0d1117", borderRadius: 8, border: "1px solid #21262d" },
  assuranceItem: { fontSize: 13, color: "#79c0ff", padding: "2px 0" },
  assuranceNote: { fontSize: 12, color: "#8b949e", lineHeight: 1.4, marginTop: 4 },
  warnings: { marginBottom: 20, padding: 12, background: "#1c1a10", borderRadius: 8, border: "1px solid #3d3000" },
  warningItem: { fontSize: 13, color: "#d29922", padding: "2px 0", lineHeight: 1.4 },
  instruction: {
    fontSize: 13, color: "#8b949e", background: "#0d1117",
    padding: 12, borderRadius: 6, marginBottom: 20, lineHeight: 1.5,
  },
  actions: { display: "flex", gap: 12 },
  rejectBtn: {
    flex: 1, padding: "12px 0", borderRadius: 8, border: "1px solid #da3633",
    background: "transparent", color: "#f85149", cursor: "pointer", fontWeight: 600,
  },
  approveBtn: {
    flex: 2, padding: "12px 0", borderRadius: 8, border: "none",
    background: "#238636", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 15,
  },
  txError: {
    color: "#f85149", background: "#1c1010", padding: 10,
    borderRadius: 6, fontSize: 13, marginBottom: 12,
  },
};
