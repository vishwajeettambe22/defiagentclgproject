"""
Transaction Preview Service — Module 4 of the documented architecture.

FR-05: Provide transaction preview before execution.
NFR-02: Clear separation between preview and execution.

The preview is generated AFTER validation passes.
Generating a preview does NOT execute anything.
No blockchain interaction occurs in this service.
"""

import logging
from typing import List, Optional

from app.schemas.intent import DeFiIntent
from app.schemas.transaction import TransactionPreviewResponse, ValidationResponse
from app.config import settings
from app.services.assurance_service import assurance_service

logger = logging.getLogger(__name__)


class PreviewService:
    """
    Generates a human-readable transaction preview for user review.
    The preview contains all information needed to make an informed decision.
    """

    # Sepolia block explorer
    EXPLORER_BASE = "https://sepolia.etherscan.io"

    def generate_preview(
        self,
        request_id: str,
        preview_id: str,
        intent: DeFiIntent,
        validation: ValidationResponse,
    ) -> TransactionPreviewResponse:
        """
        Build the transaction preview from a validated intent.

        FR-05: Preview includes operation, asset, amount, recipient, network,
               estimated gas, validation status, security checks, and warnings.
        NFR-02: This is a preview — no execution occurs.
        """
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)

        # ── Build display strings ──────────────────────────────────────────────
        operation_display = self._format_operation(intent)
        token_display = self._format_token(intent)
        amount_display = self._format_amount(intent)
        recipient_display = self._format_recipient(intent)
        gas_estimate = self._estimate_gas(intent)
        warnings = self._build_warnings(intent)
        assurance = assurance_service.get_summary()
        warnings.insert(
            len(warnings) - 1,
            f"ℹ️ Smart contract assurance: {assurance.label}. {assurance.open_findings} reviewed finding(s) open. "
            "This is design-time information only, not a guarantee.",
        )
        security_summary = self._build_security_summary(validation)

        logger.info(f"Preview generated for request_id={request_id}, operation={op_value}")

        return TransactionPreviewResponse(
            request_id=request_id,
            preview_id=preview_id,
            operation=operation_display,
            token=token_display,
            amount=amount_display,
            recipient=recipient_display,
            network=settings.network_name,
            estimated_gas=gas_estimate,
            validation_summary=validation.human_readable_summary,
            security_checks=[c.reason for c in validation.checks if c.passed and c.reason],
            warnings=warnings,
            contract_assurance=assurance,
        )

    # ── Private helpers ────────────────────────────────────────────────────────

    def _format_operation(self, intent: DeFiIntent) -> str:
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)
        labels = {
            "transfer": "Token Transfer",
            "swap": "Token Swap",
            "stake": "Token Stake",
        }
        return labels.get(op_value, op_value.title())

    def _format_token(self, intent: DeFiIntent) -> Optional[str]:
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)
        if op_value == "swap":
            tin = intent.token_in or "?"
            tout = intent.token_out or "?"
            return f"{tin} → {tout}"
        return intent.token_in

    def _format_amount(self, intent: DeFiIntent) -> Optional[str]:
        if intent.amount is None:
            return None
        token = intent.token_in or ""
        return f"{intent.amount} {token}".strip()

    def _format_recipient(self, intent: DeFiIntent) -> Optional[str]:
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)
        if op_value == "transfer" and intent.recipient:
            addr = intent.recipient
            # Show shortened address for readability
            if len(addr) == 42:
                return f"{addr[:6]}...{addr[-4:]}"
            return addr
        if op_value == "swap":
            return "DEX Smart Contract (Sepolia)"
        if op_value == "stake":
            return "Staking Contract (Sepolia)"
        return None

    def _estimate_gas(self, intent: DeFiIntent) -> str:
        """
        Provide a rough gas estimate for the operation.
        Real gas estimation requires a live RPC call — this is a preview estimate.
        The actual gas is determined at signing time by MetaMask.
        """
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)
        estimates = {
            "transfer": "~21,000 gas (≈ 0.0001 ETH on Sepolia)",
            "swap": "~150,000–200,000 gas (≈ 0.001–0.002 ETH on Sepolia)",
            "stake": "~80,000–120,000 gas (≈ 0.0005–0.001 ETH on Sepolia)",
        }
        base = estimates.get(op_value, "~50,000 gas (estimate)")
        return f"{base} — exact amount shown in MetaMask before signing"

    def _build_warnings(self, intent: DeFiIntent) -> List[str]:
        """Build context-appropriate warnings to show the user."""
        warnings = []
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)

        # Always show testnet warning
        warnings.append("⚠️ This transaction will be executed on the Sepolia testnet — no real funds are at risk.")

        # Swap-specific warnings
        if op_value == "swap":
            slippage = intent.slippage or 0.5
            warnings.append(f"Slippage tolerance: {slippage}%. Transaction may fail if market moves beyond this.")

        # Large amount warning
        if intent.amount and intent.amount > 0.5:
            warnings.append(
                f"⚠️ You are about to transact {intent.amount} {intent.token_in or ''}. "
                "Please verify this amount carefully before approving."
            )

        # Confidence warning
        if intent.confidence and intent.confidence < 0.8:
            warnings.append(
                f"ℹ️ AI confidence in parsing your request: {intent.confidence:.0%}. "
                "Please verify the transaction details carefully."
            )

        warnings.append("✓ This is a preview only. No blockchain transaction will occur until you approve in your wallet.")
        return warnings

    def _build_security_summary(self, validation: ValidationResponse) -> str:
        passed = sum(1 for c in validation.checks if c.passed)
        total = len(validation.checks)
        return f"{passed}/{total} security checks passed. Transaction validated."


# Module-level singleton
preview_service = PreviewService()
