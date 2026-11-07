"""
Schemas for the contract assurance report (LeVer-based design-time check).

NFR-01: explainable, evidence-linked outcomes — the preview shows what is known
about the smart contract the user is about to authorize, and what is not.
"""

from typing import List, Optional
from pydantic import BaseModel


class AssuranceFinding(BaseModel):
    id: str
    lever_property: str
    severity: str  # medium | low | info
    status: str    # open | resolved
    title: str
    detail: str
    recommendation: str
    resolution: Optional[str] = None


class ContractAssuranceSummary(BaseModel):
    """Short summary embedded in the transaction preview."""
    contract: str
    status: str  # not_run | cross_check_passed | cross_check_failed | cross_check_error | stale | unavailable
    label: str
    source_matches_report: Optional[bool] = None
    open_findings: int = 0
    open_medium_findings: int = 0
    note: str


class ContractAssuranceReport(ContractAssuranceSummary):
    """Full report returned by GET /api/v1/assurance/contract."""
    source_path: Optional[str] = None
    lever_cross_check: Optional[dict] = None
    manual_review_method: Optional[str] = None
    manual_review_date: Optional[str] = None
    findings: List[AssuranceFinding] = []
    satisfied: List[dict] = []
