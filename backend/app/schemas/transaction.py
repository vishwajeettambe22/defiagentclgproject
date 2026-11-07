"""
Pydantic schemas for validation, preview, execution and dashboard responses.

NFR-01: Validation responses are explainable — each check is reported individually.
NFR-02: Preview and execution are separate request/response schemas.
FR-08: Executed transaction and integrity schemas.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.assurance import ContractAssuranceSummary
from enum import Enum
import uuid


# ── Validation ────────────────────────────────────────────────────────────────

class ValidationCheckDetail(BaseModel):
    """Individual validation check result — NFR-01: explainable."""
    check_name: str
    passed: bool
    reason: Optional[str] = None


class ValidationResponse(BaseModel):
    """
    Full validation result returned to the frontend.
    NFR-01: Each check is individually reported with a reason.
    FR-04: Failed validation means no execution proceeds.
    """
    model_config = ConfigDict(from_attributes=True)

    request_id: str
    overall_status: str          # "passed" or "failed"
    checks: List[ValidationCheckDetail]
    failure_reasons: List[str]   # Human-readable list for the UI
    human_readable_summary: str
    can_proceed_to_preview: bool  # False if any check failed


# ── Transaction Preview ────────────────────────────────────────────────────────

class TransactionPreviewResponse(BaseModel):
    """
    Transaction preview shown to user before wallet signing.
    FR-05: Pre-execution preview.
    NFR-02: This is a PREVIEW — no blockchain action occurs until user approves.
    """
    model_config = ConfigDict(from_attributes=True)

    request_id: str
    preview_id: str

    # What the user is about to authorize
    operation: str
    token: Optional[str] = None
    amount: Optional[str] = None
    recipient: Optional[str] = None
    network: str
    estimated_gas: Optional[str] = None

    # Security context (NFR-01)
    validation_summary: str
    security_checks: List[str]
    warnings: List[str]

    # Design-time contract assurance (LeVer) — informational, never a gate
    contract_assurance: Optional[ContractAssuranceSummary] = None

    # Clear confirmation instruction
    authorization_instruction: str = (
        "Review the above details carefully. "
        "Click 'Approve' to sign with your wallet. "
        "No transaction will occur unless you explicitly approve."
    )


# ── Execution ─────────────────────────────────────────────────────────────────

class ExecuteRequest(BaseModel):
    """
    Sent from frontend after user approves in wallet.
    FR-06: Explicit user approval/signature.
    FR-07: Approved transaction execution.
    """
    request_id: str = Field(..., description="The request that was previewed and approved")
    wallet_address: str = Field(..., description="User's wallet address")
    # The signed transaction hash from MetaMask (frontend signs, backend records)
    signed_tx_hash: Optional[str] = Field(
        None,
        description="Transaction hash after user-signed execution (submitted by frontend)"
    )


class ExecuteResponse(BaseModel):
    """Response after transaction execution."""
    model_config = ConfigDict(from_attributes=True)

    request_id: str
    blockchain_tx_hash: Optional[str]
    status: str
    message: str
    explorer_url: Optional[str] = None


# ── Transaction Record + Integrity ────────────────────────────────────────────

class IntegrityVerificationRequest(BaseModel):
    """Request to verify a transaction record's integrity. FR-08."""
    request_id: str


class IntegrityVerificationResponse(BaseModel):
    """
    Result of integrity check. FR-08: tamper-evident transaction record.
    ON-CHAIN: blockchain_tx_hash, integrity_anchor_tx
    OFF-CHAIN: detailed application record, UI metadata
    """
    model_config = ConfigDict(from_attributes=True)

    request_id: str
    is_intact: bool
    computed_hash: str
    stored_hash: Optional[str]
    anchor_tx_hash: Optional[str]
    verification_message: str
    verified_at: str


# ── Dashboard / Transaction History ───────────────────────────────────────────

class TransactionSummary(BaseModel):
    """Summary record for dashboard/history list. FR-08, Dashboard module."""
    model_config = ConfigDict(from_attributes=True)

    request_id: str
    operation: str
    token: Optional[str]
    amount: Optional[str]
    recipient: Optional[str]
    network: Optional[str]
    status: str
    blockchain_tx_hash: Optional[str]
    created_at: datetime
    integrity_hash: Optional[str]


class DashboardResponse(BaseModel):
    """Dashboard overview response."""
    wallet_address: str
    total_transactions: int
    completed_transactions: int
    failed_transactions: int
    recent_transactions: List[TransactionSummary]


# ── Error ─────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Standard error response — always human-readable."""
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None
