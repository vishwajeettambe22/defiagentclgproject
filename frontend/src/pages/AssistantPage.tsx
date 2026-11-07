import React from "react";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Chat } from "../components/Chat/Chat";
import { ValidationStatus } from "../components/ValidationStatus/ValidationStatus";
import { TransactionPreview as PreviewCard } from "../components/TransactionPreview/TransactionPreview";
import type { useWallet } from "../hooks/useWallet";
import type { useTransaction } from "../hooks/useTransaction";
import type { TransactionPreview } from "../types";

interface AssistantPageProps {
  wallet: ReturnType<typeof useWallet>;
  tx: ReturnType<typeof useTransaction>;
  onExecute: (preview: TransactionPreview) => Promise<string>;
  onReset: () => void;
}

export const AssistantPage: React.FC<AssistantPageProps> = ({
  wallet,
  tx,
  onExecute,
  onReset,
}) => {
  const isActive = !["idle", "failed", "user_cancelled"].includes(tx.stage);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "800px", margin: "0 auto" }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>AI DeFi Assistant</h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Execute transactions with natural-language commands. Gemini interprets, deterministic rules validate, you sign in MetaMask.
          </p>
        </div>
        <Badge variant="info">Gemini 2.5 Flash</Badge>
      </div>

      {/* Main Chat Component */}
      <Chat
        onSubmit={(inp) => tx.processCommand(inp, wallet.address!)}
        stage={tx.stage}
        intent={tx.intent}
        disabled={isActive && tx.stage !== "awaiting_wallet"}
      />

      {/* Validation Results Visualizer */}
      {tx.validation && (
        <div className="animate-fade-in">
          <ValidationStatus validation={tx.validation} />
        </div>
      )}

      {/* Pre-Execution Preview Card */}
      {tx.stage === "awaiting_wallet" && tx.preview && (
        <div className="animate-fade-in">
          <PreviewCard
            preview={tx.preview}
            walletAddress={wallet.address!}
            onApprove={(hash) => tx.recordExecution(wallet.address!, hash)}
            onReject={tx.cancelByUser}
            onExecute={onExecute}
          />
        </div>
      )}

      {/* Submitting or Pending state card */}
      {(tx.stage === "submitting" || tx.stage === "pending") && (
        <Card style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }} className="animate-fade-in">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "3px solid rgba(99,102,241,0.25)",
              borderTopColor: "var(--accent-primary)",
            }}
            className="animate-spin"
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)" }}>
              {tx.stage === "submitting" ? "Submitting to Sepolia network…" : "Waiting for block confirmation…"}
            </div>
            {tx.execution?.blockchain_tx_hash && (
              <a
                href={tx.execution.explorer_url ?? `https://sepolia.etherscan.io/tx/${tx.execution.blockchain_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "13px", color: "var(--accent-cyan)", display: "inline-block", marginTop: "4px" }}
              >
                View on Etherscan ↗
              </a>
            )}
          </div>
        </Card>
      )}

      {/* Completed State Card */}
      {tx.stage === "completed" && tx.execution && (
        <Card style={{ padding: "24px", border: "1px solid var(--status-success)" }} className="animate-fade-in">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <div style={{ fontSize: "28px" }}>✅</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--status-success)", marginBottom: "4px" }}>
                Transaction Confirmed On-Chain
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                {tx.execution.message}
              </p>
              {tx.confirmation?.block_number && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
                  Confirmed in Block #{tx.confirmation.block_number.toLocaleString()}
                </div>
              )}
              {tx.execution.blockchain_tx_hash && (
                <a
                  href={tx.execution.explorer_url ?? `https://sepolia.etherscan.io/tx/${tx.execution.blockchain_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "13px", color: "var(--accent-cyan)", fontWeight: 600 }}
                >
                  View on Etherscan ↗
                </a>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={onReset}>
              + New Command
            </Button>
          </div>
        </Card>
      )}

      {/* Failed / Blocked State Card */}
      {(tx.stage === "failed" || tx.stage === "user_cancelled") && (
        <Card
          style={{
            padding: "24px",
            border: `1px solid ${tx.stage === "user_cancelled" ? "var(--status-warning)" : "var(--status-danger)"}`,
          }}
          className="animate-fade-in"
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <div style={{ fontSize: "28px" }}>{tx.stage === "user_cancelled" ? "⚠️" : "❌"}</div>
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: tx.stage === "user_cancelled" ? "var(--status-warning)" : "var(--status-danger)",
                  marginBottom: "4px",
                }}
              >
                {tx.stage === "user_cancelled" ? "Transaction Cancelled" : "Transaction Blocked by Security Engine"}
              </h3>
              {tx.error && (
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  {tx.error}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onReset}>
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* Security Architecture Notice */}
      <Card style={{ backgroundColor: "rgba(15, 19, 26, 0.4)", border: "1px dashed var(--border-default)", padding: "16px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span style={{ fontSize: "20px" }}>🛡️</span>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--text-secondary)" }}>Web3 Safety Invariant:</strong> The AI model parses language only and cannot sign or broadcast transactions. Every command is independently verified against spending limits, whitelists, and requires explicit user signature in MetaMask.
          </div>
        </div>
      </Card>
    </div>
  );
};

