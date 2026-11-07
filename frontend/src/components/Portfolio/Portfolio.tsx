import React from "react";
import type { WalletBalances } from "../../types";

interface Props {
  balances: WalletBalances | null;
  loading: boolean;
  error?: string | null;
  isWrongNetwork?: boolean;
  onSwitchNetwork?: () => void;
  onRefresh: () => void;
}

const TOKEN_ICONS: Record<string, string> = { ETH: "⟠", USDC: "◎", DAI: "◈", WETH: "⟠" };

export function Portfolio({ balances, loading, error, isWrongNetwork, onSwitchNetwork, onRefresh }: Props) {
  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={s.title}>Portfolio</span>
          <span style={s.networkBadge}>Sepolia</span>
        </div>
        <button style={s.refresh} onClick={onRefresh} disabled={loading} title="Refresh Balances">
          {loading ? "…" : "↻"}
        </button>
      </div>

      {isWrongNetwork && (
        <div style={s.netWarning}>
          <div style={{ fontSize: 11, marginBottom: 4 }}>MetaMask is on a different network.</div>
          <button style={s.switchSmallBtn} onClick={onSwitchNetwork}>
            Switch to Sepolia
          </button>
        </div>
      )}

      {error && !loading && (
        <div style={s.errorBox}>
          <div style={s.errorText}>{error}</div>
          <button style={s.retryBtn} onClick={onRefresh}>↻ Retry</button>
        </div>
      )}

      {!balances && !loading && !error && (
        <div style={s.empty}>Connect wallet to view balances</div>
      )}

      {loading && (
        <div style={s.loading}>
          <div style={s.spinner} />
          <span>Loading balances…</span>
        </div>
      )}

      {balances && !loading && (
        <>
          {balances.balances.map((tok) => (
            <div key={tok.symbol} style={s.row}>
              <div style={s.rowLeft}>
                <span style={s.icon}>{TOKEN_ICONS[tok.symbol] ?? "◆"}</span>
                <div>
                  <div style={s.symbol}>{tok.symbol}</div>
                  <div style={s.name}>{tok.name}</div>
                </div>
              </div>
              <div style={s.balance}>{tok.balance}</div>
            </div>
          ))}
          {balances.block_number && (
            <div style={s.block}>Block #{balances.block_number.toLocaleString()}</div>
          )}
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 20 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 14, fontWeight: 700, color: "#e6edf3" },
  networkBadge: { fontSize: 10, background: "#1a3a5c", color: "#79c0ff", padding: "1px 6px", borderRadius: 10, fontWeight: 600 },
  refresh: { background: "transparent", border: "none", color: "#6e7681", cursor: "pointer", fontSize: 16 },
  netWarning: { background: "#2a1500", border: "1px solid #9e6a03", color: "#d29922", borderRadius: 8, padding: "8px 10px", marginBottom: 12 },
  switchSmallBtn: { background: "#f6851b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  errorBox: { background: "#1c1010", border: "1px solid #da3633", borderRadius: 8, padding: "10px 12px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 },
  errorText: { color: "#f85149", fontSize: 12, lineHeight: 1.4 },
  retryBtn: { background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", alignSelf: "flex-start" },
  empty: { color: "#6e7681", fontSize: 13, textAlign: "center", padding: "16px 0" },
  loading: { display: "flex", gap: 8, alignItems: "center", color: "#6e7681", fontSize: 13, padding: "12px 0" },
  spinner: { width: 14, height: 14, borderRadius: "50%", border: "2px solid #30363d", borderTopColor: "#1f6feb", animation: "spin 1s linear infinite" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #21262d" },
  rowLeft: { display: "flex", alignItems: "center", gap: 10 },
  icon: { fontSize: 20, width: 28, textAlign: "center" },
  symbol: { fontSize: 14, fontWeight: 600, color: "#e6edf3" },
  name: { fontSize: 11, color: "#6e7681", marginTop: 1 },
  balance: { fontSize: 14, fontWeight: 600, color: "#79c0ff", fontFamily: "monospace" },
  block: { marginTop: 12, fontSize: 11, color: "#6e7681", textAlign: "right" },
};
