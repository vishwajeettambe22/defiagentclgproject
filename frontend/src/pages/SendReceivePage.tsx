import React, { useState } from "react";
import { ethers } from "ethers";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { QRCode } from "../components/common/QRCode";
import { useToast } from "../components/common/Toast";
import type { useWallet } from "../hooks/useWallet";
import { SEPOLIA_TOKENS } from "../hooks/useWallet";

interface SendReceivePageProps {
  wallet: ReturnType<typeof useWallet>;
}

export const SendReceivePage: React.FC<SendReceivePageProps> = ({ wallet }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"send" | "receive">("send");
  const [selectedToken, setSelectedToken] = useState<string>("ETH");
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [sentTxHash, setSentTxHash] = useState<string | null>(null);

  const allTokens = [
    { symbol: "ETH", name: "Ether (Native)", decimals: 18, address: ethers.ZeroAddress },
    ...SEPOLIA_TOKENS,
  ];

  // Get balance for selected token
  const getSelectedBalance = (): number => {
    if (!wallet.balances?.balances) return 0;
    const found = wallet.balances.balances.find((b) => b.symbol.toUpperCase() === selectedToken.toUpperCase());
    return found ? parseFloat(found.balance) || 0 : 0;
  };

  const balance = getSelectedBalance();
  const parsedAmount = parseFloat(amount) || 0;

  // Address validation
  const isValidRecipient = ethers.isAddress(recipient) && recipient !== ethers.ZeroAddress;
  const isSelfTransfer = recipient.toLowerCase() === wallet.address?.toLowerCase();
  const hasInsufficientBalance = parsedAmount > balance;

  const handleInitiateSend = () => {
    if (!recipient.trim()) {
      toast("Please enter a recipient address", "warning");
      return;
    }
    if (!isValidRecipient) {
      toast("Invalid Ethereum address format", "error");
      return;
    }
    if (isSelfTransfer) {
      toast("Cannot transfer to yourself", "warning");
      return;
    }
    if (parsedAmount <= 0) {
      toast("Please enter a valid amount", "warning");
      return;
    }
    if (hasInsufficientBalance) {
      toast(`Insufficient ${selectedToken} balance`, "error");
      return;
    }
    setShowPreviewModal(true);
  };

  const handleConfirmSend = async () => {
    setIsSending(true);
    setSentTxHash(null);
    try {
      const contract = import.meta.env.VITE_DEFI_AGENT_CONTRACT || ethers.ZeroAddress;
      const pseudoId = `send-${Date.now()}`;
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes(pseudoId));

      toast("Please sign the transfer in MetaMask...", "info");

      let hash = "";
      if (selectedToken === "ETH") {
        hash = await wallet.executeTransfer(contract, recipient, amount, intentHash);
      } else {
        // Direct ERC-20 transfer via BrowserProvider
        const tokenMeta = SEPOLIA_TOKENS.find((t) => t.symbol === selectedToken);
        if (!tokenMeta || !window.ethereum) throw new Error("Token metadata or wallet unavailable.");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const erc20 = new ethers.Contract(
          tokenMeta.address,
          ["function transfer(address to, uint256 amount) returns (bool)"],
          signer
        );
        const rawAmount = ethers.parseUnits(amount, tokenMeta.decimals);
        const tx = await erc20.transfer(recipient, rawAmount);
        await tx.wait();
        hash = tx.hash;
      }

      setSentTxHash(hash);
      toast("Transfer submitted successfully!", "success");
      wallet.refreshBalances();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transfer was rejected or failed.";
      toast(msg.slice(0, 80), "error");
    } finally {
      setIsSending(false);
    }
  };

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      toast("Address copied to clipboard!", "success");
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto" }} className="animate-fade-in">
      <Card style={{ padding: "24px" }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            backgroundColor: "var(--bg-surface-elevated)",
            padding: "4px",
            borderRadius: "var(--radius-md)",
            marginBottom: "24px",
          }}
        >
          <button
            onClick={() => setActiveTab("send")}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: "14px",
              fontWeight: 700,
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeTab === "send" ? "var(--accent-primary)" : "transparent",
              color: activeTab === "send" ? "#ffffff" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            ↑ Send
          </button>
          <button
            onClick={() => setActiveTab("receive")}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: "14px",
              fontWeight: 700,
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeTab === "receive" ? "var(--accent-primary)" : "transparent",
              color: activeTab === "receive" ? "#ffffff" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            ↓ Receive
          </button>
        </div>

        {activeTab === "send" ? (
          <div>
            {/* Asset Selection */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
                Asset
              </label>
              <select
                className="defi-input"
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                style={{ cursor: "pointer", fontWeight: 600 }}
              >
                {allTokens.map((t) => (
                  <option key={t.symbol} value={t.symbol} style={{ backgroundColor: "#151a24" }}>
                    {t.name} ({t.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Address */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600 }}>Recipient Address</span>
                {recipient && isValidRecipient && <span style={{ color: "var(--status-success)" }}>✓ Valid Address</span>}
              </div>
              <input
                className="defi-input"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                style={{
                  borderColor: recipient && !isValidRecipient ? "var(--status-danger)" : undefined,
                }}
              />
              {recipient && !isValidRecipient && (
                <div style={{ fontSize: "11px", color: "var(--status-danger)", marginTop: "4px" }}>
                  Please enter a valid 42-character Ethereum address
                </div>
              )}
            </div>

            {/* Amount */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600 }}>Amount</span>
                <span>
                  Available: {balance.toFixed(4)} {selectedToken}{" "}
                  <button
                    onClick={() => setAmount(balance.toString())}
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
              <input
                type="number"
                className="defi-input"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Send Button */}
            <Button
              variant={hasInsufficientBalance ? "danger" : "primary"}
              size="lg"
              style={{ width: "100%" }}
              disabled={!isValidRecipient || parsedAmount <= 0 || hasInsufficientBalance || isSending}
              onClick={handleInitiateSend}
            >
              {hasInsufficientBalance
                ? `Insufficient ${selectedToken} Balance`
                : !recipient
                ? "Enter Recipient"
                : !isValidRecipient
                ? "Invalid Recipient Address"
                : parsedAmount <= 0
                ? "Enter Amount"
                : `Send ${amount} ${selectedToken}`}
            </Button>
          </div>
        ) : (
          /* Receive Tab */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ marginBottom: "20px" }}>
              <QRCode address={wallet.address ?? "0x0000000000000000000000000000000000000000"} size={190} />
            </div>

            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
              Your Sepolia Testnet Address
            </div>

            <div
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "var(--bg-surface-elevated)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                fontFamily: "monospace",
                wordBreak: "break-all",
                marginBottom: "16px",
              }}
            >
              {wallet.address}
            </div>

            <Button variant="primary" style={{ width: "100%", marginBottom: "16px" }} onClick={copyAddress}>
              📋 Copy Address
            </Button>

            <div
              style={{
                padding: "12px",
                backgroundColor: "rgba(99, 102, 241, 0.08)",
                border: "1px solid var(--border-accent)",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
                color: "var(--text-secondary)",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--accent-primary)", marginBottom: "4px" }}>
                Need Sepolia Testnet Funds?
              </div>
              <div>Get free Sepolia test ETH from public faucets to test transactions without spending real money.</div>
              <div style={{ marginTop: "6px" }}>
                <a
                  href="https://sepoliafaucet.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent-cyan)", fontWeight: 600 }}
                >
                  Alchemy Sepolia Faucet ↗
                </a>
                {" · "}
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent-cyan)", fontWeight: 600 }}
                >
                  Circle USDC Faucet ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <Modal isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} title="Confirm Transfer">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Sending</span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{amount} {selectedToken}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>To</span>
              <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>
                {recipient.slice(0, 10)}...{recipient.slice(-8)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Network</span>
              <Badge variant="info">Sepolia Testnet</Badge>
            </div>
          </div>

          {sentTxHash ? (
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
                href={`https://sepolia.etherscan.io/tx/${sentTxHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "12px", color: "var(--status-info)", marginTop: "4px", display: "inline-block" }}
              >
                View on Etherscan ↗
              </a>
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
              🔒 MetaMask will prompt for explicit transaction approval. Funds remain in your custody until signed.
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              variant="outline"
              style={{ flex: 1 }}
              onClick={() => {
                setShowPreviewModal(false);
                setSentTxHash(null);
              }}
            >
              {sentTxHash ? "Close" : "Cancel"}
            </Button>
            {!sentTxHash && (
              <Button variant="primary" style={{ flex: 1 }} loading={isSending} onClick={handleConfirmSend}>
                Confirm in Wallet
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

