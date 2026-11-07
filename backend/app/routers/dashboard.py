"""
Dashboard Router — transaction history and overview.
FR-08: Transaction history.
Dashboard Module: documented module 8.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.transaction import DashboardResponse
from app.services.transaction_service import transaction_service
from app.utils.address import is_valid_eth_address

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get(
    "/{wallet_address}",
    response_model=DashboardResponse,
    summary="Get transaction history and dashboard overview",
)
async def get_dashboard(
    wallet_address: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    if not is_valid_eth_address(wallet_address):
        raise HTTPException(status_code=400, detail="Invalid Ethereum address.")
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 100.")

    return await transaction_service.get_dashboard(db, wallet_address, limit)
