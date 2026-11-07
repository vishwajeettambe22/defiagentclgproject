import React from "react";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Skeleton } from "../components/common/Skeleton";
import { EmptyState } from "../components/common/EmptyState";
import type { Dashboard, WalletBalances, AppPage } from "../types";

export interface OverviewPageProps {
  dashboard: Dashboard | null;
  balances: WalletBalances | null;
  loading: boolean;
  error: string | null;
  setPage: (p: AppPage) => void;
  onRefresh: () => void;
  onSelectTx: (id: string) => void;
}

// Reference testnet valuations for user portfolio estimation
const TOKEN_PRICES: Record<string, number> = {
  ETH: 3200.0,
  WETH: 3200.0,
  USDC: 1.0,
  DAI: 1.0,
};

export const OverviewPage: React.FC<OverviewPageProps> = ({
  dashboard,
  balances,
  loading,
  error,
  setPage,
  onRefresh,
  onSelectTx,
}) => {
  // Compute total portfolio value
  let totalUsd = 0;
  const tokenBreakdown: { symbol: string; balance: number; usdValue: number; percent: number }[] = [];

  if (balances?.balances) {
    for (const b of balances.balances) {
      const numBal = parseFloat(b.balance) || 0;
      const price = TOKEN_PRICES[b.symbol.toUpperCase()] ?? 0;
      const val = numBal * price;
      totalUsd += val;
      tokenBreakdown.push({
        symbol: b.symbol,
        balance: numBal,
        usdValue: val,
        percent: 0,
      });
    }

    // Compute percentages
    for (const item of tokenBreakdown) {
      item.percent = totalUsd > 0 ? (item.usdValue / totalUsd) * 100 : 0;
    }
  }

  const recentTxs = dashboard?.recent_transactions ? dashboard.recent_transactions.slice(0, 5) : [];

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "failed":
      case "validation_failed":
        return <Badge variant="danger">Failed</Badge>;
      case "pending":
      case "submitting":
      case "executing":
        return <Badge variant="info">Pending</Badge>;
      case "user_rejected":
      case "user_cancelled":
        return <Badge variant="warning">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status.replace(/_/g, " ")}</Badge>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="animate-fade-in">
      {/* Top Banner if error */}
      {error && (
        <div
          style={{
            padding: "12px 18px",
            backgroundColor: "var(--status-danger-subtle)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-md)",
            color: "var(--status-danger)",
            fontSize: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠️ {error}</span>
          <Button size="sm" variant="outline" onClick={onRefresh}>
            Retry
          </Button>
        </div>
      )}

      {/* Hero Portfolio Card */}
      <Card
        style={{
          background: "linear-gradient(135deg, var(--bg-surface) 0%, rgba(99, 102, 241, 0.08) 100%)",
          border: "1px solid var(--border-accent)",
          padding: "28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Estimated Portfolio Value
            </div>
            {loading && !balances ? (
              <div style={{ marginTop: "8px" }}>
                <Skeleton width="220px" height="42px" />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginTop: "4px" }}>
                <h1 style={{ fontSize: "36px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  ${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h1>
                <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>USD (Sepolia Testnet)</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => setPage("swap")}>
              ⇄ Swap
            </Button>
            <Button variant="secondary" onClick={() => setPage("send")}>
              ↑ Send
            </Button>
            <Button variant="secondary" onClick={() => setPage("send")}>
              ↓ Receive
            </Button>
            <Button variant="outline" onClick={() => setPage("assistant")}>
              💬 Ask AI
            </Button>
          </div>
        </div>

        {/* Asset Distribution Bar */}
        {tokenBreakdown.length > 0 && totalUsd > 0 && (
          <div style={{ marginTop: "24px" }}>
            <div style={{ display: "flex", height: "8px", borderRadius: "var(--radius-full)", overflow: "hidden", gap: "2px" }}>
              {tokenBreakdown.map((item, idx) => {
                const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"];
                return (
                  <div
                    key={item.symbol}
                    style={{
                      width: `${item.percent}%`,
                      backgroundColor: colors[idx % colors.length],
                      height: "100%",
                    }}
                    title={`${item.symbol}: ${item.percent.toFixed(1)}%`}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "18px", marginTop: "12px", flexWrap: "wrap" }}>
              {tokenBreakdown.map((item, idx) => {
                const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"];
                return (
                  <div key={item.symbol} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: colors[idx % colors.length] }} />
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.symbol}:</span>
                    <span style={{ color: "var(--text-secondary)" }}>{item.balance.toFixed(4)} ({item.percent.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Grid of Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <Card>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Total Requests
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px", color: "var(--text-primary)" }}>
            {dashboard?.total_transactions ?? 0}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Commands initiated by your wallet
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Completed On-Chain
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px", color: "var(--status-success)" }}>
            {dashboard?.completed_transactions ?? 0}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Confirmed on Sepolia
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Blocked / Rejected
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px", color: "var(--status-danger)" }}>
            {dashboard?.failed_transactions ?? 0}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Safety rules enforced
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Network Status
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--status-success)" }} />
            <span>Sepolia Testnet</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>
            Chain ID: 11155111
          </div>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>Recent Activity</h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Recent transactions and commands</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPage("history")}>
            View All →
          </Button>
        </div>

        {recentTxs.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No activity recorded yet"
            description="Use the AI Assistant or Swap page to execute your first transaction on Sepolia."
            actionLabel="Start AI Command"
            onAction={() => setPage("assistant")}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentTxs.map((tx) => (
              <div
                key={tx.request_id}
                onClick={() => onSelectTx(tx.request_id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  backgroundColor: "var(--bg-surface-elevated)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-focus)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-surface-hover)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    {tx.operation === "swap" ? "⇄" : tx.operation === "stake" ? "🏛" : "↑"}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {tx.operation.toUpperCase()} {tx.amount ? `${tx.amount} ` : ""}{tx.token ?? ""}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {new Date(tx.created_at).toLocaleTimeString()} · {new Date(tx.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {getStatusBadge(tx.status)}
                  <span style={{ color: "var(--text-muted)", fontSize: "16px" }}>›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

