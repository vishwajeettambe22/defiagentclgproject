import React, { useState, useMemo } from "react";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { useToast } from "../components/common/Toast";
import type { useWallet } from "../hooks/useWallet";
import type { useTransaction } from "../hooks/useTransaction";
import { SEPOLIA_TOKENS } from "../hooks/useWallet";

interface SwapPageProps {
  wallet: ReturnType<typeof useWallet>;
  tx: ReturnType<typeof useTransaction>;
}

// Reference testnet exchange rates
const RATES_TO_USD: Record<string, number> = {
  ETH: 3200.0,
  WETH: 3200.0,
  USDC: 1.0,
  DAI: 1.0,
};

export const SwapPage: React.FC<SwapPageProps> = ({ wallet, tx }) => {
  const { toast } = useToast();
  const [tokenIn, setTokenIn] = useState<string>("USDC");
  const [tokenOut, setTokenOut] = useState<string>("ETH");
  const [amountIn, setAmountIn] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5); // 0.5% default
  const [customSlippage, setCustomSlippage] = useState<string>("");
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [swapTxHash, setSwapTxHash] = useState<string | null>(null);

  // Available tokens: ETH + configured Sepolia tokens
  const allTokens = useMemo(() => {
    return [
      { symbol: "ETH", name: "Ether (Native Sepolia)", decimals: 18, address: "0x0000000000000000000000000000000000000000" },
      ...SEPOLIA_TOKENS,
    ];
  }, []);

  // Get balance for token
  const getBalance = (sym: string): number => {
    if (!wallet.balances?.balances) return 0;
    const found = wallet.balances.balances.find((b) => b.symbol.toUpperCase() === sym.toUpperCase());
    return found ? parseFloat(found.balance) || 0 : 0;
  };

  const balanceIn = getBalance(tokenIn);
  const balanceOut = getBalance(tokenOut);

  // Dynamic price calculation
  const rateInUsd = RATES_TO_USD[tokenIn] ?? 1;
  const rateOutUsd = RATES_TO_USD[tokenOut] ?? 1;
  const exchangeRate = rateInUsd / rateOutUsd;

  const parsedAmountIn = parseFloat(amountIn) || 0;
  const estimatedAmountOut = parsedAmountIn * exchangeRate;
  const effectiveSlippage = customSlippage ? parseFloat(customSlippage) || 0.5 : slippage;
  const minimumReceived = estimatedAmountOut * (1 - effectiveSlippage / 100);
  const estimatedGasUsd = 0.0012 * 3200; // ~0.0012 ETH on Sepolia

  const hasInsufficientBalance = parsedAmountIn > balanceIn;

  // Swap direction reversal
  const handleReverse = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(estimatedAmountOut > 0 ? estimatedAmountOut.toFixed(6) : "");
  };

  // Submit swap via MetaMask
  const handleInitiateSwap = async () => {
    if (parsedAmountIn <= 0) {
      toast("Please enter a valid amount", "warning");
      return;
    }
    if (hasInsufficientBalance) {
      toast(`Insufficient ${tokenIn} balance`, "error");
      return;
    }
    setShowPreviewModal(true);
  };

  const handleConfirmSwap = async () => {
    setIsSwapping(true);
    setSwapTxHash(null);
    try {
      const contract = import.meta.env.VITE_DEFI_AGENT_CONTRACT || "0x0000000000000000000000000000000000000000";
      // Generate synthetic intent hash for audit tracking
      const { ethers } = await import("ethers");
      const pseudoId = `swap-${Date.now()}`;
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes(pseudoId));

      toast("Please sign the transaction in MetaMask...", "info");

      let hash = "";
      if (tokenIn === "ETH") {
        // Transfer native ETH
        hash = await wallet.executeTransfer(contract, contract, amountIn, intentHash);
      } else {
        // Swap simulation using contract call
        hash = await wallet.executeTransfer(contract, wallet.address!, "0.0001", intentHash);
      }

      setSwapTxHash(hash);
      toast("Swap transaction submitted to Sepolia!", "success");
      wallet.refreshBalances();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Swap transaction was rejected or failed.";
      toast(msg.slice(0, 80), "error");
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto" }} className="animate-fade-in">
      <Card style={{ padding: "24px", position: "relative" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>Swap Tokens</h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Instant decentralized exchange on Sepolia</p>
          </div>
          <Badge variant="info">Sepolia DEX</Badge>
        </div>

        {/* Input: Sell / From */}
        <div
          style={{
            backgroundColor: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "16px",
            marginBottom: "6px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
            <span>You pay</span>
            <span>
              Balance: {balanceIn.toFixed(4)}{" "}
              <button
                onClick={() => setAmountIn(balanceIn.toString())}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-primary)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "11px",
                  marginLeft: "4px",
                }}
              >
                MAX
              </button>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "26px",
                fontWeight: 700,
                color: "var(--text-primary)",
                fontFamily: "inherit",
              }}
            />

            <select
              value={tokenIn}
              onChange={(e) => {
                if (e.target.value === tokenOut) handleReverse();
                else setTokenIn(e.target.value);
              }}
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {allTokens.map((t) => (
                <option key={t.symbol} value={t.symbol} style={{ backgroundColor: "#151a24" }}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
            ~${(parsedAmountIn * rateInUsd).toFixed(2)} USD
          </div>
        </div>

        {/* Flip button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "-12px 0", position: "relative", zIndex: 2 }}>
          <button
            onClick={handleReverse}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "var(--bg-surface-elevated)",
              border: "2px solid var(--border-default)",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-sm)",
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)";
              (e.currentTarget as HTMLElement).style.transform = "rotate(180deg)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
              (e.currentTarget as HTMLElement).style.transform = "rotate(0deg)";
            }}
            title="Invert tokens"
          >
            ⇅
          </button>
        </div>

        {/* Output: Receive / To */}
        <div
          style={{
            backgroundColor: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "16px",
            marginTop: "6px",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
            <span>You receive (estimated)</span>
            <span>Balance: {balanceOut.toFixed(4)}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input
              type="text"
              readOnly
              placeholder="0.0"
              value={estimatedAmountOut > 0 ? estimatedAmountOut.toFixed(6) : ""}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "26px",
                fontWeight: 700,
                color: "var(--text-primary)",
                fontFamily: "inherit",
              }}
            />

            <select
              value={tokenOut}
              onChange={(e) => {
                if (e.target.value === tokenIn) handleReverse();
                else setTokenOut(e.target.value);
              }}
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {allTokens.map((t) => (
                <option key={t.symbol} value={t.symbol} style={{ backgroundColor: "#151a24" }}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
            ~${(estimatedAmountOut * rateOutUsd).toFixed(2)} USD
          </div>
        </div>

        {/* Pricing details card */}
        {parsedAmountIn > 0 && (
          <div
            style={{
              padding: "12px 14px",
              backgroundColor: "rgba(15, 19, 26, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              marginBottom: "18px",
              fontSize: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Exchange Rate</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                1 {tokenIn} = {exchangeRate.toFixed(6)} {tokenOut}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Slippage Tolerance</span>
              <span style={{ color: "var(--text-primary)" }}>{effectiveSlippage}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Minimum Received</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {minimumReceived.toFixed(6)} {tokenOut}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Estimated Gas Fee</span>
              <span style={{ color: "var(--status-success)" }}>~${estimatedGasUsd.toFixed(2)} (Sepolia)</span>
            </div>
          </div>
        )}

        {/* Slippage Selector */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 600 }}>
            Slippage Tolerance
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {[0.1, 0.5, 1.0].map((val) => (
              <button
                key={val}
                onClick={() => {
                  setSlippage(val);
                  setCustomSlippage("");
                }}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${slippage === val && !customSlippage ? "var(--accent-primary)" : "var(--border-default)"}`,
                  backgroundColor: slippage === val && !customSlippage ? "var(--accent-primary-subtle)" : "var(--bg-surface-elevated)",
                  color: slippage === val && !customSlippage ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                {val}%
              </button>
            ))}
            <input
              type="number"
              placeholder="Custom %"
              value={customSlippage}
              onChange={(e) => setCustomSlippage(e.target.value)}
              style={{
                width: "90px",
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-surface-elevated)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Swap Action Button */}
        <Button
          variant={hasInsufficientBalance ? "danger" : "primary"}
          size="lg"
          style={{ width: "100%" }}
          disabled={parsedAmountIn <= 0 || hasInsufficientBalance || isSwapping}
          onClick={handleInitiateSwap}
        >
          {hasInsufficientBalance
            ? `Insufficient ${tokenIn} Balance`
            : parsedAmountIn <= 0
            ? "Enter an Amount"
            : `Swap ${tokenIn} for ${tokenOut}`}
        </Button>
      </Card>

      {/* Confirmation Modal */}
      <Modal isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} title="Confirm Token Swap">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>You Pay</span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                {amountIn} {tokenIn}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>You Receive</span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-cyan)" }}>
                ≈ {estimatedAmountOut.toFixed(6)} {tokenOut}
              </span>
            </div>
            <div style={{ height: "1px", backgroundColor: "var(--border-subtle)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
              <span>Minimum after slippage</span>
              <span>{minimumReceived.toFixed(6)} {tokenOut}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
              <span>Network</span>
              <span>Sepolia Testnet (11155111)</span>
            </div>
          </div>

          {swapTxHash ? (
            <div
              style={{
                padding: "12px",
                backgroundColor: "var(--status-success-subtle)",
                border: "1px solid var(--status-success)",
                borderRadius: "var(--radius-md)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--status-success)" }}>
                Transaction Submitted!
              </div>
              <a
                href={`https://sepolia.etherscan.io/tx/${swapTxHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "12px", color: "var(--status-info)", marginTop: "4px", display: "inline-block" }}
              >
                View on Etherscan ↗
              </a>
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
              🔒 MetaMask will open to prompt your explicit transaction signature. Funds will not move without approval.
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              variant="outline"
              style={{ flex: 1 }}
              onClick={() => {
                setShowPreviewModal(false);
                setSwapTxHash(null);
              }}
            >
              {swapTxHash ? "Close" : "Cancel"}
            </Button>
            {!swapTxHash && (
              <Button variant="primary" style={{ flex: 1 }} loading={isSwapping} onClick={handleConfirmSwap}>
                Confirm in Wallet
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

