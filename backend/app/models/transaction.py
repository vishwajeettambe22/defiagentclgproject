"""
Database models for the DeFi Transaction Agent.

FR-08: Transaction recording and integrity support.
All entities map to the documented architecture modules.

SECURITY: Private keys and seed phrases are NEVER stored here.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    String, Float, Integer, Boolean, Text, DateTime,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ── Enums ─────────────────────────────────────────────────────────────────────

class OperationType(str, enum.Enum):
    TRANSFER = "transfer"
    SWAP = "swap"
    STAKE = "stake"


class ValidationStatus(str, enum.Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"


class TransactionStatus(str, enum.Enum):
    INTENT_RECEIVED = "intent_received"       # NL received, intent parsing started
    INTENT_PARSED = "intent_parsed"            # Structured intent created
    VALIDATION_PASSED = "validation_passed"    # Deterministic validation passed
    VALIDATION_FAILED = "validation_failed"    # Validation failed → no execution
    PREVIEW_SHOWN = "preview_shown"            # User shown transaction preview
    USER_APPROVED = "user_approved"            # User approved in wallet
    USER_REJECTED = "user_rejected"            # User rejected in wallet
    EXECUTING = "executing"                    # Submitted to blockchain
    COMPLETED = "completed"                    # Confirmed on blockchain
    FAILED = "failed"                          # Blockchain execution failed


# ── Models ────────────────────────────────────────────────────────────────────

class TransactionRequest(Base):
    """
    Root entity for every user DeFi request.
    Created when the user submits a natural-language command.
    Maps to: FR-01 (NL input received), FR-08 (transaction recording).
    """
    __tablename__ = "transaction_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    wallet_address: Mapped[str] = mapped_column(String(42), nullable=False, index=True)
    natural_language_input: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TransactionStatus] = mapped_column(
        SAEnum(TransactionStatus), default=TransactionStatus.INTENT_RECEIVED, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    intent: Mapped[Optional["StructuredIntent"]] = relationship(
        back_populates="request", uselist=False, cascade="all, delete-orphan"
    )
    validation_result: Mapped[Optional["ValidationResult"]] = relationship(
        back_populates="request", uselist=False, cascade="all, delete-orphan"
    )
    preview: Mapped[Optional["TransactionPreview"]] = relationship(
        back_populates="request", uselist=False, cascade="all, delete-orphan"
    )
    executed_transaction: Mapped[Optional["ExecutedTransaction"]] = relationship(
        back_populates="request", uselist=False, cascade="all, delete-orphan"
    )


class StructuredIntent(Base):
    """
    Structured DeFi intent produced by the AI/NLP module.
    FR-02: Natural language → structured transaction details.

    This is what the LLM produces. It is NOT executed directly.
    It goes to validation first (FR-03, FR-04).
    """
    __tablename__ = "structured_intents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transaction_requests.id"), nullable=False, unique=True
    )
    operation: Mapped[str] = mapped_column(String(32), nullable=False)   # transfer/swap/stake
    token_in: Mapped[Optional[str]] = mapped_column(String(16))          # e.g. USDC
    token_out: Mapped[Optional[str]] = mapped_column(String(16))         # e.g. ETH (for swap)
    amount: Mapped[Optional[float]] = mapped_column(Float)               # numeric amount
    amount_raw: Mapped[Optional[str]] = mapped_column(String(64))        # as user said it
    recipient: Mapped[Optional[str]] = mapped_column(String(42))         # wallet address
    chain: Mapped[Optional[str]] = mapped_column(String(32))
    slippage: Mapped[Optional[float]] = mapped_column(Float)             # swap slippage %
    confidence: Mapped[Optional[float]] = mapped_column(Float)           # AI confidence 0-1
    requires_confirmation: Mapped[bool] = mapped_column(Boolean, default=True)
    raw_ai_output: Mapped[Optional[str]] = mapped_column(Text)           # debug: raw LLM JSON
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    request: Mapped["TransactionRequest"] = relationship(back_populates="intent")


class ValidationResult(Base):
    """
    Deterministic validation result.
    FR-03: Validate against amount, operation, permission, security rules.
    FR-04: Rejection of invalid/unauthorized transactions.
    NFR-01: Explainable, evidence-linked validation outcomes.
    """
    __tablename__ = "validation_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transaction_requests.id"), nullable=False, unique=True
    )
    status: Mapped[ValidationStatus] = mapped_column(
        SAEnum(ValidationStatus), default=ValidationStatus.PENDING, nullable=False
    )
    # Structured breakdown of each check (NFR-01: explainable)
    operation_check: Mapped[bool] = mapped_column(Boolean, default=False)
    token_check: Mapped[bool] = mapped_column(Boolean, default=False)
    amount_check: Mapped[bool] = mapped_column(Boolean, default=False)
    recipient_check: Mapped[bool] = mapped_column(Boolean, default=False)
    spending_limit_check: Mapped[bool] = mapped_column(Boolean, default=False)
    completeness_check: Mapped[bool] = mapped_column(Boolean, default=False)

    failure_reasons: Mapped[Optional[str]] = mapped_column(Text)  # JSON list of reasons
    human_readable_summary: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    request: Mapped["TransactionRequest"] = relationship(back_populates="validation_result")


class TransactionPreview(Base):
    """
    Human-readable transaction preview shown to user before execution.
    FR-05: Pre-execution preview.
    NFR-02: Clear separation between preview and execution.
    """
    __tablename__ = "transaction_previews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transaction_requests.id"), nullable=False, unique=True
    )
    operation_display: Mapped[str] = mapped_column(String(64))
    token_display: Mapped[Optional[str]] = mapped_column(String(32))
    amount_display: Mapped[Optional[str]] = mapped_column(String(64))
    recipient_display: Mapped[Optional[str]] = mapped_column(String(64))
    network_display: Mapped[Optional[str]] = mapped_column(String(32))
    estimated_gas_display: Mapped[Optional[str]] = mapped_column(String(64))
    warnings: Mapped[Optional[str]] = mapped_column(Text)        # JSON list of warnings
    security_checks_summary: Mapped[Optional[str]] = mapped_column(Text)
    shown_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    request: Mapped["TransactionRequest"] = relationship(back_populates="preview")


class ExecutedTransaction(Base):
    """
    On-chain transaction record after wallet authorization and execution.
    FR-07: Executed through smart contracts.
    FR-08: Transaction recording and integrity support.
    """
    __tablename__ = "executed_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transaction_requests.id"), nullable=False, unique=True
    )
    # On-chain identifiers
    blockchain_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), index=True)
    block_number: Mapped[Optional[int]] = mapped_column(Integer)
    chain_id: Mapped[Optional[int]] = mapped_column(Integer)

    # Transaction details (stored for audit/dashboard)
    from_address: Mapped[str] = mapped_column(String(42))
    to_address: Mapped[Optional[str]] = mapped_column(String(42))
    operation: Mapped[str] = mapped_column(String(32))
    token: Mapped[Optional[str]] = mapped_column(String(16))
    amount_wei: Mapped[Optional[str]] = mapped_column(String(78))   # full precision
    amount_display: Mapped[Optional[str]] = mapped_column(String(64))
    gas_used: Mapped[Optional[str]] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="pending")

    # Integrity (FR-08)
    integrity_hash: Mapped[Optional[str]] = mapped_column(String(66))  # SHA-256 hex
    integrity_anchor_tx: Mapped[Optional[str]] = mapped_column(String(66))  # on-chain anchor tx
    integrity_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    request: Mapped["TransactionRequest"] = relationship(back_populates="executed_transaction")


class WalletUser(Base):
    """
    Wallet-based user profile.
    The wallet address is the primary identity — no passwords, no custodial keys.
    Created automatically when a wallet first connects to the application.
    """
    __tablename__ = "wallet_users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    wallet_address: Mapped[str] = mapped_column(
        String(42), nullable=False, unique=True, index=True
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(64))  # optional alias
    preferred_network: Mapped[str] = mapped_column(String(32), default="Sepolia")
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    total_requests: Mapped[int] = mapped_column(Integer, default=0)
    total_completed: Mapped[int] = mapped_column(Integer, default=0)

    # SECURITY: Never store private keys, seed phrases, or signing material
