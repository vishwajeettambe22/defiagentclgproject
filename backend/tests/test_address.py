"""Unit tests for Ethereum address validation utilities."""
import pytest
from app.utils.address import is_valid_eth_address, normalize_address, shorten_address


class TestAddressValidation:
    def test_valid_address(self):
        assert is_valid_eth_address("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12")

    def test_valid_lowercase(self):
        assert is_valid_eth_address("0x" + "a" * 40)

    def test_valid_uppercase(self):
        assert is_valid_eth_address("0x" + "A" * 40)

    def test_zero_address(self):
        # Format is valid — blacklist check is in validator
        assert is_valid_eth_address("0x" + "0" * 40)

    def test_no_0x_prefix_fails(self):
        assert not is_valid_eth_address("AbCdEf1234567890AbCdEf1234567890AbCdEf12")

    def test_too_short_fails(self):
        assert not is_valid_eth_address("0x1234")

    def test_too_long_fails(self):
        assert not is_valid_eth_address("0x" + "a" * 41)

    def test_non_hex_chars_fail(self):
        assert not is_valid_eth_address("0x" + "g" * 40)

    def test_empty_fails(self):
        assert not is_valid_eth_address("")

    def test_none_fails(self):
        assert not is_valid_eth_address(None)


class TestNormalize:
    def test_lowercase(self):
        assert normalize_address("0xABCD1234") == "0xabcd1234"

    def test_strips_whitespace(self):
        assert normalize_address("  0xabc  ") == "0xabc"


class TestShorten:
    def test_shortens_full_address(self):
        addr = "0x" + "a" * 40
        short = shorten_address(addr)
        assert "..." in short
        assert short.startswith("0x")
        assert len(short) < len(addr)
