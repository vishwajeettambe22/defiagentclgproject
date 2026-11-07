"""
Transaction Integrity Service — Module 7 of the documented architecture.

FR-08: Record blockchain transaction information and support integrity/audit.

DESIGN:
- A canonical record of the transaction is built from authoritative fields.
- A SHA-256 hash of this canonical record is computed.
- This hash is stored off-chain (database) and anchored on-chain via the smart contract.
- Later, the hash can be recomputed and compared to detect tampering.

CLARITY (do not overclaim):
- ON-CHAIN: blockchain tx hash + integrity anchor hash
- OFF-CHAIN: detailed application records, dashboard metadata
- The mechanism provides tamper-evidence for the application record,
  not immutability of the entire application or arbitrary data.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class IntegrityService:
    """
    Generates and verifies cryptographic integrity hashes for transaction records.
    FR-08: Tamper-evident transaction/audit support.
    """

    def compute_integrity_hash(
        self,
        *,
        request_id: str,
        wallet_address: str,
        operation: str,
        token: Optional[str],
        amount: Optional[str],
        recipient: Optional[str],
        blockchain_tx_hash: Optional[str],
        chain_id: Optional[int],
        executed_at: Optional[datetime],
    ) -> str:
        """
        Compute a SHA-256 hash over the canonical transaction record fields.

        The canonical record is a deterministic JSON object with sorted keys.
        The same inputs always produce the same hash.

        Returns: hex string of the SHA-256 hash (64 characters).
        """
        canonical = self._build_canonical_record(
            request_id=request_id,
            wallet_address=wallet_address,
            operation=operation,
            token=token,
            amount=amount,
            recipient=recipient,
            blockchain_tx_hash=blockchain_tx_hash,
            chain_id=chain_id,
            executed_at=executed_at,
        )

        canonical_bytes = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
        hash_hex = hashlib.sha256(canonical_bytes).hexdigest()

        logger.debug(
            f"Integrity hash computed for request_id={request_id}: "
            f"{hash_hex[:16]}... (canonical: {len(canonical_bytes)} bytes)"
        )
        return hash_hex

    def verify_integrity(
        self,
        *,
        stored_hash: str,
        request_id: str,
        wallet_address: str,
        operation: str,
        token: Optional[str],
        amount: Optional[str],
        recipient: Optional[str],
        blockchain_tx_hash: Optional[str],
        chain_id: Optional[int],
        executed_at: Optional[datetime],
    ) -> tuple[bool, str]:
        """
        Verify a transaction record's integrity by recomputing and comparing the hash.

        Returns: (is_intact: bool, computed_hash: str)
        If the computed hash matches stored_hash → record is intact.
        If they differ → record may have been tampered with.
        """
        computed_hash = self.compute_integrity_hash(
            request_id=request_id,
            wallet_address=wallet_address,
            operation=operation,
            token=token,
            amount=amount,
            recipient=recipient,
            blockchain_tx_hash=blockchain_tx_hash,
            chain_id=chain_id,
            executed_at=executed_at,
        )

        is_intact = computed_hash == stored_hash

        if is_intact:
            logger.info(f"Integrity verification PASSED for request_id={request_id}")
        else:
            logger.warning(
                f"Integrity verification FAILED for request_id={request_id}. "
                f"Stored: {stored_hash[:16]}... Computed: {computed_hash[:16]}..."
            )

        return is_intact, computed_hash

    def _build_canonical_record(
        self,
        *,
        request_id: str,
        wallet_address: str,
        operation: str,
        token: Optional[str],
        amount: Optional[str],
        recipient: Optional[str],
        blockchain_tx_hash: Optional[str],
        chain_id: Optional[int],
        executed_at: Optional[datetime],
    ) -> dict:
        """
        Build the canonical dict that is hashed.
        All fields are normalized to strings for consistent serialization.
        None values are represented as empty strings (not null) for stability.
        """
        return {
            "request_id": str(request_id),
            "wallet_address": (wallet_address or "").lower(),
            "operation": (operation or "").lower(),
            "token": (token or "").upper(),
            "amount": str(amount or ""),
            "recipient": (recipient or "").lower(),
            "blockchain_tx_hash": (blockchain_tx_hash or "").lower(),
            "chain_id": str(chain_id or ""),
            "executed_at": (
                executed_at.isoformat() if executed_at else ""
            ),
        }


# Module-level singleton
integrity_service = IntegrityService()
