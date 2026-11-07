"""
Transaction Validation Service — Module 3 of the documented architecture.

FR-03: Validate transactions against amount, operation, permission and security rules.
FR-04: Reject invalid or unauthorized transactions.
NFR-01: Explainable, evidence-linked validation outcomes.

CRITICAL DESIGN PRINCIPLE:
This service is DETERMINISTIC and INDEPENDENT of the LLM.
The LLM has already produced a structured intent.
This service checks that intent against hard rules before ANY execution.

If validation fails → no transaction is executed → user gets a clear reason.
Fail-closed: ambiguous or incomplete intents are rejected.
"""

import re
import logging
from typing import List, Tuple

from app.config import settings
from app.schemas.intent import DeFiIntent, SupportedOperation
from app.schemas.transaction import ValidationCheckDetail, ValidationResponse

logger = logging.getLogger(__name__)


class ValidationService:
    """
    Deterministic transaction validator.
    All checks are rule-based — no AI, no probabilities, no assumptions.
    """

    # ── Hard-coded validation constants ───────────────────────────────────────
    # These cannot be overridden by LLM output.

    ETHEREUM_ADDRESS_PATTERN = re.compile(r"^0x[0-9a-fA-F]{40}$")
    MIN_AMOUNT = 0.000001           # Minimum meaningful transaction amount
    BLACKLISTED_ADDRESSES: set = {  # Example: add known scam addresses
        "0x0000000000000000000000000000000000000000",  # Zero address
    }

    def validate(self, intent: DeFiIntent) -> ValidationResponse:
        """
        Run all validation checks against the intent.

        Returns a ValidationResponse with:
        - overall pass/fail
        - individual check results (NFR-01: explainable)
        - human-readable failure reasons
        - can_proceed_to_preview flag

        If any check fails, can_proceed_to_preview is False.
        No execution should occur when can_proceed_to_preview is False.
        """
        checks: List[ValidationCheckDetail] = []
        failure_reasons: List[str] = []

        # ── Run all checks ────────────────────────────────────────────────────

        # 1. Operation check (FR-03: supported operation)
        op_passed, op_reason = self._check_operation(intent)
        checks.append(ValidationCheckDetail(
            check_name="Supported Operation",
            passed=op_passed,
            reason=op_reason,
        ))
        if not op_passed:
            failure_reasons.append(op_reason)

        # 2. Token check (FR-03: valid token)
        tok_passed, tok_reason = self._check_tokens(intent)
        checks.append(ValidationCheckDetail(
            check_name="Token Validation",
            passed=tok_passed,
            reason=tok_reason,
        ))
        if not tok_passed:
            failure_reasons.append(tok_reason)

        # 3. Amount check (FR-03: valid amount)
        amt_passed, amt_reason = self._check_amount(intent)
        checks.append(ValidationCheckDetail(
            check_name="Amount Validation",
            passed=amt_passed,
            reason=amt_reason,
        ))
        if not amt_passed:
            failure_reasons.append(amt_reason)

        # 4. Spending limit check (FR-03: spending limits)
        lim_passed, lim_reason = self._check_spending_limit(intent)
        checks.append(ValidationCheckDetail(
            check_name="Spending Limit",
            passed=lim_passed,
            reason=lim_reason,
        ))
        if not lim_passed:
            failure_reasons.append(lim_reason)

        # 5. Recipient check (FR-03: valid recipient where applicable)
        rec_passed, rec_reason = self._check_recipient(intent)
        checks.append(ValidationCheckDetail(
            check_name="Recipient Address",
            passed=rec_passed,
            reason=rec_reason,
        ))
        if not rec_passed:
            failure_reasons.append(rec_reason)

        # 6. Completeness check (FR-03: required parameters present)
        comp_passed, comp_reason = self._check_completeness(intent)
        checks.append(ValidationCheckDetail(
            check_name="Intent Completeness",
            passed=comp_passed,
            reason=comp_reason,
        ))
        if not comp_passed:
            failure_reasons.append(comp_reason)

        # ── Compute overall result ────────────────────────────────────────────
        all_passed = len(failure_reasons) == 0

        if all_passed:
            summary = (
                f"All validation checks passed. "
                f"The {intent.operation} of "
                f"{intent.amount} {intent.token_in} "
                f"is within allowed limits and parameters."
            )
        else:
            summary = (
                f"Transaction blocked. {len(failure_reasons)} check(s) failed: "
                + "; ".join(failure_reasons)
            )

        logger.info(
            f"Validation {'PASSED' if all_passed else 'FAILED'} for "
            f"operation={intent.operation}, amount={intent.amount}, "
            f"token={intent.token_in}"
        )

        return ValidationResponse(
            request_id="",  # Filled in by the router
            overall_status="passed" if all_passed else "failed",
            checks=checks,
            failure_reasons=failure_reasons,
            human_readable_summary=summary,
            can_proceed_to_preview=all_passed,
        )

    # ── Individual checks ──────────────────────────────────────────────────────

    def _check_operation(self, intent: DeFiIntent) -> Tuple[bool, str]:
        """Check that the operation is supported."""
        try:
            op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)
        except Exception:
            op_value = str(intent.operation)

        if op_value not in settings.allowed_operations:
            return False, (
                f"Operation '{op_value}' is not supported. "
                f"Supported operations: {', '.join(settings.allowed_operations)}."
            )
        return True, f"Operation '{op_value}' is supported."

    def _check_tokens(self, intent: DeFiIntent) -> Tuple[bool, str]:
        """Check that involved tokens are on the allowed list."""
        tokens_to_check = []
        if intent.token_in:
            tokens_to_check.append(intent.token_in.upper())
        if intent.token_out:
            tokens_to_check.append(intent.token_out.upper())

        if not tokens_to_check:
            return False, "No token specified for the transaction."

        disallowed = [t for t in tokens_to_check if t not in settings.allowed_tokens]
        if disallowed:
            return False, (
                f"Token(s) not supported: {', '.join(disallowed)}. "
                f"Supported tokens: {', '.join(settings.allowed_tokens)}."
            )
        return True, f"Token(s) {', '.join(tokens_to_check)} are supported."

    def _check_amount(self, intent: DeFiIntent) -> Tuple[bool, str]:
        """Check that the amount is valid and positive."""
        if intent.amount is None:
            return False, "Transaction amount is required but was not specified."
        if intent.amount <= 0:
            return False, f"Transaction amount must be positive. Got: {intent.amount}."
        if intent.amount < self.MIN_AMOUNT:
            return False, (
                f"Transaction amount {intent.amount} is below the minimum "
                f"meaningful amount ({self.MIN_AMOUNT})."
            )
        return True, f"Amount {intent.amount} is valid."

    def _check_spending_limit(self, intent: DeFiIntent) -> Tuple[bool, str]:
        """
        Check the amount against the configured spending limit.
        FR-03: Spending limits are enforced deterministically.
        The limit is set in configuration, not by the LLM.
        """
        if intent.amount is None:
            return True, "No amount to check against spending limit."

        # For ETH and ETH-equivalent tokens, check against ETH limit
        eth_tokens = {"ETH", "WETH"}
        token = (intent.token_in or "").upper()

        if token in eth_tokens or not token:
            limit = settings.max_tx_amount_eth
            if intent.amount > limit:
                return False, (
                    f"Transaction amount {intent.amount} ETH exceeds the configured "
                    f"spending limit of {limit} ETH per transaction. "
                    "This limit is a security control to protect against excessive transactions."
                )
            return True, f"Amount {intent.amount} ETH is within the spending limit of {limit} ETH."

        # For other tokens, apply a generous limit (1,000,000 units for stablecoins)
        stablecoin_limit = 10000  # 10,000 USDC/DAI per transaction (academic prototype)
        if token in {"USDC", "DAI"}:
            if intent.amount > stablecoin_limit:
                return False, (
                    f"Transaction amount {intent.amount} {token} exceeds the configured "
                    f"limit of {stablecoin_limit} {token} per transaction."
                )
        return True, f"Amount is within spending limits."

    def _check_recipient(self, intent: DeFiIntent) -> Tuple[bool, str]:
        """
        Check recipient address validity for transfer operations.
        Swap and stake do not require a recipient.
        """
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)

        if op_value == "transfer":
            if not intent.recipient:
                return False, "Transfer operations require a recipient address."
            recipient = intent.recipient.strip()
            if not self.ETHEREUM_ADDRESS_PATTERN.match(recipient):
                return False, (
                    f"Recipient address '{recipient}' is not a valid "
                    "Ethereum address (must be 0x followed by 40 hex characters)."
                )
            if recipient.lower() in {a.lower() for a in self.BLACKLISTED_ADDRESSES}:
                return False, (
                    f"Recipient address '{recipient}' is blacklisted and "
                    "cannot receive transfers."
                )
            return True, f"Recipient address is valid."

        # Swap and stake — recipient not required
        return True, f"No recipient required for {op_value} operation."

    def _check_completeness(self, intent: DeFiIntent) -> Tuple[bool, str]:
        """
        Check that all required fields for the operation are present.
        Fail-closed: incomplete intents are rejected.
        """
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)
        missing = []

        if op_value == "transfer":
            if not intent.token_in:
                missing.append("token to transfer")
            if intent.amount is None:
                missing.append("amount")
            if not intent.recipient:
                missing.append("recipient address")

        elif op_value == "swap":
            if not intent.token_in:
                missing.append("token to sell (token_in)")
            if not intent.token_out:
                missing.append("token to buy (token_out)")
            if intent.amount is None:
                missing.append("amount to swap")

        elif op_value == "stake":
            if not intent.token_in:
                missing.append("token to stake")
            if intent.amount is None:
                missing.append("amount to stake")

        if missing:
            return False, (
                f"Incomplete transaction request. Missing: {', '.join(missing)}. "
                "Please provide all required information."
            )

        return True, "All required fields for this operation are present."


# Module-level singleton
validation_service = ValidationService()
