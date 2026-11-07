"""
Unit tests for the DeFiIntent schema — ensures strict validation of LLM output.
FR-02: Schema validation of structured intent.
"""

import pytest
from pydantic import ValidationError
from app.schemas.intent import DeFiIntent, SupportedOperation, NaturalLanguageRequest


class TestDeFiIntentSchema:
    def test_valid_transfer_intent(self):
        intent = DeFiIntent(
            operation="transfer",
            token_in="ETH",
            amount=0.1,
            recipient="0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
            confidence=0.95,
            requires_confirmation=True,
        )
        assert intent.operation == SupportedOperation.TRANSFER
        assert intent.token_in == "ETH"
        assert intent.requires_confirmation is True

    def test_unsupported_operation_fails(self):
        with pytest.raises(ValidationError):
            DeFiIntent(
                operation="buy",   # Not a supported operation
                token_in="ETH",
                amount=0.1,
                confidence=0.9,
                requires_confirmation=True,
            )

    def test_token_uppercased(self):
        intent = DeFiIntent(
            operation="transfer",
            token_in="usdc",    # lowercase input
            amount=10.0,
            confidence=0.9,
            requires_confirmation=True,
        )
        assert intent.token_in == "USDC"

    def test_confidence_out_of_range_fails(self):
        with pytest.raises(ValidationError):
            DeFiIntent(
                operation="transfer",
                token_in="ETH",
                amount=0.1,
                confidence=1.5,  # Over 1.0
                requires_confirmation=True,
            )

    def test_negative_amount_fails(self):
        with pytest.raises(ValidationError):
            DeFiIntent(
                operation="transfer",
                token_in="ETH",
                amount=-5.0,   # Negative amount
                confidence=0.9,
                requires_confirmation=True,
            )

    def test_requires_confirmation_always_true(self):
        intent = DeFiIntent(
            operation="stake",
            token_in="ETH",
            amount=0.5,
            confidence=0.9,
            requires_confirmation=True,
        )
        assert intent.requires_confirmation is True

    def test_missing_fields_default_empty(self):
        intent = DeFiIntent(
            operation="swap",
            token_in="USDC",
            token_out="ETH",
            amount=100.0,
            confidence=0.9,
            requires_confirmation=True,
        )
        assert intent.missing_fields == []


class TestNaturalLanguageRequest:
    def test_valid_request(self):
        req = NaturalLanguageRequest(
            user_input="Transfer 0.1 ETH to 0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
            wallet_address="0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
        )
        assert req.wallet_address == "0xabcdef1234567890abcdef1234567890abcdef12"

    def test_invalid_wallet_fails(self):
        with pytest.raises(ValidationError):
            NaturalLanguageRequest(
                user_input="Transfer 0.1 ETH",
                wallet_address="not_a_wallet",
            )

    def test_empty_input_fails(self):
        with pytest.raises(ValidationError):
            NaturalLanguageRequest(
                user_input="ab",  # Too short (min_length=3)
                wallet_address="0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
            )
