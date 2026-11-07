"""
Pydantic schemas for wallet/user profile endpoints.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re


class WalletRegisterRequest(BaseModel):
    wallet_address: str = Field(..., description="Ethereum wallet address (0x...)")
    network: str = Field(default="Sepolia")

    @field_validator("wallet_address")
    @classmethod
    def validate_address(cls, v):
        if not re.match(r"^0x[0-9a-fA-F]{40}$", v):
            raise ValueError("Invalid Ethereum address")
        return v.lower()


class WalletProfile(BaseModel):
    wallet_address: str
    display_name: Optional[str]
    preferred_network: str
    first_seen_at: datetime
    last_seen_at: datetime
    total_requests: int
    total_completed: int
    is_new_user: bool = False

    model_config = {"from_attributes": True}


class TokenBalance(BaseModel):
    symbol: str
    name: str
    balance: str           # Human-readable (e.g. "1.234")
    balance_raw: str       # Wei / base units
    decimals: int
    contract_address: Optional[str] = None  # None = native ETH


class WalletBalances(BaseModel):
    wallet_address: str
    network: str
    block_number: Optional[int]
    balances: List[TokenBalance]
    fetched_at: str


class TransactionDetail(BaseModel):
    """Full transaction detail — wallet ownership is verified server-side."""
    request_id: str
    wallet_address: str
    natural_language_input: str
    status: str
    created_at: datetime

    # Intent
    operation: Optional[str]
    token_in: Optional[str]
    token_out: Optional[str]
    amount: Optional[float]
    recipient: Optional[str]
    confidence: Optional[float]

    # Validation
    validation_status: Optional[str]
    validation_summary: Optional[str]
    validation_checks: Optional[dict]

    # Execution
    blockchain_tx_hash: Optional[str]
    block_number: Optional[int]
    gas_used: Optional[str]
    from_address: Optional[str]
    to_address: Optional[str]
    executed_at: Optional[datetime]
    confirmed_at: Optional[datetime]
    explorer_url: Optional[str]

    # Integrity
    integrity_hash: Optional[str]
    integrity_anchor_tx: Optional[str]
    integrity_verified_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ConfirmTxRequest(BaseModel):
    """Request to poll blockchain and update a transaction's confirmed status."""
    tx_hash: str = Field(..., description="Blockchain tx hash to poll for confirmation")
    request_id: str
