/**
 * Backend API service — all HTTP calls in one place.
 */

import type {
  DeFiIntent, ValidationResult, TransactionPreview,
  ExecuteResponse, IntegrityResult, Dashboard,
  WalletProfile, WalletBalances, TransactionDetail, ConfirmTxResult,
  ContractAssuranceReport,
} from "../types";

const BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`);
  return data as T;
}

// ── Wallet / Profile ──────────────────────────────────────────────────────────
export async function registerWallet(walletAddress: string, network = "Sepolia"): Promise<WalletProfile> {
  return request("/api/v1/wallet/register", {
    method: "POST",
    body: JSON.stringify({ wallet_address: walletAddress, network }),
  });
}

export async function getWalletProfile(walletAddress: string): Promise<WalletProfile> {
  return request(`/api/v1/wallet/${walletAddress}/profile`);
}

export async function getWalletBalances(walletAddress: string): Promise<WalletBalances> {
  return request(`/api/v1/wallet/${walletAddress}/balances`);
}

export async function getTransactionDetail(
  walletAddress: string, requestId: string
): Promise<TransactionDetail> {
  return request(`/api/v1/wallet/${walletAddress}/transaction/${requestId}`);
}

export async function confirmTransaction(
  walletAddress: string, requestId: string, txHash: string
): Promise<ConfirmTxResult> {
  return request(`/api/v1/wallet/confirm-tx?wallet_address=${walletAddress}`, {
    method: "POST",
    body: JSON.stringify({ request_id: requestId, tx_hash: txHash }),
  });
}

// ── Transaction pipeline ──────────────────────────────────────────────────────
export async function parseIntent(userInput: string, walletAddress: string): Promise<{ request_id: string; intent: DeFiIntent }> {
  return request("/api/v1/transaction/parse", {
    method: "POST",
    body: JSON.stringify({ user_input: userInput, wallet_address: walletAddress }),
  });
}

export async function validateIntent(requestId: string): Promise<ValidationResult> {
  return request(`/api/v1/transaction/validate/${requestId}`, { method: "POST" });
}

export async function getPreview(requestId: string): Promise<TransactionPreview> {
  return request(`/api/v1/transaction/preview/${requestId}`, { method: "POST" });
}

export async function recordExecution(requestId: string, walletAddress: string, signedTxHash: string): Promise<ExecuteResponse> {
  return request("/api/v1/transaction/execute", {
    method: "POST",
    body: JSON.stringify({ request_id: requestId, wallet_address: walletAddress, signed_tx_hash: signedTxHash }),
  });
}

export async function verifyIntegrity(requestId: string): Promise<IntegrityResult> {
  return request("/api/v1/transaction/verify-integrity", {
    method: "POST",
    body: JSON.stringify({ request_id: requestId }),
  });
}

export async function getDashboard(walletAddress: string): Promise<Dashboard> {
  return request(`/api/v1/dashboard/${walletAddress}`);
}

export async function getTransactionStatus(requestId: string): Promise<Record<string, unknown>> {
  return request(`/api/v1/transaction/status/${requestId}`);
}

// ── Contract assurance (LeVer, design-time report) ────────────────────────────
export async function getContractAssurance(): Promise<ContractAssuranceReport> {
  return request("/api/v1/assurance/contract");
}
