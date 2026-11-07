"""
Transaction Router — the main workflow API endpoints.

Implements the complete flow:
  POST /api/v1/transaction/parse    → FR-01, FR-02 (NL → intent)
  POST /api/v1/transaction/validate → FR-03, FR-04 (validation)
  POST /api/v1/transaction/preview  → FR-05 (preview)
  POST /api/v1/transaction/execute  → FR-06, FR-07 (wallet auth + execution)
  GET  /api/v1/transaction/status   → FR-08 (status/history)
  POST /api/v1/transaction/verify   → FR-08 (integrity verification)

Each step must succeed before the next is available.
Validation failure prevents preview. Preview must exist before execution.
"""

import json
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.intent import NaturalLanguageRequest, IntentResponse
from app.schemas.transaction import (
    ValidationResponse,
    TransactionPreviewResponse,
    ExecuteRequest,
    ExecuteResponse,
    IntegrityVerificationRequest,
    IntegrityVerificationResponse,
    DashboardResponse,
    ErrorResponse,
)
from app.services.ai_service import ai_service
from app.services.validation_service import validation_service
from app.services.preview_service import preview_service
from app.services.transaction_service import transaction_service
from app.services.blockchain_service import blockchain_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/transaction", tags=["Transaction"])


# ── Step 1: Parse natural language into structured intent ─────────────────────
# FR-01, FR-02

@router.post(
    "/parse",
    response_model=IntentResponse,
    summary="Parse natural-language DeFi request (FR-01, FR-02)",
    description=(
        "Accepts a natural-language DeFi request and converts it into a structured intent "
        "using the AI/NLP module. The intent is NOT executed — it proceeds to validation next."
    ),
)
async def parse_intent(
    request_body: NaturalLanguageRequest,
    db: AsyncSession = Depends(get_db),
):
    # Create the request record
    db_request = await transaction_service.create_request(
        db, request_body.wallet_address, request_body.user_input
    )

    # Parse intent via AI
    try:
        intent = await ai_service.parse_intent(
            request_body.user_input, request_body.wallet_address
        )
    except ValueError as e:
        db_request.status_reason = str(e)  # type: ignore
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    # Persist the intent
    await transaction_service.save_intent(db, db_request, intent, raw_output="")

    return IntentResponse(
        request_id=str(db_request.id),
        intent=intent,
    )


# ── Step 2: Validate the structured intent ─────────────────────────────────────
# FR-03, FR-04, NFR-01

@router.post(
    "/validate/{request_id}",
    response_model=ValidationResponse,
    summary="Validate intent against security rules (FR-03, FR-04, NFR-01)",
)
async def validate_intent(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    db_request = await transaction_service.get_request(db, request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Transaction request not found.")
    if not db_request.intent:
        raise HTTPException(status_code=400, detail="Intent not yet parsed for this request.")

    # Reconstruct intent from DB
    from app.schemas.intent import DeFiIntent, SupportedOperation
    intent = DeFiIntent(
        operation=SupportedOperation(db_request.intent.operation),
        token_in=db_request.intent.token_in,
        token_out=db_request.intent.token_out,
        amount=db_request.intent.amount,
        amount_raw=db_request.intent.amount_raw,
        recipient=db_request.intent.recipient,
        chain=db_request.intent.chain,
        slippage=db_request.intent.slippage,
        confidence=db_request.intent.confidence or 1.0,
        requires_confirmation=True,
        missing_fields=[],
    )

    # Run deterministic validation (completely independent of AI)
    result = validation_service.validate(intent)
    result.request_id = request_id

    # Persist validation result
    await transaction_service.save_validation(db, db_request, result)

    return result


# ── Step 3: Generate transaction preview ──────────────────────────────────────
# FR-05, NFR-02

@router.post(
    "/preview/{request_id}",
    response_model=TransactionPreviewResponse,
    summary="Generate transaction preview for user review (FR-05, NFR-02)",
)
async def get_preview(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    db_request = await transaction_service.get_request(db, request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Transaction request not found.")
    if not db_request.validation_result:
        raise HTTPException(status_code=400, detail="Validation has not been run for this request.")
    if db_request.validation_result.status.value != "passed":
        raise HTTPException(
            status_code=400,
            detail="Cannot generate preview: validation failed. "
                   + (db_request.validation_result.human_readable_summary or ""),
        )

    # Reconstruct intent and validation result
    from app.schemas.intent import DeFiIntent, SupportedOperation
    from app.schemas.transaction import ValidationCheckDetail
    intent = DeFiIntent(
        operation=SupportedOperation(db_request.intent.operation),
        token_in=db_request.intent.token_in,
        token_out=db_request.intent.token_out,
        amount=db_request.intent.amount,
        amount_raw=db_request.intent.amount_raw,
        recipient=db_request.intent.recipient,
        chain=db_request.intent.chain,
        slippage=db_request.intent.slippage,
        confidence=db_request.intent.confidence or 1.0,
        requires_confirmation=True,
        missing_fields=[],
    )

    val = db_request.validation_result
    validation_response = ValidationResponse(
        request_id=request_id,
        overall_status="passed",
        checks=[
            ValidationCheckDetail(check_name="Supported Operation", passed=val.operation_check),
            ValidationCheckDetail(check_name="Token Validation", passed=val.token_check),
            ValidationCheckDetail(check_name="Amount Validation", passed=val.amount_check),
            ValidationCheckDetail(check_name="Recipient Address", passed=val.recipient_check),
            ValidationCheckDetail(check_name="Spending Limit", passed=val.spending_limit_check),
            ValidationCheckDetail(check_name="Intent Completeness", passed=val.completeness_check),
        ],
        failure_reasons=[],
        human_readable_summary=val.human_readable_summary or "",
        can_proceed_to_preview=True,
    )

    preview_id = str(uuid.uuid4())
    preview = preview_service.generate_preview(
        request_id=request_id,
        preview_id=preview_id,
        intent=intent,
        validation=validation_response,
    )

    await transaction_service.save_preview(db, db_request, preview)
    return preview


# ── Step 4: Record execution after user wallet approval ───────────────────────
# FR-06, FR-07, FR-08

@router.post(
    "/execute",
    response_model=ExecuteResponse,
    summary="Record execution after user wallet approval (FR-06, FR-07, FR-08)",
    description=(
        "Called after the user has signed and submitted the transaction via MetaMask. "
        "The backend records the blockchain tx hash and computes the integrity hash."
    ),
)
async def record_execution(
    exec_request: ExecuteRequest,
    db: AsyncSession = Depends(get_db),
):
    db_request = await transaction_service.get_request(db, exec_request.request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Transaction request not found.")
    if not db_request.preview:
        raise HTTPException(
            status_code=400,
            detail="Preview must be viewed before execution can be recorded.",
        )

    tx_hash = exec_request.signed_tx_hash
    if not tx_hash:
        raise HTTPException(
            status_code=400,
            detail="Blockchain transaction hash is required to record execution.",
        )

    # Record approval
    await transaction_service.record_user_approval(db, db_request)

    # Record execution and compute integrity hash
    db_exec = await transaction_service.record_execution(
        db, db_request, tx_hash, tx_params={}
    )

    explorer_url = blockchain_service.get_explorer_url(tx_hash)

    return ExecuteResponse(
        request_id=exec_request.request_id,
        blockchain_tx_hash=tx_hash,
        status="pending",
        message=(
            f"Transaction submitted. Hash: {tx_hash[:16]}... "
            "Track on the explorer or check back for confirmation."
        ),
        explorer_url=explorer_url,
    )


# ── Step 5: Verify transaction integrity ──────────────────────────────────────
# FR-08

@router.post(
    "/verify-integrity",
    response_model=IntegrityVerificationResponse,
    summary="Verify transaction record integrity (FR-08)",
)
async def verify_integrity(
    req: IntegrityVerificationRequest,
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.verify_integrity(db, req.request_id)


# ── Transaction status ─────────────────────────────────────────────────────────

@router.get(
    "/status/{request_id}",
    summary="Get transaction status",
)
async def get_status(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    db_request = await transaction_service.get_request(db, request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Transaction request not found.")

    response = {
        "request_id": request_id,
        "status": db_request.status.value,
        "wallet_address": db_request.wallet_address,
        "natural_language_input": db_request.natural_language_input,
        "created_at": db_request.created_at.isoformat(),
    }

    if db_request.intent:
        response["intent"] = {
            "operation": db_request.intent.operation,
            "token_in": db_request.intent.token_in,
            "amount": db_request.intent.amount,
            "recipient": db_request.intent.recipient,
        }

    if db_request.validation_result:
        response["validation"] = {
            "status": db_request.validation_result.status.value,
            "summary": db_request.validation_result.human_readable_summary,
        }

    if db_request.executed_transaction:
        exec_tx = db_request.executed_transaction
        response["execution"] = {
            "blockchain_tx_hash": exec_tx.blockchain_tx_hash,
            "status": exec_tx.status,
            "integrity_hash": exec_tx.integrity_hash,
            "explorer_url": blockchain_service.get_explorer_url(exec_tx.blockchain_tx_hash)
            if exec_tx.blockchain_tx_hash else None,
        }

    return response
