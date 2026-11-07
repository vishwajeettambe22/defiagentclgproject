import React, { useState } from "react";
import { WalletBalances, AppPage } from "../types";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Skeleton } from "../components/common/Skeleton";
import { EmptyState } from "../components/common/EmptyState";

interface WalletPageProps {
  wallet: {
    address: string | null;
    networkName: string;
    chainId: number | null;
    isWrongNetwork: boolean;
    isConnected: boolean;
    balances: WalletBalances | null;
    balancesLoading: boolean;
    profile: {
      total_requests: number;
      total_completed: number;
      is_new_user: boolean;
    } | null;
    switchNetwork: () => void;
    disconnect: () => void;
    refreshBalances: () => void;
  };
  setPage: (p: AppPage) => void;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "24px",
    maxWidth: "700px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#e6edf3",
    margin: 0,
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.8px",
    textTransform: "uppercase" as const,
    color: "#6e7681",
    marginBottom: "10px",
  },
  cardPadding: {
    padding: "20px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  monoAddress: {
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#e6edf3",
    wordBreak: "break-all" as const,
    flex: 1,
  },
  actionRow: {
    display: "flex",
    gap: "8px",
    marginTop: "14px",
    flexWrap: "wrap" as const,
  },
  netName: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  netId: {
    fontSize: "13px",
    color: "#8b949e",
    marginTop: "2px",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "16px",
  },
  statCard: {
    background: "#1c2128",
    borderRadius: "8px",
    padding: "16px",
    textAlign: "center" as const,
    border: "1px solid #30363d",
  },
  statValue: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#e6edf3",
  },
  statLabel: {
    fontSize: "12px",
    color: "#8b949e",
    marginTop: "4px",
  },
  tokenRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid #21262d",
  },
  tokenSymbol: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  tokenName: {
    fontSize: "12px",
    color: "#6e7681",
    marginTop: "2px",
  },
  tokenBalance: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#3fb950",
    fontFamily: "monospace",
  },
  quickActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  warnBox: {
    background: "rgba(210,153,34,0.1)",
    border: "1px solid rgba(210,153,34,0.3)",
    borderRadius: "8px",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "12px",
  },
  warnText: {
    color: "#d29922",
    fontSize: "13px",
    flex: 1,
  },
  externalLink: {
    color: "#1f6feb",
    fontSize: "13px",
    textDecoration: "none",
  },
};

export const WalletPage: React.FC<WalletPageProps> = ({ wallet, setPage }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!wallet.address) return;
    navigator.clipboard.writeText(wallet.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!wallet.isConnected || !wallet.address) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Wallet</h1>
        <EmptyState
          title="No wallet connected"
          description="Connect your MetaMask wallet to view details."
        />
      </div>
    );
  }

  const isSepoliaOk = !wallet.isWrongNetwork && wallet.chainId === 11155111;

  return (
    <div style={styles.page}>
      {/* Header */}
      <h1 style={styles.title}>Wallet</h1>

      {/* Address card */}
      <Card elevated style={styles.cardPadding}>
        <p style={styles.sectionLabel}>Connected Address</p>
        <div style={styles.row}>
          <span style={styles.monoAddress}>{wallet.address}</span>
        </div>
        <div style={styles.actionRow}>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "⎘ Copy Address"}
          </Button>
          <a
            href={`https://sepolia.etherscan.io/address/${wallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.externalLink}
          >
            ↗ View on Etherscan
          </a>
        </div>
      </Card>

      {/* Network card */}
      <Card elevated style={styles.cardPadding}>
        <p style={styles.sectionLabel}>Network</p>
        <div style={styles.row}>
          <div>
            <p style={styles.netName}>{wallet.networkName || "Unknown"}</p>
            {wallet.chainId && <p style={styles.netId}>Chain ID: {wallet.chainId}</p>}
          </div>
          <Badge variant={isSepoliaOk ? "success" : "warning"}>
            {isSepoliaOk ? "Sepolia ✓" : "Wrong Network"}
          </Badge>
        </div>
        {wallet.isWrongNetwork && (
          <div style={styles.warnBox}>
            <span style={{ fontSize: "18px" }}>⚠</span>
            <span style={styles.warnText}>
              Please switch to the Sepolia testnet to use this app.
            </span>
            <Button variant="primary" size="sm" onClick={wallet.switchNetwork}>
              Switch to Sepolia
            </Button>
          </div>
        )}
      </Card>

      {/* Profile stats */}
      {wallet.profile && (
        <Card elevated style={styles.cardPadding}>
          <div style={{ ...styles.row, marginBottom: "14px" }}>
            <p style={{ ...styles.sectionLabel, margin: 0 }}>Profile Stats</p>
            {wallet.profile.is_new_user && <Badge variant="info">New User</Badge>}
          </div>
          <div style={styles.statGrid}>
            <div style={styles.statCard}>
              <p style={styles.statValue}>{wallet.profile.total_requests}</p>
              <p style={styles.statLabel}>Total Requests</p>
            </div>
            <div style={styles.statCard}>
              <p style={{ ...styles.statValue, color: "#3fb950" }}>{wallet.profile.total_completed}</p>
              <p style={styles.statLabel}>Completed</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statValue}>
                {wallet.profile.total_requests > 0
                  ? Math.round(
                      (wallet.profile.total_completed / wallet.profile.total_requests) * 100
                    )
                  : 0}
                %
              </p>
              <p style={styles.statLabel}>Success Rate</p>
            </div>
          </div>
        </Card>
      )}

      {/* Balances card */}
      <Card elevated style={styles.cardPadding}>
        <div style={{ ...styles.row, marginBottom: "14px" }}>
          <p style={{ ...styles.sectionLabel, margin: 0 }}>Token Balances</p>
          <Button variant="outline" size="sm" onClick={wallet.refreshBalances} disabled={wallet.balancesLoading}>
            {wallet.balancesLoading ? "Loading…" : "↻ Refresh"}
          </Button>
        </div>

        {wallet.balancesLoading && !wallet.balances && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={44} style={{ borderRadius: "6px" }} />
            ))}
          </div>
        )}

        {!wallet.balancesLoading && !wallet.balances && (
          <p style={{ color: "#6e7681", fontSize: "14px", textAlign: "center", padding: "16px 0" }}>
            No balance data available.
          </p>
        )}

        {wallet.balances && (
          <>
            {wallet.balances.balances.map((token, idx) => (
              <div
                key={token.symbol}
                style={{
                  ...styles.tokenRow,
                  borderBottom:
                    idx === wallet.balances!.balances.length - 1 ? "none" : "1px solid #21262d",
                }}
              >
                <div>
                  <p style={styles.tokenSymbol}>{token.symbol}</p>
                  <p style={styles.tokenName}>{token.name}</p>
                </div>
                <span style={styles.tokenBalance}>{parseFloat(token.balance).toFixed(4)}</span>
              </div>
            ))}
            <p style={{ fontSize: "11px", color: "#6e7681", marginTop: "12px" }}>
              Updated: {new Date(wallet.balances.fetched_at).toLocaleString()}
            </p>
          </>
        )}
      </Card>

      {/* Quick actions */}
      <Card elevated style={styles.cardPadding}>
        <p style={styles.sectionLabel}>Quick Actions</p>
        <div style={styles.quickActions}>
          <Button variant="primary" size="md" onClick={() => setPage("send")}>
            ↑ Send / Transfer
          </Button>
          <Button variant="secondary" size="md" onClick={() => setPage("swap")}>
            ⇄ Swap Tokens
          </Button>
        </div>
      </Card>
    </div>
  );
};
