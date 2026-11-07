/**
 * useTransaction hook — full pipeline with live status polling.
 * FR-01 through FR-08.
 */

import { useState, useCallback, useRef } from "react";
import * as api from "../services/api";
import type {
  DeFiIntent, ValidationResult, TransactionPreview,
  ExecuteResponse, WorkflowStage, ConfirmTxResult,
} from "../types";

interface TransactionState {
  stage: WorkflowStage;
  requestId: string | null;
  intent: DeFiIntent | null;
  validation: ValidationResult | null;
  preview: TransactionPreview | null;
  execution: ExecuteResponse | null;
  confirmation: ConfirmTxResult | null;
  error: string | null;
}

export function useTransaction() {
  const [state, setState] = useState<TransactionState>({
    stage: "idle", requestId: null, intent: null, validation: null,
    preview: null, execution: null, confirmation: null, error: null,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setState({ stage: "idle", requestId: null, intent: null, validation: null,
               preview: null, execution: null, confirmation: null, error: null });
  }, []);

  /** Step 1+2+3: Parse → Validate → Preview (auto-pipeline) */
  const processCommand = useCallback(async (userInput: string, walletAddress: string) => {
    setState(s => ({ ...s, stage: "parsing", error: null }));

    // FR-01, FR-02: Parse
    let requestId: string, intent: DeFiIntent;
    try {
      const parsed = await api.parseIntent(userInput, walletAddress);
      requestId = parsed.request_id;
      intent = parsed.intent;
      setState(s => ({ ...s, requestId, intent, stage: "validating" }));
    } catch (err) {
      setState(s => ({ ...s, stage: "failed", error: err instanceof Error ? err.message : "Parse failed." }));
      return;
    }

    // FR-03, FR-04: Validate
    let validation: ValidationResult;
    try {
      validation = await api.validateIntent(requestId);
      setState(s => ({ ...s, validation }));
      if (!validation.can_proceed_to_preview) {
        setState(s => ({ ...s, stage: "failed", error: validation.human_readable_summary }));
        return;
      }
    } catch (err) {
      setState(s => ({ ...s, stage: "failed", error: err instanceof Error ? err.message : "Validation failed." }));
      return;
    }

    // FR-05: Preview
    setState(s => ({ ...s, stage: "previewing" }));
    try {
      const preview = await api.getPreview(requestId);
      setState(s => ({ ...s, preview, stage: "awaiting_wallet" }));
    } catch (err) {
      setState(s => ({ ...s, stage: "failed", error: err instanceof Error ? err.message : "Preview failed." }));
    }
  }, []);

  /** Step 4: Record execution + start confirmation polling */
  const recordExecution = useCallback(async (walletAddress: string, signedTxHash: string) => {
    if (!state.requestId) return;
    setState(s => ({ ...s, stage: "submitting", error: null }));

    try {
      const execution = await api.recordExecution(state.requestId, walletAddress, signedTxHash);
      setState(s => ({ ...s, execution, stage: "pending" }));

      // Poll for blockchain confirmation
      let attempts = 0;
      const maxAttempts = 20;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const conf = await api.confirmTransaction(walletAddress, state.requestId!, signedTxHash);
          if (conf.blockchain_status === "confirmed") {
            clearInterval(pollRef.current!);
            setState(s => ({ ...s, confirmation: conf, stage: "completed" }));
          } else if (conf.blockchain_status === "failed" || attempts >= maxAttempts) {
            clearInterval(pollRef.current!);
            setState(s => ({
              ...s, confirmation: conf,
              stage: conf.blockchain_status === "failed" ? "failed" : "completed",
            }));
          }
        } catch { /* RPC may be unavailable — keep polling */ }
      }, 4000);

    } catch (err) {
      setState(s => ({ ...s, stage: "failed", error: err instanceof Error ? err.message : "Execution record failed." }));
    }
  }, [state.requestId]);

  const cancelByUser = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setState(s => ({ ...s, stage: "user_cancelled" }));
  }, []);

  return { ...state, processCommand, recordExecution, cancelByUser, reset };
}
