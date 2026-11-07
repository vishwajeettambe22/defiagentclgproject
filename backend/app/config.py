"""
Configuration module — all settings read from environment variables.
Never hard-code secrets, keys, or credentials in this file.

FR-03, FR-04: Spending limits and allowed operations are defined here
and enforced deterministically by the validation service.
NFR-03: Open-source/testnet deployable — all infrastructure is configurable.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices, field_validator
from typing import List
from pathlib import Path
import os

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[
            str(_PROJECT_ROOT / ".env"),
            str(_PROJECT_ROOT / "backend" / ".env"),
            ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── AI / NLP ─────────────────────────────────────────────────────────────
    gemini_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY", "gemini_api_key"),
        description="Google Gemini API key for natural language intent parsing",
    )
    ai_model: str = Field(
        default="gemini-2.5-flash",
        validation_alias=AliasChoices("AI_MODEL", "GEMINI_MODEL", "ai_model"),
        description="Gemini model identifier",
    )

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://defi_user:defi_pass@localhost:5432/defi_agent_db"

    # ── Blockchain ────────────────────────────────────────────────────────────
    rpc_url: str = "https://rpc.sepolia.org"
    chain_id: int = 11155111  # Sepolia testnet
    network_name: str = "Sepolia"

    # ── Smart Contracts ───────────────────────────────────────────────────────
    defi_agent_contract: str = "0x0000000000000000000000000000000000000000"
    integrity_anchor_contract: str = "0x0000000000000000000000000000000000000000"

    # ── Security / Validation (FR-03, FR-04) ─────────────────────────────────
    # Hard per-transaction spending limit — validation rejects amounts above this
    max_tx_amount_eth: float = 1.0
    allowed_operations_raw: str = "transfer,swap,stake"
    allowed_tokens_raw: str = "ETH,USDC,DAI,WETH"

    # ── Contract assurance (LeVer, design-time; read-only here) ──────────────
    assurance_report_path: str = str(_PROJECT_ROOT / "contract_assurance" / "reports" / "DeFiAgent.assurance.json")
    assurance_source_path: str = str(_PROJECT_ROOT / "contracts" / "contracts" / "DeFiAgent.sol")

    # ── App ───────────────────────────────────────────────────────────────────
    app_env: str = "development"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins_raw: str = "http://localhost:5173,http://localhost:3000"

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def sanitize_gemini_api_key(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip().strip("'\"")
            placeholders = (
                "your_gemini_api_key_here",
                "your_anthropic_api_key_here",
                "your_api_key_here",
                "your_key_here",
                "<your_api_key>",
                "your_google_api_key_here",
            )
            if v.lower() in placeholders:
                return ""
        return v

    @field_validator("ai_model", mode="before")
    @classmethod
    def sanitize_ai_model(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip().strip("'\"")
            if not v:
                return "gemini-2.5-flash"
        return v

    @property
    def has_valid_gemini_key(self) -> bool:
        return bool(self.gemini_api_key and len(self.gemini_api_key) >= 15)

    @property
    def anthropic_api_key(self) -> str:
        """Deprecated compatibility property pointing to gemini_api_key."""
        return self.gemini_api_key

    @property
    def allowed_operations(self) -> List[str]:
        return [op.strip().lower() for op in self.allowed_operations_raw.split(",")]

    @property
    def allowed_tokens(self) -> List[str]:
        return [t.strip().upper() for t in self.allowed_tokens_raw.split(",")]

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",")]

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() == "development"


# Singleton — import `settings` everywhere
settings = Settings()
