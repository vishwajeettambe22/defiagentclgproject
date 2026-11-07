"""Ethereum address utility functions."""
import re

ETH_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def is_valid_eth_address(address: str) -> bool:
    """Return True if address matches 0x + 40 hex chars."""
    return bool(address and ETH_ADDRESS_RE.match(address))


def normalize_address(address: str) -> str:
    """Lowercase the address for consistent storage."""
    return address.lower().strip()


def shorten_address(address: str) -> str:
    """Return 0x1234...abcd display format."""
    if len(address) >= 10:
        return f"{address[:6]}...{address[-4:]}"
    return address
