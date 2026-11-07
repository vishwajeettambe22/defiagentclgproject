"""
Pydantic schemas for structured DeFi intent.

FR-01, FR-02: Natural language is parsed into this strict schema.
The LLM output MUST conform to this schema before any further processing.
LLM output that does not conform to this schema is REJECTED.

Security principle: The LLM produces a structured intent,
not executable calldata. The intent goes to validation next.
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional
from enum import Enum
import re


class SupportedOperation(str, Enum):
    TRANSFER = "transfer"
    SWAP = "swap"
    STAKE = "stake"


class DeFiIntent(BaseModel):
    """
    Structured DeFi transaction intent produced by the AI/NLP module.
    This is the strict schema the LLM must produce.
    All fields are validated by Pydantic before reaching the validator.
    """
    operation: SupportedOperation = Field(
        ..., description="The DeFi operation: transfer, swap, or stake"
    )
    token_in: Optional[str] = Field(
        None, description="Source token symbol (e.g., USDC, ETH)"
    )
    token_out: Optional[str] = Field(
        None, description="Target token symbol for swaps (e.g., ETH)"
    )
    amount: Optional[float] = Field(
        None, ge=0, description="Numeric amount to transact"
    )
    amount_raw: Optional[str] = Field(
        None, description="Amount as expressed by the user"
    )
    recipient: Optional[str] = Field(
        None, description="Recipient wallet address (for transfers)"
    )
    chain: Optional[str] = Field(
        "Sepolia", description="Target blockchain network"
    )
    slippage: Optional[float] = Field(
        None, ge=0, le=50, description="Acceptable slippage % for swaps"
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="AI confidence in parsing accuracy (0–1)"
    )
    requires_confirmation: bool = Field(
        True, description="Always true — user must confirm before execution"
    )
    missing_fields: list[str] = Field(
        default_factory=list,
        description="Fields the AI could not extract from the user input"
    )

    @field_validator("token_in", "token_out", mode="before")
    @classmethod
    def uppercase_token(cls, v):
        if v is not None:
            return v.upper().strip()
        return v

    @field_validator("recipient", mode="before")
    @classmethod
    def validate_address_format(cls, v):
        """Basic Ethereum address format check — full validation is in validation_service."""
        if v is not None and v != "":
            v = v.strip()
            if not re.match(r"^0x[0-9a-fA-F]{40}$", v):
                # Don't raise here — return as-is and let validation service reject it
                pass
        return v

    @field_validator("chain", mode="before")
    @classmethod
    def normalize_chain(cls, v):
        if v is None:
            return "Sepolia"
        return v.strip()


class NaturalLanguageRequest(BaseModel):
    """Input schema for the AI/NLP endpoint."""
    user_input: str = Field(
        ..., min_length=3, max_length=1000,
        description="Natural language DeFi request from the user"
    )
    wallet_address: str = Field(
        ..., description="Connected wallet address"
    )

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet(cls, v):
        if not re.match(r"^0x[0-9a-fA-F]{40}$", v):
            raise ValueError("Invalid Ethereum wallet address format")
        return v.lower()


class IntentResponse(BaseModel):
    """Response schema after NL → intent parsing."""
    model_config = ConfigDict(from_attributes=True)

    request_id: str
    intent: DeFiIntent
    message: str = "Intent parsed successfully. Proceeding to validation."
