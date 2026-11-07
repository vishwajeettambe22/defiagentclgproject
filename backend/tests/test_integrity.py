"""
Unit tests for the integrity service.
FR-08: Cryptographic hash generation and verification.
"""

import pytest
from datetime import datetime, timezone
from app.services.integrity_service import IntegrityService


@pytest.fixture
def svc():
    return IntegrityService()


SAMPLE_PARAMS = dict(
    request_id="550e8400-e29b-41d4-a716-446655440000",
    wallet_address="0xabcdef1234567890abcdef1234567890abcdef12",
    operation="transfer",
    token="ETH",
    amount="0.1",
    recipient="0x1234567890abcdef1234567890abcdef12345678",
    blockchain_tx_hash="0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    chain_id=11155111,
    executed_at=datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
)


class TestHashGeneration:
    def test_returns_64_char_hex(self, svc):
        h = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_deterministic(self, svc):
        h1 = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        h2 = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        assert h1 == h2

    def test_different_tx_hash_differs(self, svc):
        h1 = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        params2 = {**SAMPLE_PARAMS, "blockchain_tx_hash": "0x" + "a" * 64}
        h2 = svc.compute_integrity_hash(**params2)
        assert h1 != h2

    def test_different_amount_differs(self, svc):
        h1 = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        params2 = {**SAMPLE_PARAMS, "amount": "0.2"}
        h2 = svc.compute_integrity_hash(**params2)
        assert h1 != h2

    def test_different_wallet_differs(self, svc):
        h1 = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        params2 = {**SAMPLE_PARAMS, "wallet_address": "0x" + "b" * 40}
        h2 = svc.compute_integrity_hash(**params2)
        assert h1 != h2

    def test_none_fields_handled(self, svc):
        params = {**SAMPLE_PARAMS, "recipient": None, "blockchain_tx_hash": None}
        h = svc.compute_integrity_hash(**params)
        assert len(h) == 64

    def test_case_insensitive_wallet(self, svc):
        params_lower = {**SAMPLE_PARAMS, "wallet_address": SAMPLE_PARAMS["wallet_address"].lower()}
        params_upper = {**SAMPLE_PARAMS, "wallet_address": SAMPLE_PARAMS["wallet_address"].upper()}
        # Both should produce the same hash (normalized to lowercase)
        h1 = svc.compute_integrity_hash(**params_lower)
        h2 = svc.compute_integrity_hash(**params_upper)
        assert h1 == h2


class TestVerification:
    def test_verification_passes_for_intact_record(self, svc):
        stored_hash = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        is_intact, computed = svc.verify_integrity(stored_hash=stored_hash, **SAMPLE_PARAMS)
        assert is_intact
        assert computed == stored_hash

    def test_verification_fails_for_tampered_amount(self, svc):
        stored_hash = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        tampered = {**SAMPLE_PARAMS, "amount": "999.0"}  # Tampered amount
        is_intact, computed = svc.verify_integrity(stored_hash=stored_hash, **tampered)
        assert not is_intact
        assert computed != stored_hash

    def test_verification_fails_for_tampered_recipient(self, svc):
        stored_hash = svc.compute_integrity_hash(**SAMPLE_PARAMS)
        tampered = {**SAMPLE_PARAMS, "recipient": "0x" + "f" * 40}
        is_intact, computed = svc.verify_integrity(stored_hash=stored_hash, **tampered)
        assert not is_intact

    def test_wrong_stored_hash_fails(self, svc):
        is_intact, _ = svc.verify_integrity(
            stored_hash="0" * 64, **SAMPLE_PARAMS
        )
        assert not is_intact
