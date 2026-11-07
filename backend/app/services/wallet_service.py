"""
Wallet Service — manages wallet-based user profiles.

The wallet address is the primary identity.
No passwords, no custodial keys, no seed phrases.
Creating a "user" means creating an application record
associated with a public wallet address.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.transaction import WalletUser, TransactionRequest, ExecutedTransaction, TransactionStatus
from app.schemas.wallet import WalletProfile, WalletBalances, TokenBalance, TransactionDetail
from app.services.blockchain_service import blockchain_service
from app.config import settings

logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


# ERC-20 tokens known for Sepolia testnet
# In a production system this would come from a token registry
KNOWN_SEPOLIA_TOKENS = [
    {
        "symbol": "USDC",
        "name": "USD Coin (Testnet)",
        "decimals": 6,
        # Standard test USDC on Sepolia — may vary; update after deployment
        "address": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    },
    {
        "symbol": "DAI",
        "name": "Dai Stablecoin (Testnet)",
        "decimals": 18,
        "address": "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6",
    },
]

# Minimal ERC-20 ABI for balance reading
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    }
]


class WalletService:

    async def register_or_load(
        self, db: AsyncSession, wallet_address: str, network: str = "Sepolia"
    ) -> tuple[WalletProfile, bool]:
        """
        Create a new wallet profile or load the existing one.
        Returns (profile, is_new_user).
        Called every time a wallet connects.
        """
        wallet_address = wallet_address.lower()
        result = await db.execute(
            select(WalletUser).where(WalletUser.wallet_address == wallet_address)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update last seen
            existing.last_seen_at = utcnow()
            await db.flush()
            logger.info(f"Wallet reconnected: {wallet_address[:10]}...")
            return self._to_profile(existing, is_new=False), False
        else:
            # Create new wallet user
            new_user = WalletUser(
                wallet_address=wallet_address,
                preferred_network=network,
            )
            db.add(new_user)
            await db.flush()
            logger.info(f"New wallet registered: {wallet_address[:10]}...")
            return self._to_profile(new_user, is_new=True), True

    async def get_profile(
        self, db: AsyncSession, wallet_address: str
    ) -> Optional[WalletProfile]:
        """Get a wallet's profile and computed stats."""
        wallet_address = wallet_address.lower()
        result = await db.execute(
            select(WalletUser).where(WalletUser.wallet_address == wallet_address)
        )
        user = result.scalar_one_or_none()
        if not user:
            return None

        # Refresh counts from actual transaction records
        req_result = await db.execute(
            select(TransactionRequest).where(
                TransactionRequest.wallet_address == wallet_address
            )
        )
        requests = req_result.scalars().all()
        user.total_requests = len(requests)
        user.total_completed = sum(
            1 for r in requests if r.status == TransactionStatus.COMPLETED
        )
        await db.flush()
        return self._to_profile(user, is_new=False)

    async def get_balances(self, wallet_address: str) -> WalletBalances:
        """
        Fetch native ETH balance and known ERC-20 balances for the wallet.
        Uses Web3 RPC — returns zeros gracefully if RPC unavailable.
        """
        wallet_address = wallet_address.lower()
        balances = []
        block_number = None

        try:
            w3 = blockchain_service._get_web3()

            if blockchain_service.is_connected:
                block_number = w3.eth.block_number

                # Native ETH balance
                eth_wei = w3.eth.get_balance(wallet_address)
                eth_balance = float(w3.from_wei(eth_wei, "ether"))
                balances.append(TokenBalance(
                    symbol="ETH",
                    name="Ether (Sepolia Testnet)",
                    balance=f"{eth_balance:.6f}",
                    balance_raw=str(eth_wei),
                    decimals=18,
                    contract_address=None,
                ))

                # ERC-20 balances
                for token in KNOWN_SEPOLIA_TOKENS:
                    try:
                        contract = w3.eth.contract(
                            address=w3.to_checksum_address(token["address"]),
                            abi=ERC20_ABI,
                        )
                        raw = contract.functions.balanceOf(
                            w3.to_checksum_address(wallet_address)
                        ).call()
                        human = raw / (10 ** token["decimals"])
                        balances.append(TokenBalance(
                            symbol=token["symbol"],
                            name=token["name"],
                            balance=f"{human:.4f}",
                            balance_raw=str(raw),
                            decimals=token["decimals"],
                            contract_address=token["address"],
                        ))
                    except Exception as e:
                        logger.debug(f"ERC-20 balance fetch failed for {token['symbol']}: {e}")
                        balances.append(TokenBalance(
                            symbol=token["symbol"],
                            name=token["name"],
                            balance="0.0000",
                            balance_raw="0",
                            decimals=token["decimals"],
                            contract_address=token["address"],
                        ))
            else:
                # RPC unavailable — return placeholder balances
                balances = self._placeholder_balances()

        except Exception as e:
            logger.warning(f"Balance fetch error for {wallet_address[:10]}: {e}")
            balances = self._placeholder_balances()

        return WalletBalances(
            wallet_address=wallet_address,
            network=settings.network_name,
            block_number=block_number,
            balances=balances,
            fetched_at=utcnow().isoformat(),
        )

    async def get_transaction_detail(
        self, db: AsyncSession, request_id: str, wallet_address: str
    ) -> Optional[TransactionDetail]:
        """
        Get full transaction detail — ONLY if it belongs to the requesting wallet.
        Ownership check prevents one wallet seeing another's private request data.
        """
        import uuid as _uuid
        wallet_address = wallet_address.lower()

        try:
            uid = _uuid.UUID(request_id)
        except ValueError:
            return None

        result = await db.execute(
            select(TransactionRequest)
            .options(
                selectinload(TransactionRequest.intent),
                selectinload(TransactionRequest.validation_result),
                selectinload(TransactionRequest.executed_transaction),
            )
            .where(TransactionRequest.id == uid)
        )
        req = result.scalar_one_or_none()

        if not req:
            return None

        # Ownership check — wallet_address must match
        if req.wallet_address.lower() != wallet_address:
            logger.warning(
                f"Wallet {wallet_address[:10]} attempted to access "
                f"transaction owned by {req.wallet_address[:10]}"
            )
            return None

        intent = req.intent
        val = req.validation_result
        exec_tx = req.executed_transaction

        val_checks = None
        if val:
            val_checks = {
                "operation": val.operation_check,
                "token": val.token_check,
                "amount": val.amount_check,
                "recipient": val.recipient_check,
                "spending_limit": val.spending_limit_check,
                "completeness": val.completeness_check,
            }

        explorer_url = None
        if exec_tx and exec_tx.blockchain_tx_hash:
            explorer_url = blockchain_service.get_explorer_url(exec_tx.blockchain_tx_hash)

        return TransactionDetail(
            request_id=str(req.id),
            wallet_address=req.wallet_address,
            natural_language_input=req.natural_language_input,
            status=req.status.value,
            created_at=req.created_at,
            operation=intent.operation if intent else None,
            token_in=intent.token_in if intent else None,
            token_out=intent.token_out if intent else None,
            amount=intent.amount if intent else None,
            recipient=intent.recipient if intent else None,
            confidence=intent.confidence if intent else None,
            validation_status=val.status.value if val else None,
            validation_summary=val.human_readable_summary if val else None,
            validation_checks=val_checks,
            blockchain_tx_hash=exec_tx.blockchain_tx_hash if exec_tx else None,
            block_number=exec_tx.block_number if exec_tx else None,
            gas_used=exec_tx.gas_used if exec_tx else None,
            from_address=exec_tx.from_address if exec_tx else None,
            to_address=exec_tx.to_address if exec_tx else None,
            executed_at=exec_tx.executed_at if exec_tx else None,
            confirmed_at=exec_tx.confirmed_at if exec_tx else None,
            explorer_url=explorer_url,
            integrity_hash=exec_tx.integrity_hash if exec_tx else None,
            integrity_anchor_tx=exec_tx.integrity_anchor_tx if exec_tx else None,
            integrity_verified_at=exec_tx.integrity_verified_at if exec_tx else None,
        )

    async def confirm_transaction(
        self, db: AsyncSession, request_id: str, tx_hash: str, wallet_address: str
    ) -> dict:
        """
        Poll the blockchain for transaction confirmation and update the DB record.
        Called by the frontend after submitting the tx to MetaMask.
        """
        import uuid as _uuid
        wallet_address = wallet_address.lower()

        result = await db.execute(
            select(TransactionRequest)
            .options(selectinload(TransactionRequest.executed_transaction))
            .where(
                TransactionRequest.id == _uuid.UUID(request_id)
            )
        )
        req = result.scalar_one_or_none()

        if not req or req.wallet_address.lower() != wallet_address:
            return {"status": "not_found"}

        # Query blockchain for confirmation
        chain_status = blockchain_service.get_transaction_status(tx_hash)

        if req.executed_transaction and chain_status.get("status") == "confirmed":
            exec_tx = req.executed_transaction
            exec_tx.status = "confirmed"
            exec_tx.block_number = chain_status.get("block_number")
            exec_tx.gas_used = str(chain_status.get("gas_used", ""))
            exec_tx.confirmed_at = utcnow()
            req.status = TransactionStatus.COMPLETED

            # Update wallet stats
            user_result = await db.execute(
                select(WalletUser).where(WalletUser.wallet_address == wallet_address)
            )
            user = user_result.scalar_one_or_none()
            if user:
                user.total_completed += 1

            await db.flush()

        return {
            "request_id": request_id,
            "tx_hash": tx_hash,
            "blockchain_status": chain_status.get("status", "pending"),
            "block_number": chain_status.get("block_number"),
            "gas_used": chain_status.get("gas_used"),
        }

    def _to_profile(self, user: WalletUser, is_new: bool) -> WalletProfile:
        return WalletProfile(
            wallet_address=user.wallet_address,
            display_name=user.display_name,
            preferred_network=user.preferred_network,
            first_seen_at=user.first_seen_at,
            last_seen_at=user.last_seen_at,
            total_requests=user.total_requests,
            total_completed=user.total_completed,
            is_new_user=is_new,
        )

    def _placeholder_balances(self):
        """Return placeholder balances when RPC is unavailable."""
        return [
            TokenBalance(symbol="ETH", name="Ether (Sepolia)", balance="—", balance_raw="0", decimals=18),
            TokenBalance(symbol="USDC", name="USD Coin", balance="—", balance_raw="0", decimals=6, contract_address=""),
            TokenBalance(symbol="DAI", name="Dai Stablecoin", balance="—", balance_raw="0", decimals=18, contract_address=""),
        ]


wallet_service = WalletService()
