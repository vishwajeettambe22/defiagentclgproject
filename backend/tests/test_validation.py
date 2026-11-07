"""
Unit tests for the deterministic validation service.
FR-03, FR-04, NFR-01.
"""

import pytest
from app.schemas.intent import DeFiIntent, SupportedOperation
from app.services.validation_service import ValidationService


@pytest.fixture
def validator():
    return ValidationService()


def make_intent(**kwargs):
    defaults = {
        "operation": SupportedOperation.TRANSFER,
        "token_in": "ETH",
        "token_out": None,
        "amount": 0.1,
        "amount_raw": "0.1 ETH",
        "recipient": "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
        "chain": "Sepolia",
        "slippage": None,
        "confidence": 0.95,
        "requires_confirmation": True,
        "missing_fields": [],
    }
    defaults.update(kwargs)
    return DeFiIntent(**defaults)


class TestOperationValidation:
    def test_transfer_is_supported(self, validator):
        result = validator.validate(make_intent(operation=SupportedOperation.TRANSFER))
        op = next(c for c in result.checks if c.check_name == "Supported Operation")
        assert op.passed

    def test_swap_is_supported(self, validator):
        intent = make_intent(operation=SupportedOperation.SWAP, token_in="USDC", token_out="ETH", recipient=None)
        result = validator.validate(intent)
        op = next(c for c in result.checks if c.check_name == "Supported Operation")
        assert op.passed

    def test_stake_is_supported(self, validator):
        intent = make_intent(operation=SupportedOperation.STAKE, token_in="ETH", recipient=None)
        result = validator.validate(intent)
        op = next(c for c in result.checks if c.check_name == "Supported Operation")
        assert op.passed


class TestAmountValidation:
    def test_valid_amount_passes(self, validator):
        result = validator.validate(make_intent(amount=0.05))
        amt = next(c for c in result.checks if c.check_name == "Amount Validation")
        assert amt.passed

    def test_zero_amount_fails(self, validator):
        result = validator.validate(make_intent(amount=0.0))
        amt = next(c for c in result.checks if c.check_name == "Amount Validation")
        assert not amt.passed and result.overall_status == "failed"

    def test_negative_amount_rejected_by_schema(self):
        """Negative amounts are rejected at the Pydantic schema level — before the validator.
        This is the first line of defense: the LLM cannot produce a negative amount
        that bypasses schema validation."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            make_intent(amount=-1.0)

    def test_none_amount_fails(self, validator):
        result = validator.validate(make_intent(amount=None))
        amt = next(c for c in result.checks if c.check_name == "Amount Validation")
        assert not amt.passed


class TestSpendingLimit:
    def test_within_limit_passes(self, validator):
        result = validator.validate(make_intent(amount=0.5))
        lim = next(c for c in result.checks if c.check_name == "Spending Limit")
        assert lim.passed

    def test_exceeds_limit_fails(self, validator):
        result = validator.validate(make_intent(amount=999.0))
        lim = next(c for c in result.checks if c.check_name == "Spending Limit")
        assert not lim.passed and result.overall_status == "failed"
        assert any("spending limit" in r.lower() for r in result.failure_reasons)

    def test_at_limit_passes(self, validator):
        result = validator.validate(make_intent(amount=1.0))
        lim = next(c for c in result.checks if c.check_name == "Spending Limit")
        assert lim.passed


class TestRecipientValidation:
    def test_valid_address_passes(self, validator):
        result = validator.validate(make_intent(recipient="0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"))
        rec = next(c for c in result.checks if c.check_name == "Recipient Address")
        assert rec.passed

    def test_zero_address_fails(self, validator):
        result = validator.validate(make_intent(recipient="0x0000000000000000000000000000000000000000"))
        rec = next(c for c in result.checks if c.check_name == "Recipient Address")
        assert not rec.passed

    def test_invalid_format_fails(self, validator):
        result = validator.validate(make_intent(recipient="not_an_address"))
        rec = next(c for c in result.checks if c.check_name == "Recipient Address")
        assert not rec.passed

    def test_swap_no_recipient_passes(self, validator):
        intent = make_intent(operation=SupportedOperation.SWAP, token_in="USDC", token_out="ETH", recipient=None)
        result = validator.validate(intent)
        rec = next(c for c in result.checks if c.check_name == "Recipient Address")
        assert rec.passed

    def test_transfer_missing_recipient_fails(self, validator):
        result = validator.validate(make_intent(operation=SupportedOperation.TRANSFER, recipient=None))
        assert result.overall_status == "failed"


class TestTokenValidation:
    def test_eth_is_allowed(self, validator):
        result = validator.validate(make_intent(token_in="ETH"))
        tok = next(c for c in result.checks if c.check_name == "Token Validation")
        assert tok.passed

    def test_usdc_is_allowed(self, validator):
        intent = make_intent(operation=SupportedOperation.STAKE, token_in="USDC", recipient=None)
        result = validator.validate(intent)
        tok = next(c for c in result.checks if c.check_name == "Token Validation")
        assert tok.passed

    def test_unsupported_token_fails(self, validator):
        result = validator.validate(make_intent(token_in="DOGE"))
        tok = next(c for c in result.checks if c.check_name == "Token Validation")
        assert not tok.passed and result.overall_status == "failed"


class TestCompleteness:
    def test_complete_transfer_passes(self, validator):
        intent = make_intent(operation=SupportedOperation.TRANSFER, token_in="ETH",
                             amount=0.1, recipient="0xAbCdEf1234567890AbCdEf1234567890AbCdEf12")
        result = validator.validate(intent)
        comp = next(c for c in result.checks if c.check_name == "Intent Completeness")
        assert comp.passed

    def test_swap_missing_token_out_fails(self, validator):
        intent = make_intent(operation=SupportedOperation.SWAP, token_in="USDC", token_out=None, recipient=None)
        result = validator.validate(intent)
        comp = next(c for c in result.checks if c.check_name == "Intent Completeness")
        assert not comp.passed

    def test_complete_swap_passes(self, validator):
        intent = make_intent(operation=SupportedOperation.SWAP, token_in="USDC",
                             token_out="ETH", amount=100.0, recipient=None)
        result = validator.validate(intent)
        comp = next(c for c in result.checks if c.check_name == "Intent Completeness")
        assert comp.passed


class TestExplainabilityNFR01:
    def test_failure_has_readable_reason(self, validator):
        result = validator.validate(make_intent(amount=999.0))
        assert result.overall_status == "failed"
        assert len(result.failure_reasons) > 0
        assert all(len(r) > 10 for r in result.failure_reasons)

    def test_success_has_summary(self, validator):
        result = validator.validate(make_intent())
        assert result.overall_status == "passed"
        assert len(result.human_readable_summary) > 0

    def test_all_six_checks_reported(self, validator):
        result = validator.validate(make_intent())
        names = {c.check_name for c in result.checks}
        assert names == {
            "Supported Operation", "Token Validation", "Amount Validation",
            "Spending Limit", "Recipient Address", "Intent Completeness"
        }


class TestSecurityBoundaryNFR02:
    def test_failed_validation_blocks_preview(self, validator):
        result = validator.validate(make_intent(amount=999.0))
        assert not result.can_proceed_to_preview

    def test_passed_validation_allows_preview(self, validator):
        result = validator.validate(make_intent())
        assert result.can_proceed_to_preview
