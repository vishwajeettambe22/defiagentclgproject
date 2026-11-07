// ── Shared TypeScript types ───────────────────────────────────────────────────

export type Operation = "transfer" | "swap" | "stake";

export interface DeFiIntent {
  operation: Operation;
  token_in?: string;
  token_out?: string;
  amount?: number;
  amount_raw?: string;
  recipient?: string;
  chain?: string;
  slippage?: number;
  confidence: number;
  requires_confirmation: boolean;
  missing_fields: string[];
}

export interface ValidationCheck {
  check_name: string;
  passed: boolean;
  reason?: string;
}

export interface ValidationResult {
  request_id: string;
  overall_status: "passed" | "failed";
  checks: ValidationCheck[];
  failure_reasons: string[];
  human_readable_summary: string;
  can_proceed_to_preview: boolean;
}

// Design-time contract assurance (LeVer) — informational only, never a gate
export type AssuranceStatus =
  | "not_run" | "cross_check_passed" | "cross_check_failed"
  | "cross_check_error" | "stale" | "unavailable";

export interface ContractAssuranceSummary {
  contract: string;
  status: AssuranceStatus;
  label: string;
  source_matches_report?: boolean | null;
  open_findings: number;
  open_medium_findings: number;
  note: string;
}

export interface AssuranceFinding {
  id: string;
  lever_property: string;
  severity: string;
  status: string;
  title: string;
  detail: string;
  recommendation: string;
  resolution?: string | null;
}

export interface ContractAssuranceReport extends ContractAssuranceSummary {
  source_path?: string;
  findings: AssuranceFinding[];
  satisfied: { lever_property: string; note: string }[];
  manual_review_method?: string;
  manual_review_date?: string;
}

export interface TransactionPreview {
  request_id: string;
  preview_id: string;
  operation: string;
  token?: string;
  amount?: string;
  recipient?: string;
  network: string;
  estimated_gas?: string;
  validation_summary: string;
  security_checks: string[];
  warnings: string[];
  contract_assurance?: ContractAssuranceSummary | null;
  authorization_instruction: string;
}

export interface ExecuteResponse {
  request_id: string;
  blockchain_tx_hash?: string;
  status: string;
  message: string;
  explorer_url?: string;
}

export interface IntegrityResult {
  request_id: string;
  is_intact: boolean;
  computed_hash: string;
  stored_hash?: string;
  anchor_tx_hash?: string;
  verification_message: string;
  verified_at: string;
}

export interface TransactionSummary {
  request_id: string;
  operation: string;
  token?: string;
  amount?: string;
  recipient?: string;
  network?: string;
  status: string;
  blockchain_tx_hash?: string;
  created_at: string;
  integrity_hash?: string;
}

export interface Dashboard {
  wallet_address: string;
  total_transactions: number;
  completed_transactions: number;
  failed_transactions: number;
  recent_transactions: TransactionSummary[];
}

// ── New: Wallet Profile & Balances ────────────────────────────────────────────

export interface WalletProfile {
  wallet_address: string;
  display_name?: string;
  preferred_network: string;
  first_seen_at: string;
  last_seen_at: string;
  total_requests: number;
  total_completed: number;
  is_new_user: boolean;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balance_raw: string;
  decimals: number;
  contract_address?: string;
}

export interface WalletBalances {
  wallet_address: string;
  network: string;
  block_number?: number;
  balances: TokenBalance[];
  fetched_at: string;
}

export interface TransactionDetail {
  request_id: string;
  wallet_address: string;
  natural_language_input: string;
  status: string;
  created_at: string;
  // Intent
  operation?: string;
  token_in?: string;
  token_out?: string;
  amount?: number;
  recipient?: string;
  confidence?: number;
  // Validation
  validation_status?: string;
  validation_summary?: string;
  validation_checks?: Record<string, boolean>;
  // Execution
  blockchain_tx_hash?: string;
  block_number?: number;
  gas_used?: string;
  from_address?: string;
  to_address?: string;
  executed_at?: string;
  confirmed_at?: string;
  explorer_url?: string;
  // Integrity
  integrity_hash?: string;
  integrity_anchor_tx?: string;
  integrity_verified_at?: string;
}

export interface ConfirmTxResult {
  request_id: string;
  tx_hash: string;
  blockchain_status: string;
  block_number?: number;
  gas_used?: string;
}

// Workflow stages
export type WorkflowStage =
  | "idle"
  | "parsing"
  | "validating"
  | "previewing"
  | "awaiting_wallet"
  | "submitting"
  | "pending"
  | "completed"
  | "failed"
  | "user_cancelled";

// App navigation pages
export type AppPage =
  | "overview"
  | "dashboard"
  | "wallet"
  | "swap"
  | "send"
  | "portfolio"
  | "assistant"
  | "command"
  | "history"
  | "analytics"
  | "settings"
  | "integrity";
