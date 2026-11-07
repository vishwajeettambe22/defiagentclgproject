/**
 * Dashboard component — overview stats and recent transactions.
 * Module 8: Dashboard / Transaction History.
 * FR-08: Transaction history and integrity support.
 */

import React from "react";
import type { Dashboard as DashboardData, TransactionSummary } from "../../types";
import { TransactionHistory } from "../TransactionHistory/TransactionHistory";

interface Props {
  dashboard: DashboardData | null;
  onVerifyIntegrity: (requestId: string) => void;
  onRefresh: () => void;
}

export function Dashboard({ dashboard, onVerifyIntegrity, onRefresh }: Props) {
  if (!dashboard) {
    return (
      <div style={styles.empty}>
        Connect your wallet to view your transaction history.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.statsRow}>
        <StatCard label="Total" value={dashboard.total_transactions} />
        <StatCard label="Completed" value={dashboard.completed_transactions} color="#3fb950" />
        <StatCard label="Failed" value={dashboard.failed_transactions} color="#f85149" />
        <button style={styles.refreshBtn} onClick={onRefresh}>↻ Refresh</button>
      </div>

      <div style={styles.historySection}>
        <h3 style={styles.sectionTitle}>Recent Transactions</h3>
        <TransactionHistory
          transactions={dashboard.recent_transactions}
          onSelect={onVerifyIntegrity}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color: color || "#e6edf3" }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {},
  empty: { color: "#6e7681", textAlign: "center", padding: 24, fontSize: 14 },
  statsRow: { display: "flex", gap: 12, marginBottom: 24, alignItems: "center" },
  statCard: {
    background: "#161b22", border: "1px solid #30363d", borderRadius: 10,
    padding: "12px 20px", textAlign: "center", minWidth: 80,
  },
  statValue: { fontSize: 28, fontWeight: 700 },
  statLabel: { fontSize: 12, color: "#6e7681", marginTop: 2 },
  historySection: {},
  sectionTitle: { fontSize: 15, fontWeight: 600, color: "#e6edf3", marginBottom: 12 },
  refreshBtn: {
    marginLeft: "auto", padding: "8px 16px", borderRadius: 6, border: "1px solid #30363d",
    background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: 13,
  },
};
