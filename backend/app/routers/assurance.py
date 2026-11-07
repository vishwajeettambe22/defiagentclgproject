"""
Assurance Router — read-only view of the LeVer-based contract assurance report.
Supports FR-07 / FR-08 and NFR-01. Nothing here executes or authorizes a transaction.
"""

from fastapi import APIRouter

from app.schemas.assurance import ContractAssuranceReport
from app.services.assurance_service import assurance_service

router = APIRouter(prefix="/api/v1/assurance", tags=["Contract Assurance"])


@router.get(
    "/contract",
    response_model=ContractAssuranceReport,
    summary="Contract assurance report (LeVer cross-check + reviewed findings)",
)
async def get_contract_assurance():
    return assurance_service.get_report()
