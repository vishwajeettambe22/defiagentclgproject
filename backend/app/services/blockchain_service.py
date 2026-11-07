"""
Blockchain Service — Module 6 of the documented architecture.

FR-07: Execute approved transactions through smart contracts.
FR-08: On-chain transaction recording.

SECURITY DESIGN:
The backend does NOT hold private keys.
The user signs transactions with MetaMask in the frontend.
The backend provides:
  - transaction parameters for MetaMask to display
  - RPC endpoint queries for transaction status
  - contract call data (not signed calldata — just parameters)

Transaction flow:
1. Backend prepares transaction parameters.
2. Frontend passes parameters to MetaMask (ethers.js).
3. MetaMask prompts user to sign.
4. User signs → MetaMask submits to network.
5. Frontend sends the resulting tx hash to backend.
6. Backend records it and monitors confirmation.
"""

import logging
from typing import Optional, Dict, Any

from web3 import Web3
from web3.exceptions import Web3Exception

from app.config import settings

logger = logging.getLogger(__name__)


class BlockchainService:
    """
    Web3 interaction service.
    Handles: status queries, tx monitoring, contract interactions.
    Does NOT handle: signing, private keys, or autonomous fund movement.
    """

    def __init__(self):
        self._w3: Optional[Web3] = None

    def _get_web3(self) -> Web3:
        if self._w3 is None or not self._w3.is_connected():
            self._w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
            if not self._w3.is_connected():
                logger.warning("Web3 not connected to RPC. Using offline mode.")
        return self._w3

    @property
    def is_connected(self) -> bool:
        try:
            return self._get_web3().is_connected()
        except Exception:
            return False

    def get_transaction_parameters(
        self,
        operation: str,
        token: Optional[str],
        amount: float,
        recipient: Optional[str],
        from_address: str,
    ) -> Dict[str, Any]:
        """
        Build transaction parameters for the frontend to pass to MetaMask.
        This is the data MetaMask needs to display the transaction to the user.

        The frontend (ethers.js) uses these parameters to call:
            signer.sendTransaction(params) or contract.method(params)

        Returns a dict of parameters — NOT a signed transaction.
        """
        w3 = self._get_web3()

        try:
            gas_price = w3.eth.gas_price if self.is_connected else Web3.to_wei(20, "gwei")
        except Exception:
            gas_price = Web3.to_wei(20, "gwei")

        params: Dict[str, Any] = {
            "from": from_address,
            "chainId": settings.chain_id,
            "gasPrice": str(gas_price),
        }

        if operation == "transfer":
            if (token or "").upper() == "ETH":
                # Native ETH transfer
                params.update({
                    "to": recipient,
                    "value": str(Web3.to_wei(amount, "ether")),
                    "gas": "21000",
                    "transaction_type": "eth_transfer",
                })
            else:
                # ERC-20 token transfer — requires contract address
                params.update({
                    "to": settings.defi_agent_contract,  # Token contract
                    "value": "0",
                    "gas": "100000",
                    "transaction_type": "erc20_transfer",
                    "token": token,
                    "token_recipient": recipient,
                    "token_amount": str(amount),
                })

        elif operation == "swap":
            params.update({
                "to": settings.defi_agent_contract,
                "value": "0",
                "gas": "200000",
                "transaction_type": "swap",
                "token_in": token,
                "amount_in": str(amount),
            })

        elif operation == "stake":
            params.update({
                "to": settings.defi_agent_contract,
                "value": str(Web3.to_wei(amount, "ether")) if (token or "").upper() == "ETH" else "0",
                "gas": "150000",
                "transaction_type": "stake",
                "token": token,
                "stake_amount": str(amount),
            })

        return params

    def get_transaction_status(self, tx_hash: str) -> Dict[str, Any]:
        """
        Query the RPC for transaction status.
        Called after the user has submitted the transaction via MetaMask.
        """
        try:
            w3 = self._get_web3()
            if not self.is_connected:
                return {"status": "unknown", "error": "RPC not connected"}

            tx = w3.eth.get_transaction(tx_hash)
            if tx is None:
                return {"status": "pending", "tx_hash": tx_hash}

            receipt = w3.eth.get_transaction_receipt(tx_hash)
            if receipt is None:
                return {"status": "pending", "tx_hash": tx_hash}

            success = receipt.get("status", 0) == 1
            return {
                "status": "confirmed" if success else "failed",
                "tx_hash": tx_hash,
                "block_number": receipt.get("blockNumber"),
                "gas_used": str(receipt.get("gasUsed", "")),
                "success": success,
            }

        except Web3Exception as e:
            logger.error(f"Web3 error checking tx {tx_hash}: {e}")
            return {"status": "error", "error": str(e), "tx_hash": tx_hash}
        except Exception as e:
            logger.error(f"Unexpected error checking tx {tx_hash}: {e}")
            return {"status": "error", "error": str(e), "tx_hash": tx_hash}

    def get_explorer_url(self, tx_hash: str) -> str:
        """Build a block explorer URL for the given transaction hash."""
        if settings.chain_id == 11155111:
            return f"https://sepolia.etherscan.io/tx/{tx_hash}"
        return f"https://etherscan.io/tx/{tx_hash}"


# Module-level singleton
blockchain_service = BlockchainService()
