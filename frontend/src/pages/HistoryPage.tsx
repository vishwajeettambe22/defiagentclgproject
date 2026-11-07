import React, { useState, useMemo } from "react";
import { Dashboard, TransactionSummary } from "../types";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";

interface HistoryPageProps {
  dashboard: Dashboard | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

type StatusFilter = "all" | "completed" | "failed" | "pending";
type OperationFilter = "all" | "transfer" | "swap" | "stake";

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths !== 1 ? "s" : ""} ago`;
}

function getStatusBadgeVariant(status: string): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
    case "validation_failed":
      return "danger";
    case "pending":
    case "submitting":
      return "warning";
    case "user_cancelled":
      return "neutral";
    default:
      return "info";
  }
}

function matchesStatusFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "completed") return status === "completed";
  if (filter === "failed") return status === "failed" || status === "validation_failed";
  if (filter === "pending") return status === "pending" || status === "submitting";
  return false;
}

function matchesOperationFilter(operation: string, filter: OperationFilter): boolean {
  if (filter === "all") return true;
  return operation === filter;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "24px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "24px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#e6edf3",
    margin: 0,
  },
  filterRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "12px",
    flexWrap: "wrap" as const,
  },
  filterLabel: {
    fontSize: "12px",
    color: "#6e7681",
    alignSelf: "center",
    marginRight: "4px",
    minWidth: "60px",
  },
  filterTab: (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: "6px",
    border: active ? "1px solid #1f6feb" : "1px solid #30363d",
    background: active ? "rgba(31,111,235,0.15)" : "transparent",
    color: active ? "#79c0ff" : "#8b949e",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
    transition: "all 0.15s",
  }),
  txRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    cursor: "pointer",
    borderRadius: "8px",
    transition: "background 0.15s",
    flexWrap: "wrap" as const,
  },
  operationBadge: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: "4px",
    background: "rgba(31,111,235,0.15)",
    color: "#79c0ff",
    border: "1px solid rgba(31,111,235,0.3)",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap" as const,
    minWidth: "60px",
    textAlign: "center" as const,
  },
  tokenAmount: {
    fontSize: "14px",
    color: "#e6edf3",
    fontWeight: 500,
    flex: 1,
    minWidth: "80px",
  },
  timeText: {
    fontSize: "12px",
    color: "#6e7681",
    whiteSpace: "nowrap" as const,
  },
  etherscanLink: {
    fontSize: "12px",
    color: "#1f6feb",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  },
  txList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  skeletonList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  divider: {
    height: "1px",
    background: "#21262d",
    margin: "4px 0",
  },
};

export const HistoryPage: React.FC<HistoryPageProps> = ({ dashboard, loading, onSelect, onRefresh }) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [operationFilter, setOperationFilter] = useState<OperationFilter>("all");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const filteredTransactions = useMemo<TransactionSummary[]>(() => {
    if (!dashboard?.recent_transactions) return [];
    return dashboard.recent_transactions.filter(
      (tx) =>
        matchesStatusFilter(tx.status, statusFilter) &&
        matchesOperationFilter(tx.operation, operationFilter)
    );
  }, [dashboard, statusFilter, operationFilter]);

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "completed", label: "Completed" },
    { key: "failed", label: "Failed" },
    { key: "pending", label: "Pending" },
  ];

  const operationFilters: { key: OperationFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "transfer", label: "Transfer" },
    { key: "swap", label: "Swap" },
    { key: "stake", label: "Stake" },
  ];

  const isInitialLoading = loading && !dashboard;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Activity</h1>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing…" : "↻ Refresh"}
        </Button>
      </div>

      {/* Status filter tabs */}
      <div style={styles.filterRow}>
        <span style={styles.filterLabel}>Status:</span>
        {statusFilters.map((f) => (
          <button
            key={f.key}
            style={styles.filterTab(statusFilter === f.key)}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Operation filter tabs */}
      <div style={{ ...styles.filterRow, marginBottom: "20px" }}>
        <span style={styles.filterLabel}>Type:</span>
        {operationFilters.map((f) => (
          <button
            key={f.key}
            style={styles.filterTab(operationFilter === f.key)}
            onClick={() => setOperationFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {isInitialLoading && (
        <div style={styles.skeletonList}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height={56} style={{ borderRadius: "8px" }} />
          ))}
        </div>
      )}

      {/* Transaction list */}
      {!isInitialLoading && (
        <>
          {filteredTransactions.length === 0 ? (
            <EmptyState
              title="No transactions found"
              description={
                statusFilter !== "all" || operationFilter !== "all"
                  ? "Try adjusting the filters above."
                  : "Your transactions will appear here once you start using the app."
              }
            />
          ) : (
            <div style={styles.txList}>
              {filteredTransactions.map((tx, idx) => (
                <React.Fragment key={tx.request_id}>
                  <Card
                    elevated
                    hoverable
                    style={{ padding: 0 }}
                    onClick={() => onSelect(tx.request_id)}
                  >
                    <div
                      style={{
                        ...styles.txRow,
                        background: hoveredRow === tx.request_id ? "rgba(255,255,255,0.03)" : "transparent",
                      }}
                      onMouseEnter={() => setHoveredRow(tx.request_id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {/* Operation badge */}
                      <span style={styles.operationBadge}>{tx.operation.toUpperCase()}</span>

                      {/* Token + amount */}
                      <span style={styles.tokenAmount}>
                        {tx.token && tx.amount ? (
                          <>
                            <span style={{ color: "#e6edf3" }}>{tx.amount}</span>{" "}
                            <span style={{ color: "#8b949e" }}>{tx.token}</span>
                          </>
                        ) : tx.token ? (
                          <span style={{ color: "#8b949e" }}>{tx.token}</span>
                        ) : (
                          <span style={{ color: "#6e7681", fontSize: "13px" }}>—</span>
                        )}
                      </span>

                      {/* Status badge */}
                      <Badge variant={getStatusBadgeVariant(tx.status)}>
                        {tx.status.replace(/_/g, " ")}
                      </Badge>

                      {/* Time */}
                      <span style={styles.timeText}>{getRelativeTime(tx.created_at)}</span>

                      {/* Etherscan link */}
                      {tx.blockchain_tx_hash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${tx.blockchain_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.etherscanLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ↗ Etherscan
                        </a>
                      )}
                    </div>
                  </Card>
                  {idx < filteredTransactions.length - 1 && <div style={styles.divider} />}
                </React.Fragment>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
