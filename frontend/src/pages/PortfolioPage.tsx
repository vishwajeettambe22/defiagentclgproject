import React, { useState } from "react";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Skeleton } from "../components/common/Skeleton";
import { EmptyState } from "../components/common/EmptyState";
import type { useWallet } from "../hooks/useWallet";
import type { AppPage } from "../types";

interface PortfolioPageProps {
  wallet: ReturnType<typeof useWallet>;
  setPage: (p: AppPage) => void;
}

const TOKEN_METADATA: Record<string, { price: number; change24h: number; icon: string }> = {
  ETH: { price: 3200.0, change24h: 2.4, icon: "⟠" },
  WETH: { price: 3200.0, change24h: 2.4, icon: "⟠" },
  USDC: { price: 1.0, change24h: 0.01, icon: "💲" },
  DAI: { price: 1.0, change24h: -0.02, icon: "◈" },
};

export const PortfolioPage: React.FC<PortfolioPageProps> = ({ wallet, setPage }) => {
  const [search, setSearch] = useState<string>("");

  const balances = wallet.balances?.balances ?? [];
  const loading = wallet.balancesLoading;

  // Filter tokens
  const filteredTokens = balances.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  // Compute total portfolio value
  let totalUsd = 0;
  for (const b of balances) {
    const num = parseFloat(b.balance) || 0;
    const price = TOKEN_METADATA[b.symbol.toUpperCase()]?.price ?? 1;
    totalUsd += num * price;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="animate-fade-in">
      {/* Portfolio Header Banner */}
      <Card
        style={{
          background: "linear-gradient(135deg, var(--bg-surface) 0%, rgba(99, 102, 241, 0.08) 100%)",
          border: "1px solid var(--border-accent)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Total Balance
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "4px" }}>
              <h1 style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)" }}>
                ${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h1>
              <Badge variant="success">+1.8% 24h</Badge>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              {(totalUsd / 3200).toFixed(4)} ETH equivalent
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Button variant="secondary" onClick={() => wallet.refreshBalances()} loading={loading}>
              ↻ Refresh Balances
            </Button>
            <Button variant="primary" onClick={() => setPage("swap")}>
              ⇄ Swap
            </Button>
          </div>
        </div>
      </Card>

      {/* Asset Table Card */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Your Assets</h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Token balances on Ethereum Sepolia</p>
          </div>

          <div style={{ width: "240px" }}>
            <input
              type="text"
              placeholder="Search token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="defi-input"
              style={{ padding: "8px 12px", fontSize: "13px" }}
            />
          </div>
        </div>

        {loading && balances.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Skeleton height="56px" />
            <Skeleton height="56px" />
            <Skeleton height="56px" />
          </div>
        ) : filteredTokens.length === 0 ? (
          <EmptyState
            icon="🪙"
            title="No tokens found"
            description="Could not find any tokens matching your search criteria."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Asset</th>
                  <th style={{ padding: "12px 16px" }}>Price</th>
                  <th style={{ padding: "12px 16px" }}>Balance</th>
                  <th style={{ padding: "12px 16px" }}>USD Value</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((t) => {
                  const numBal = parseFloat(t.balance) || 0;
                  const meta = TOKEN_METADATA[t.symbol.toUpperCase()] ?? { price: 1.0, change24h: 0, icon: "🪙" };
                  const valueUsd = numBal * meta.price;

                  return (
                    <tr
                      key={t.symbol}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-surface-elevated)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: "var(--bg-surface-elevated)",
                              border: "1px solid var(--border-default)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "18px",
                            }}
                          >
                            {meta.icon}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{t.name}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.symbol}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                        ${meta.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <div style={{ fontSize: "11px", color: meta.change24h >= 0 ? "var(--status-success)" : "var(--status-danger)" }}>
                          {meta.change24h >= 0 ? `+${meta.change24h}%` : `${meta.change24h}%`}
                        </div>
                      </td>

                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {numBal.toFixed(4)} {t.symbol}
                      </td>

                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                        ${valueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <Button size="sm" variant="secondary" onClick={() => setPage("swap")}>
                            Swap
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setPage("send")}>
                            Send
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sepolia Faucet Help Card */}
      <Card style={{ backgroundColor: "rgba(15, 19, 26, 0.4)", border: "1px dashed var(--border-default)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
              Need more testnet tokens for testing?
            </h4>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              You can claim free Sepolia testnet ETH and Circle test USDC directly from official faucets.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <a
              href="https://sepoliafaucet.com"
              target="_blank"
              rel="noreferrer"
              className="defi-btn defi-btn-outline defi-btn-sm"
            >
              Alchemy Faucet ↗
            </a>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              className="defi-btn defi-btn-outline defi-btn-sm"
            >
              Circle USDC Faucet ↗
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
};

