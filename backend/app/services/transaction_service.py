"""
Transaction Service — orchestrates the full request lifecycle.

FR-08: Transaction recording and integrity support.
This service ties together all modules:
  AI intent → validation → preview → execution → record → integrity.

It is the primary coordinator — it persists state at every step
and ensures the workflow follows the documented order.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from sqlalchemy.orm import selectinload

from app.models.transaction import (
    TransactionRequest, StructuredIntent, ValidationResult,
    TransactionPreview, ExecutedTransaction,
    TransactionStatus, ValidationStatus as VStat,
)
from app.schemas.intent import DeFiIntent
from app.schemas.transaction import (
    ValidationResponse, TransactionPreviewResponse,
    ExecuteResponse, TransactionSummary, DashboardResponse,
    IntegrityVerificationResponse,
)
from app.services.integrity_service import integrity_service
from app.services.blockchain_service import blockchain_service
from app.config import settings

logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


class TransactionService:

    async def create_request(
        self, db: AsyncSession, wallet_address: str, natural_language_input: str
    ) -> TransactionRequest:
        """Create and persist a new transaction request."""
        req = TransactionRequest(
            wallet_address=wallet_address.lower(),
            natural_language_input=natural_language_input,
            status=TransactionStatus.INTENT_RECEIVED,
        )
        db.add(req)
        await db.flush()
        logger.info(f"Created TransactionRequest id={req.id}")
        return req

    async def save_intent(
        self, db: AsyncSession, request: TransactionRequest, intent: DeFiIntent, raw_output: str
    ) -> StructuredIntent:
        """Persist the structured intent produced by the AI module."""
        op_value = intent.operation.value if hasattr(intent.operation, "value") else str(intent.operation)
        db_intent = StructuredIntent(
            request=request,
            request_id=request.id,
            operation=op_value,
            token_in=intent.token_in,
            token_out=intent.token_out,
            amount=intent.amount,
            amount_raw=intent.amount_raw,
            recipient=intent.recipient,
            chain=intent.chain,
            slippage=intent.slippage,
            confidence=intent.confidence,
            requires_confirmation=intent.requires_confirmation,
            raw_ai_output=raw_output[:4000] if raw_output else None,
        )
        request.intent = db_intent
        db.add(db_intent)
        request.status = TransactionStatus.INTENT_PARSED
        await db.flush()
        return db_intent

    async def save_validation(
        self, db: AsyncSession, request: TransactionRequest, result: ValidationResponse
    ) -> ValidationResult:
        """Persist the validation result."""
        checks_map = {c.check_name: c for c in result.checks}

        db_val = ValidationResult(
            request=request,
            request_id=request.id,
            status=VStat.PASSED if result.overall_status == "passed" else VStat.FAILED,
            operation_check=checks_map.get("Supported Operation", type("", (), {"passed": False})()).passed,
            token_check=checks_map.get("Token Validation", type("", (), {"passed": False})()).passed,
            amount_check=checks_map.get("Amount Validation", type("", (), {"passed": False})()).passed,
            recipient_check=checks_map.get("Recipient Address", type("", (), {"passed": False})()).passed,
            spending_limit_check=checks_map.get("Spending Limit", type("", (), {"passed": False})()).passed,
            completeness_check=checks_map.get("Intent Completeness", type("", (), {"passed": False})()).passed,
            failure_reasons=json.dumps(result.failure_reasons),
            human_readable_summary=result.human_readable_summary,
        )
        request.validation_result = db_val
        db.add(db_val)

        request.status = (
            TransactionStatus.VALIDATION_PASSED
            if result.overall_status == "passed"
            else TransactionStatus.VALIDATION_FAILED
        )
        await db.flush()
        return db_val

    async def save_preview(
        self, db: AsyncSession, request: TransactionRequest, preview: TransactionPreviewResponse
    ) -> TransactionPreview:
        """Persist the transaction preview record."""
        db_preview = TransactionPreview(
            request=request,
            request_id=request.id,
            operation_display=preview.operation,
            token_display=preview.token,
            amount_display=preview.amount,
            recipient_display=preview.recipient,
            network_display=preview.network,
            estimated_gas_display=preview.estimated_gas,
            warnings=json.dumps(preview.warnings),
            security_checks_summary=preview.validation_summary,
            shown_at=utcnow(),
        )
        request.preview = db_preview
        db.add(db_preview)
        request.status = TransactionStatus.PREVIEW_SHOWN
        await db.flush()
        return db_preview

    async def record_user_approval(
        self, db: AsyncSession, request: TransactionRequest
    ) -> None:
        """Record that the user approved the transaction in their wallet. FR-06."""
        request.status = TransactionStatus.USER_APPROVED
        if request.preview:
            request.preview.approved_at = utcnow()
        await db.flush()

    async def record_user_rejection(
        self, db: AsyncSession, request: TransactionRequest
    ) -> None:
        """Record that the user rejected the transaction."""
        request.status = TransactionStatus.USER_REJECTED
        if request.preview:
            request.preview.rejected_at = utcnow()
        await db.flush()

    async def record_execution(
        self,
        db: AsyncSession,
        request: TransactionRequest,
        blockchain_tx_hash: str,
        tx_params: dict,
    ) -> ExecutedTransaction:
        """
        Record the executed transaction and compute its integrity hash.
        FR-07: Execution through blockchain.
        FR-08: Recording + integrity.
        """
        op = request.intent.operation if request.intent else "unknown"
        token = request.intent.token_in if request.intent else None
        amount = str(request.intent.amount) if request.intent and request.intent.amount else None
        recipient = request.intent.recipient if request.intent else None
        executed_at = utcnow()

        # Compute integrity hash (FR-08)
        integrity_hash = integrity_service.compute_integrity_hash(
            request_id=str(request.id),
            wallet_address=request.wallet_address,
            operation=op,
            token=token,
            amount=amount,
            recipient=recipient,
            blockchain_tx_hash=blockchain_tx_hash,
            chain_id=settings.chain_id,
            executed_at=executed_at,
        )

        db_exec = ExecutedTransaction(
            request=request,
            request_id=request.id,
            blockchain_tx_hash=blockchain_tx_hash,
            chain_id=settings.chain_id,
            from_address=request.wallet_address,
            to_address=recipient or settings.defi_agent_contract,
            operation=op,
            token=token,
            amount_display=f"{amount} {token}" if amount and token else amount,
            gas_used=tx_params.get("gas", ""),
            status="pending",
            integrity_hash=integrity_hash,
            executed_at=executed_at,
        )
        request.executed_transaction = db_exec
        db.add(db_exec)
        request.status = TransactionStatus.EXECUTING
        await db.flush()

        logger.info(
            f"Execution recorded: tx={blockchain_tx_hash[:16]}... "
            f"integrity_hash={integrity_hash[:16]}..."
        )
        return db_exec

    async def confirm_transaction(
        self, db: AsyncSession, request_id: str, tx_hash: str
    ) -> Optional[ExecutedTransaction]:
        """Mark a transaction as confirmed after blockchain confirmation."""
        result = await db.execute(
            select(ExecutedTransaction)
            .options(selectinload(ExecutedTransaction.request))
            .where(ExecutedTransaction.blockchain_tx_hash == tx_hash)
        )
        db_exec = result.scalar_one_or_none()
        if db_exec:
            db_exec.status = "confirmed"
            db_exec.confirmed_at = utcnow()
            if db_exec.request:
                db_exec.request.status = TransactionStatus.COMPLETED
            await db.flush()
        return db_exec

    async def get_request(
        self, db: AsyncSession, request_id: str
    ) -> Optional[TransactionRequest]:
        """Fetch a transaction request with all related data eagerly loaded."""
        try:
            req_uuid = uuid.UUID(request_id) if isinstance(request_id, str) else request_id
        except (ValueError, AttributeError):
            return None

        result = await db.execute(
            select(TransactionRequest)
            .options(
                selectinload(TransactionRequest.intent),
                selectinload(TransactionRequest.validation_result),
                selectinload(TransactionRequest.preview),
                selectinload(TransactionRequest.executed_transaction),
            )
            .where(TransactionRequest.id == req_uuid)
        )
        return result.scalar_one_or_none()

    async def verify_integrity(
        self, db: AsyncSession, request_id: str
    ) -> IntegrityVerificationResponse:
        """
        Verify the integrity of a transaction record. FR-08.
        Recomputes the hash and compares to the stored value.
        """
        req = await self.get_request(db, request_id)
        if not req or not req.executed_transaction:
            return IntegrityVerificationResponse(
                request_id=request_id,
                is_intact=False,
                computed_hash="",
                stored_hash=None,
                anchor_tx_hash=None,
                verification_message="Transaction record not found.",
                verified_at=utcnow().isoformat(),
            )

        exec_tx = req.executed_transaction
        op = req.intent.operation if req.intent else "unknown"
        token = req.intent.token_in if req.intent else None
        amount = str(req.intent.amount) if req.intent and req.intent.amount else None

        is_intact, computed_hash = integrity_service.verify_integrity(
            stored_hash=exec_tx.integrity_hash or "",
            request_id=str(req.id),
            wallet_address=req.wallet_address,
            operation=op,
            token=token,
            amount=amount,
            recipient=exec_tx.to_address,
            blockchain_tx_hash=exec_tx.blockchain_tx_hash,
            chain_id=exec_tx.chain_id,
            executed_at=exec_tx.executed_at,
        )

        # Mark verification timestamp
        exec_tx.integrity_verified_at = utcnow()
        await db.flush()

        message = (
            "✓ Transaction record integrity verified. The record has not been tampered with."
            if is_intact
            else "⚠️ Integrity check FAILED. The transaction record does not match the stored hash."
        )

        return IntegrityVerificationResponse(
            request_id=request_id,
            is_intact=is_intact,
            computed_hash=computed_hash,
            stored_hash=exec_tx.integrity_hash,
            anchor_tx_hash=exec_tx.integrity_anchor_tx,
            verification_message=message,
            verified_at=utcnow().isoformat(),
        )

    async def get_dashboard(
        self, db: AsyncSession, wallet_address: str, limit: int = 20
    ) -> DashboardResponse:
        """Get dashboard data for a wallet address."""
        wallet_address_lower = wallet_address.lower()

        # Eagerly load intent and executed_transaction to prevent MissingGreenlet / lazy-loading
        result = await db.execute(
            select(TransactionRequest)
            .where(TransactionRequest.wallet_address == wallet_address_lower)
            .options(
                selectinload(TransactionRequest.intent),
                selectinload(TransactionRequest.executed_transaction),
            )
            .order_by(TransactionRequest.created_at.desc())
            .limit(limit)
        )
        requests = result.scalars().all()

        summaries = []
        completed = 0
        failed = 0

        for req in requests:
            if req.status == TransactionStatus.COMPLETED:
                completed += 1
            elif req.status in (TransactionStatus.FAILED, TransactionStatus.VALIDATION_FAILED):
                failed += 1

            exec_tx = req.executed_transaction
            intent = req.intent
            summaries.append(TransactionSummary(
                request_id=str(req.id),
                operation=intent.operation if intent else "unknown",
                token=intent.token_in if intent else None,
                amount=str(intent.amount) if intent and intent.amount is not None else None,
                recipient=intent.recipient if intent else None,
                network=settings.network_name,
                status=req.status.value if hasattr(req.status, "value") else str(req.status),
                blockchain_tx_hash=exec_tx.blockchain_tx_hash if exec_tx else None,
                created_at=req.created_at,
                integrity_hash=exec_tx.integrity_hash if exec_tx else None,
            ))

        return DashboardResponse(
            wallet_address=wallet_address,
            total_transactions=len(requests),
            completed_transactions=completed,
            failed_transactions=failed,
            recent_transactions=summaries,
        )


# Module-level singleton
transaction_service = TransactionService()
