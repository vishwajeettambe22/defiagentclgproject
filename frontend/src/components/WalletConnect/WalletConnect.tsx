/**
 * WalletConnect component.
 * FR-06: Non-custodial wallet connection (MetaMask).
 * The app NEVER asks for private keys or seed phrases.
 */

import React from "react";

interface Props {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  chainId: number | null;
  networkName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchNetwork?: () => void;
}

const SEPOLIA_CHAIN_ID = 11155111;

function shorten(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletConnect({
  address,
  isConnected,
  isConnecting,
  error,
  chainId,
  networkName,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
}: Props) {
  const isWrongNetwork = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  return (
    <div style={styles.container}>
      {!isConnected ? (
        <button style={styles.connectBtn} onClick={onConnect} disabled={isConnecting}>
          {isConnecting ? "Connecting..." : "🦊 Connect MetaMask"}
        </button>
      ) : (
        <div style={styles.connected}>
          <div style={styles.addressBadge}>
            <span style={isWrongNetwork ? styles.dotWarn : styles.dot} />
            <span>{shorten(address!)}</span>
          </div>

          {isWrongNetwork ? (
            <div style={styles.mismatchGroup}>
              <span style={styles.networkWarning}>
                ⚠️ {networkName ?? `Chain ${chainId}`} (Sepolia required)
              </span>
              {onSwitchNetwork && (
                <button style={styles.switchBtn} onClick={onSwitchNetwork}>
                  Switch to Sepolia
                </button>
              )}
            </div>
          ) : (
            <span style={styles.networkBadge}>Sepolia</span>
          )}

          <button style={styles.disconnectBtn} onClick={onDisconnect}>Disconnect</button>
        </div>
      )}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 8 },
  connectBtn: {
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: "#f6851b", color: "white", cursor: "pointer",
    fontWeight: 600, fontSize: 14,
  },
  connected: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  addressBadge: {
    display: "flex", alignItems: "center", gap: 6,
    background: "#161b22", border: "1px solid #30363d",
    borderRadius: 8, padding: "6px 12px", fontSize: 13,
  },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#3fb950", display: "inline-block" },
  dotWarn: { width: 8, height: 8, borderRadius: "50%", background: "#d29922", display: "inline-block" },
  networkBadge: {
    fontSize: 12, background: "#1a3a5c", color: "#79c0ff",
    padding: "3px 8px", borderRadius: 12, fontWeight: 600,
  },
  mismatchGroup: { display: "flex", alignItems: "center", gap: 8 },
  networkWarning: { fontSize: 12, color: "#d29922", fontWeight: 600 },
  switchBtn: {
    background: "#f6851b", color: "#fff", border: "none", borderRadius: 6,
    padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer",
  },
  disconnectBtn: {
    padding: "5px 12px", borderRadius: 6, border: "1px solid #30363d",
    background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: 12,
  },
  error: { color: "#f85149", fontSize: 13, background: "#1c1010", padding: "8px 12px", borderRadius: 6 },
};
