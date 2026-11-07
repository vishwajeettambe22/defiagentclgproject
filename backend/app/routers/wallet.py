"""
Wallet Router — wallet identity, profile, balances, transaction detail.

POST /api/v1/wallet/register       — create/load wallet profile on connect
GET  /api/v1/wallet/{addr}/profile — wallet profile + stats
GET  /api/v1/wallet/{addr}/balances — ETH + ERC-20 balances
GET  /api/v1/wallet/{addr}/transaction/{req_id} — full tx detail (ownership-gated)
POST /api/v1/wallet/confirm-tx     — poll blockchain and update tx status
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.wallet import (
    WalletRegisterRequest, WalletProfile, WalletBalances,
    TransactionDetail, ConfirmTxRequest,
)
from app.services.wallet_service import wallet_service
from app.utils.address import is_valid_eth_address

router = APIRouter(prefix="/api/v1/wallet", tags=["Wallet"])


@router.post("/register", response_model=WalletProfile,
             summary="Register or load wallet profile on connect")
async def register_wallet(body: WalletRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Called when a user connects their MetaMask wallet.
    Creates a new wallet profile if first visit; loads existing profile otherwise.
    No passwords — wallet address is the identity.
    """
    profile, is_new = await wallet_service.register_or_load(db, body.wallet_address, body.network)
    profile.is_new_user = is_new
    return profile


@router.get("/{wallet_address}/profile", response_model=WalletProfile,
            summary="Get wallet profile and activity stats")
async def get_profile(wallet_address: str, db: AsyncSession = Depends(get_db)):
    if not is_valid_eth_address(wallet_address):
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")
    profile = await wallet_service.get_profile(db, wallet_address)
    if not profile:
        raise HTTPException(status_code=404, detail="Wallet not registered. Connect first.")
    return profile


@router.get("/{wallet_address}/balances", response_model=WalletBalances,
            summary="Get ETH and supported ERC-20 balances")
async def get_balances(wallet_address: str):
    if not is_valid_eth_address(wallet_address):
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")
    return await wallet_service.get_balances(wallet_address)


@router.get("/{wallet_address}/transaction/{request_id}",
            response_model=TransactionDetail,
            summary="Get full transaction detail (ownership-gated)")
async def get_transaction_detail(
    wallet_address: str, request_id: str, db: AsyncSession = Depends(get_db)
):
    if not is_valid_eth_address(wallet_address):
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")
    detail = await wallet_service.get_transaction_detail(db, request_id, wallet_address)
    if not detail:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found or does not belong to this wallet."
        )
    return detail


@router.post("/confirm-tx", summary="Poll blockchain and update transaction confirmation status")
async def confirm_transaction(body: ConfirmTxRequest, wallet_address: str,
                               db: AsyncSession = Depends(get_db)):
    if not is_valid_eth_address(wallet_address):
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")
    return await wallet_service.confirm_transaction(
        db, body.request_id, body.tx_hash, wallet_address
    )
