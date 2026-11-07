import React from "react";
import type { TransactionSummary } from "../../types";

interface Props {
  transactions: TransactionSummary[];
  onSelect: (requestId: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  completed: "#3fb950", validation_failed: "#f85149", failed: "#f85149",
  user_rejected: "#d29922", user_cancelled: "#d29922",
  executing: "#79c0ff", pending: "#79c0ff", submitting: "#79c0ff",
  preview_shown: "#8b949e", intent_parsed: "#8b949e",
};

const OP_COLOR: Record<string, string> = {
  transfer: "#1a3a5c", swap: "#1a3520", stake: "#2a1a3c",
};

function shortHash(h?: string | null) {
  return h ? `${h.slice(0, 8)}…${h.slice(-6)}` : null;
}

export function TransactionHistory({ transactions, onSelect }: Props) {
  if (!transactions.length) {
    return (
      <div style={s.empty}>
        No transactions yet. Use the AI Command tab to get started.
      </div>
    );
  }

  return (
    <div style={s.list}>
      {transactions.map((tx) => (
        <div key={tx.request_id} style={s.row} onClick={() => onSelect(tx.request_id)}>
          <div style={s.left}>
            <span style={{ ...s.opBadge, background: OP_COLOR[tx.operation] ?? "#1a1a2a" }}>
              {tx.operation.toUpperCase()}
            </span>
            <div>
              <div style={s.detail}>
                {tx.amount ? `${tx.amount} ` : ""}
                {tx.token ?? ""}
                {tx.recipient ? ` → ${tx.recipient.slice(0, 8)}…` : ""}
              </div>
              {tx.blockchain_tx_hash && (
                <div style={s.txHash}>{shortHash(tx.blockchain_tx_hash)}</div>
              )}
              <div style={s.date}>{new Date(tx.created_at).toLocaleString()}</div>
            </div>
          </div>
          <div style={s.right}>
            <span style={{ color: STATUS_COLOR[tx.status] ?? "#6e7681", fontSize: 11, fontWeight: 700 }}>
              {tx.status.replace(/_/g, " ").toUpperCase()}
            </span>
            {tx.integrity_hash && (
              <span style={s.intBadge} title="Integrity hash generated">🔐</span>
            )}
            <span style={s.arrow}>›</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  empty: { color: "#6e7681", textAlign: "center", padding: "32px 0", fontSize: 14 },
  list: { display: "flex", flexDirection: "column" },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid #21262d",
    transition: "background 0.1s",
  },
  left: { display: "flex", alignItems: "center", gap: 12 },
  opBadge: { fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 4, color: "#79c0ff", letterSpacing: 0.5, whiteSpace: "nowrap" },
  detail: { fontSize: 13, color: "#e6edf3" },
  txHash: { fontSize: 11, color: "#6e7681", fontFamily: "monospace", marginTop: 2 },
  date: { fontSize: 11, color: "#6e7681", marginTop: 2 },
  right: { display: "flex", alignItems: "center", gap: 8 },
  intBadge: { fontSize: 12 },
  arrow: { color: "#30363d", fontSize: 18 },
};
