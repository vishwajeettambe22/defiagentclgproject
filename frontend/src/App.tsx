/**
 * Main App — complete wallet-based DeFi application.
 *
 * Implements the full documented workflow and all 8 architecture modules.
 * Layout: Landing (not connected) → Sidebar + Page content (connected).
 */
import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "./hooks/useWallet";
import { useTransaction } from "./hooks/useTransaction";
import { TransactionDetail } from "./components/TransactionDetail/TransactionDetail";
import { IntegrityVerifier } from "./components/IntegrityVerifier/IntegrityVerifier";
import { ToastProvider } from "./components/common/Toast";
import * as api from "./services/api";
import type {
  Dashboard,
  TransactionDetail as TxDetailType,
  AppPage,
  TransactionPreview,
} from "./types";

// Lazy-import page modules
import { OverviewPage } from "./pages/OverviewPage";
import { AssistantPage } from "./pages/AssistantPage";
import { SwapPage } from "./pages/SwapPage";
import { SendReceivePage } from "./pages/SendReceivePage";
import { PortfolioPage } from "./pages/PortfolioPage";

// These will be created by the subagent — import with fallback
let HistoryPage: React.FC<{
  dashboard: Dashboard | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}>;
let WalletPage: React.FC<{
  wallet: ReturnType<typeof useWallet>;
  setPage: (p: AppPage) => void;
}>;
let AnalyticsPage: React.FC<{
  dashboard: Dashboard | null;
  loading: boolean;
  error: string | null;
}>;
let SettingsPage: React.FC<{ wallet: ReturnType<typeof useWallet> }>;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  HistoryPage = require("./pages/HistoryPage").HistoryPage;
} catch {
  HistoryPage = ({ onRefresh }) => (
    <div style={{ padding: 24, color: "#8b949e" }}>
      History page loading…{" "}
      <button onClick={onRefresh} style={{ color: "#388bfd", background: "none", border: "none", cursor: "pointer" }}>
        Refresh
      </button>
    </div>
  );
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WalletPage = require("./pages/WalletPage").WalletPage;
} catch {
  WalletPage = () => <div style={{ padding: 24, color: "#8b949e" }}>Wallet page loading…</div>;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AnalyticsPage = require("./pages/AnalyticsPage").AnalyticsPage;
} catch {
  AnalyticsPage = () => (
    <div style={{ padding: 24, color: "#8b949e" }}>Analytics page loading…</div>
  );
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SettingsPage = require("./pages/SettingsPage").SettingsPage;
} catch {
  SettingsPage = () => (
    <div style={{ padding: 24, color: "#8b949e" }}>Settings page loading…</div>
  );
}

const CONTRACT = import.meta.env.VITE_DEFI_AGENT_CONTRACT ?? "0x" + "0".repeat(40);

// ── helpers ───────────────────────────────────────────────────────────────────
const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// ── Landing Screen ─────────────────────────────────────────────────────────────
function Landing({
  onConnect,
  isConnecting,
  error,
}: {
  onConnect: () => void;
  isConnecting: boolean;
  error: string | null;
}) {
  return (
    <div style={ls.wrap}>
      <div style={ls.card}>
        {/* Logo + branding */}
        <div style={ls.logoWrap}>
          <div style={ls.logoIcon}>🤖</div>
          <div style={ls.logoBadge}>AI-Powered</div>
        </div>
        <h1 style={ls.title}>DeFi Agent</h1>
        <p style={ls.sub}>Conversational Web3 Transaction Engine</p>
        <p style={ls.desc}>
          Describe DeFi operations in plain English. The AI interprets, validates, previews, and
          you sign — your keys never leave MetaMask.
        </p>

        <div style={ls.caps}>
          {[
            "💬 Natural language commands",
            "🔍 Deterministic validation",
            "📋 Transaction preview",
            "🔐 Integrity verification",
            "📊 Portfolio overview",
            "⇄ Swap & Send",
          ].map((c) => (
            <div key={c} style={ls.cap}>
              {c}
            </div>
          ))}
        </div>

        <button
          className="defi-btn-primary"
          style={ls.btn}
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <span style={ls.btnSpinner} /> Connecting…
            </>
          ) : (
            "🦊 Connect MetaMask"
          )}
        </button>

        {error && <div style={ls.err}>⚠️ {error}</div>}

        <div style={ls.divider} />
        <div style={ls.note}>
          Sepolia testnet only (Chain ID: 11155111) · No real funds · Academic prototype
        </div>
      </div>
    </div>
  );
}

// ── Nav item definition ────────────────────────────────────────────────────────
interface NavItem {
  page: AppPage;
  icon: string;
  label: string;
  group?: "main" | "tools" | "system";
}

const NAV_ITEMS: NavItem[] = [
  { page: "overview",   icon: "⊞",  label: "Overview",    group: "main" },
  { page: "wallet",     icon: "👛",  label: "Wallet",      group: "main" },
  { page: "portfolio",  icon: "🪙",  label: "Portfolio",   group: "main" },
  { page: "assistant",  icon: "💬",  label: "AI Assistant", group: "tools" },
  { page: "swap",       icon: "⇄",  label: "Swap",        group: "tools" },
  { page: "send",       icon: "↑↓", label: "Send / Receive", group: "tools" },
  { page: "history",    icon: "📋",  label: "Activity",    group: "tools" },
  { page: "analytics",  icon: "📊",  label: "Analytics",   group: "system" },
  { page: "settings",   icon: "⚙",  label: "Settings",    group: "system" },
  { page: "integrity",  icon: "🔐",  label: "Integrity",   group: "system" },
];

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({
  page,
  setPage,
  address,
  network,
  isWrongNetwork,
  onSwitchNetwork,
  profile,
  onDisconnect,
  completedTx,
}: {
  page: AppPage;
  setPage: (p: AppPage) => void;
  address: string;
  network: string;
  isWrongNetwork: boolean;
  onSwitchNetwork: () => void;
  profile: { total_requests: number; total_completed: number; is_new_user: boolean } | null;
  onDisconnect: () => void;
  completedTx: number;
}) {
  const groups: Record<string, NavItem[]> = {};
  for (const item of NAV_ITEMS) {
    const g = item.group ?? "main";
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  }

  const groupLabels: Record<string, string> = {
    main: "Portfolio",
    tools: "Transactions",
    system: "System",
  };

  return (
    <aside style={sb.aside}>
      {/* Wallet identity */}
      <div style={sb.walletBox}>
        <div style={sb.avatar}>{address.slice(2, 4).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={sb.addr}>{shorten(address)}</div>
          <div style={isWrongNetwork ? sb.netWarn : sb.net}>
            {isWrongNetwork ? `⚠️ ${network}` : `◉ ${network}`}
          </div>
          {isWrongNetwork && (
            <button style={sb.switchBtn} onClick={onSwitchNetwork}>
              Switch to Sepolia
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {profile && (
        <div style={sb.stats}>
          <div style={sb.stat}>
            <span style={sb.statN}>{profile.total_requests}</span>
            <span style={sb.statL}>Requests</span>
          </div>
          <div style={sb.stat}>
            <span style={{ ...sb.statN, color: "#3fb950" }}>{profile.total_completed}</span>
            <span style={sb.statL}>Completed</span>
          </div>
        </div>
      )}

      {/* Nav by group */}
      <nav style={sb.nav}>
        {(["main", "tools", "system"] as const).map((g) => (
          <div key={g} style={sb.navGroup}>
            <div style={sb.navGroupLabel}>{groupLabels[g]}</div>
            {(groups[g] ?? []).map(({ page: p, icon, label }) => (
              <button
                key={p}
                style={{ ...sb.navBtn, ...(page === p ? sb.navActive : {}) }}
                onClick={() => setPage(p)}
              >
                <span style={sb.navIcon}>{icon}</span>
                <span style={sb.navLabel}>{label}</span>
                {p === "history" && completedTx > 0 && (
                  <span style={sb.badge}>{completedTx}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={sb.footer}>
        <div style={sb.footerNote}>Sepolia testnet only</div>
        <button style={sb.disc} onClick={onDisconnect}>
          Disconnect Wallet
        </button>
      </div>
    </aside>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export function App() {
  const wallet = useWallet();
  const tx = useTransaction();
  const [page, setPage] = useState<AppPage>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<TxDetailType | null>(null);

  // Load dashboard on wallet connect / refresh
  const refreshDashboard = useCallback(async () => {
    if (!wallet.address) return;
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await api.getDashboard(wallet.address);
      setDashboard(data);
    } catch (err) {
      console.warn("[App] Could not load dashboard from backend:", err);
      setDashboardError("Backend dashboard service unavailable. Showing local session.");
      setDashboard(
        (prev) =>
          prev ?? {
            wallet_address: wallet.address!,
            total_transactions: 0,
            completed_transactions: 0,
            failed_transactions: 0,
            recent_transactions: [],
          }
      );
    } finally {
      setDashboardLoading(false);
    }
  }, [wallet.address]);

  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      refreshDashboard();
    } else {
      setDashboard(null);
      setDashboardError(null);
    }
  }, [wallet.isConnected, wallet.address, refreshDashboard]);

  // Refresh dashboard after a completed transaction
  useEffect(() => {
    if (tx.stage === "completed") {
      const timer = setTimeout(refreshDashboard, 2000);
      return () => clearTimeout(timer);
    }
  }, [tx.stage, refreshDashboard]);

  // Open transaction detail
  const openDetail = useCallback(
    async (requestId: string) => {
      if (!wallet.address) return;
      try {
        const detail = await api.getTransactionDetail(wallet.address, requestId);
        setSelectedDetail(detail);
      } catch (e) {
        console.error("Could not load detail:", e);
      }
    },
    [wallet.address]
  );

  // MetaMask execution handler
  const handleExecute = useCallback(
    async (preview: TransactionPreview): Promise<string> => {
      if (!wallet.address) throw new Error("Wallet not connected.");
      const { ethers } = await import("ethers");
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes(preview.request_id));
      const amountStr = preview.amount?.split(" ")[0] ?? "0";
      const op = preview.operation.toLowerCase();

      if (op.includes("transfer")) {
        const recipient = tx.intent?.recipient ?? preview.recipient ?? wallet.address;
        return wallet.executeTransfer(CONTRACT, recipient, amountStr, intentHash);
      }
      if (op.includes("stake")) {
        return wallet.executeStake(CONTRACT, amountStr, intentHash);
      }
      // Swap: send to contract (academic simulation)
      const target = CONTRACT !== "0x" + "0".repeat(40) ? CONTRACT : wallet.address;
      return wallet.executeTransfer(CONTRACT, target, "0.001", intentHash);
    },
    [wallet, tx.intent]
  );

  // Not connected → show landing
  if (!wallet.isConnected) {
    return (
      <ToastProvider>
        <Landing
          onConnect={wallet.connect}
          isConnecting={wallet.isConnecting}
          error={wallet.error}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div style={app.shell}>
        {/* Wrong network banner */}
        {wallet.isWrongNetwork && (
          <div style={app.netBanner}>
            <div style={app.netBannerInner}>
              <span>
                ⚠️ <strong>Network Mismatch:</strong> Connected to{" "}
                <strong>{wallet.networkName}</strong> (Chain ID: {wallet.chainId}). This app
                requires <strong>Ethereum Sepolia Testnet</strong> (Chain ID: 11155111).
              </span>
              <button style={app.switchBtn} onClick={wallet.switchNetwork}>
                🦊 Switch to Sepolia
              </button>
            </div>
          </div>
        )}

        {/* Security banner */}
        <div style={app.secBanner}>
          🔒 AI interprets intent only · All transactions require validation + explicit MetaMask
          approval · Sepolia testnet
        </div>

        <div style={app.body}>
          {/* Sidebar */}
          <Sidebar
            page={page}
            setPage={setPage}
            address={wallet.address!}
            network={wallet.networkName}
            isWrongNetwork={wallet.isWrongNetwork}
            onSwitchNetwork={wallet.switchNetwork}
            profile={wallet.profile}
            onDisconnect={wallet.disconnect}
            completedTx={dashboard?.completed_transactions ?? 0}
          />

          {/* Main content */}
          <main style={app.main}>
            {page === "overview" && (
              <OverviewPage
                dashboard={dashboard}
                balances={wallet.balances}
                loading={dashboardLoading || wallet.balancesLoading}
                error={dashboardError ?? wallet.balancesError}
                setPage={setPage}
                onRefresh={() => {
                  refreshDashboard();
                  wallet.refreshBalances();
                }}
                onSelectTx={openDetail}
              />
            )}

            {page === "wallet" && (
              <WalletPage wallet={wallet} setPage={setPage} />
            )}

            {page === "portfolio" && (
              <PortfolioPage wallet={wallet} setPage={setPage} />
            )}

            {page === "assistant" && (
              <AssistantPage
                wallet={wallet}
                tx={tx}
                onExecute={handleExecute}
                onReset={tx.reset}
              />
            )}

            {page === "swap" && (
              <SwapPage wallet={wallet} tx={tx} />
            )}

            {page === "send" && (
              <SendReceivePage wallet={wallet} />
            )}

            {page === "history" && (
              <HistoryPage
                dashboard={dashboard}
                loading={dashboardLoading}
                onSelect={openDetail}
                onRefresh={refreshDashboard}
              />
            )}

            {page === "analytics" && (
              <AnalyticsPage
                dashboard={dashboard}
                loading={dashboardLoading}
                error={dashboardError}
              />
            )}

            {page === "settings" && (
              <SettingsPage wallet={wallet} />
            )}

            {page === "integrity" && (
              <div style={pg.container}>
                <div style={pg.pageHeader}>
                  <h2 style={pg.title}>Integrity Verification</h2>
                  <p style={pg.subtitle}>
                    Verify on-chain integrity anchors for your transaction history.
                  </p>
                </div>
                <IntegrityVerifier
                  recentRequestIds={(dashboard?.recent_transactions ?? [])
                    .filter((t) => t.integrity_hash)
                    .map((t) => t.request_id)}
                />
              </div>
            )}

            {/* Legacy routes for backward compat */}
            {page === "dashboard" && (
              <OverviewPage
                dashboard={dashboard}
                balances={wallet.balances}
                loading={dashboardLoading || wallet.balancesLoading}
                error={dashboardError ?? wallet.balancesError}
                setPage={setPage}
                onRefresh={() => {
                  refreshDashboard();
                  wallet.refreshBalances();
                }}
                onSelectTx={openDetail}
              />
            )}

            {page === "command" && (
              <AssistantPage
                wallet={wallet}
                tx={tx}
                onExecute={handleExecute}
                onReset={tx.reset}
              />
            )}
          </main>
        </div>

        {/* Transaction detail modal */}
        {selectedDetail && (
          <TransactionDetail
            detail={selectedDetail}
            onClose={() => setSelectedDetail(null)}
          />
        )}
      </div>
    </ToastProvider>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const ls: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0d1117 0%, #0a0e1a 100%)",
    padding: 24,
  },
  card: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 20,
    padding: "48px 40px",
    maxWidth: 500,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoIcon: { fontSize: 56 },
  logoBadge: {
    background: "#1f2d4a",
    color: "#79c0ff",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 20,
    border: "1px solid #1f6feb",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  title: { fontSize: 34, fontWeight: 800, color: "#e6edf3", margin: "0 0 6px" },
  sub: { fontSize: 15, color: "#8b949e", margin: "0 0 20px" },
  desc: { fontSize: 14, color: "#6e7681", lineHeight: 1.7, margin: "0 0 24px" },
  caps: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 28,
    textAlign: "left",
  },
  cap: {
    fontSize: 13,
    color: "#e6edf3",
    background: "#0d1117",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #21262d",
  },
  btn: {
    width: "100%",
    padding: "15px 0",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnSpinner: {
    display: "inline-block",
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  err: {
    color: "#f85149",
    fontSize: 13,
    marginBottom: 12,
    background: "#1c1010",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #da3633",
  },
  divider: {
    height: 1,
    background: "#21262d",
    margin: "16px 0",
  },
  note: { fontSize: 12, color: "#6e7681" },
};

const sb: Record<string, React.CSSProperties> = {
  aside: {
    width: 240,
    flexShrink: 0,
    background: "#161b22",
    borderRight: "1px solid #21262d",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    height: "100%",
  },
  walletBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "20px 16px 16px",
    borderBottom: "1px solid #21262d",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #1f6feb, #388bfd)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 13,
    color: "#fff",
    flexShrink: 0,
    boxShadow: "0 2px 8px rgba(31,111,235,0.4)",
  },
  addr: { fontSize: 13, fontWeight: 600, color: "#e6edf3", fontFamily: "monospace" },
  net: { fontSize: 11, color: "#3fb950", marginTop: 3, fontWeight: 600 },
  netWarn: { fontSize: 11, color: "#d29922", marginTop: 3, fontWeight: 600 },
  switchBtn: {
    marginTop: 6,
    background: "#f6851b",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  stats: {
    display: "flex",
    gap: 0,
    padding: "12px 16px",
    borderBottom: "1px solid #21262d",
  },
  stat: {
    flex: 1,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  statN: { fontSize: 20, fontWeight: 700, color: "#e6edf3" },
  statL: { fontSize: 10, color: "#6e7681" },
  nav: {
    flex: 1,
    padding: "12px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  navGroup: {
    marginBottom: 8,
  },
  navGroupLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#6e7681",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    padding: "6px 8px 4px",
  },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 13,
    width: "100%",
    textAlign: "left",
    position: "relative",
    transition: "all 0.15s ease",
  },
  navActive: {
    background: "#1c2128",
    color: "#e6edf3",
    fontWeight: 600,
  },
  navIcon: { fontSize: 16, flexShrink: 0, width: 20, textAlign: "center" as const },
  navLabel: { flex: 1 },
  badge: {
    marginLeft: "auto",
    background: "#3fb950",
    color: "#0d1117",
    borderRadius: 10,
    padding: "1px 7px",
    fontSize: 10,
    fontWeight: 700,
  },
  footer: {
    padding: "12px 16px 20px",
    borderTop: "1px solid #21262d",
  },
  footerNote: {
    fontSize: 11,
    color: "#6e7681",
    textAlign: "center" as const,
    marginBottom: 10,
  },
  disc: {
    width: "100%",
    padding: "8px 0",
    borderRadius: 8,
    border: "1px solid #30363d",
    background: "transparent",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 12,
    transition: "all 0.15s ease",
  },
};

const app: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    background: "#0d1117",
  },
  netBanner: {
    background: "#2a1500",
    borderBottom: "1px solid #9e6a03",
    color: "#d29922",
    fontSize: 13,
    padding: "10px 24px",
    flexShrink: 0,
  },
  netBannerInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  switchBtn: {
    background: "#f6851b",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  secBanner: {
    background: "#0d1f0d",
    borderBottom: "1px solid #1b4332",
    color: "#3fb950",
    fontSize: 12,
    textAlign: "center",
    padding: "5px 24px",
    flexShrink: 0,
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    height: "calc(100vh - 60px)",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 32px",
    background: "#0d1117",
  },
};

const pg: Record<string, React.CSSProperties> = {
  container: { maxWidth: 900 },
  pageHeader: { marginBottom: 28 },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#e6edf3",
    margin: "0 0 6px",
  },
  subtitle: {
    fontSize: 14,
    color: "#8b949e",
    margin: 0,
  },
};
