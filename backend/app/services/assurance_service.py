"""
Contract Assurance Service — read-only reporter for the LeVer-based assurance stage.

Supports FR-07 / FR-08 and NFR-01. It does NOT decide whether a transaction may run:
deterministic validation (validation_service) and wallet authorization remain the only
gates. This service only reports what design-time assurance exists for the smart
contract, so the preview can state it honestly.

Statuses:
  not_run             LeVer has not been run yet
  cross_check_passed  LeVer's configured criteria passed on a reference candidate
                      (NOT a proof about the deployed contract)
  cross_check_failed  LeVer criteria were not met
  cross_check_error   LeVer run ended with a pipeline/LLM error
  stale               contracts/DeFiAgent.sol changed after the report was written
  unavailable         report file missing or unreadable
"""

import hashlib
import json
import logging
from pathlib import Path
from typing import Optional

from app.config import settings
from app.schemas.assurance import (
    AssuranceFinding,
    ContractAssuranceReport,
    ContractAssuranceSummary,
)

logger = logging.getLogger(__name__)

_LABELS = {
    "not_run": "LeVer cross-check not run yet",
    "cross_check_passed": "LeVer cross-check passed (reference candidate)",
    "cross_check_failed": "LeVer cross-check failed",
    "cross_check_error": "LeVer cross-check ended with an error",
    "stale": "Assurance report is out of date",
    "unavailable": "Assurance report unavailable",
}


class AssuranceService:
    def __init__(self, report_path: Optional[str] = None, source_path: Optional[str] = None):
        self._report_path = report_path
        self._source_path = source_path

    # Paths are resolved lazily so tests and deployments can override settings.
    @property
    def report_path(self) -> Path:
        return Path(self._report_path or settings.assurance_report_path)

    @property
    def source_path(self) -> Path:
        return Path(self._source_path or settings.assurance_source_path)

    @staticmethod
    def _sha256(path: Path) -> Optional[str]:
        try:
            return hashlib.sha256(path.read_bytes()).hexdigest()
        except OSError:
            return None

    def _load(self) -> Optional[dict]:
        try:
            return json.loads(self.report_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            logger.warning(f"Assurance report not readable: {e}")
            return None

    def get_report(self) -> ContractAssuranceReport:
        data = self._load()
        if data is None:
            return ContractAssuranceReport(
                contract="DeFiAgent",
                status="unavailable",
                label=_LABELS["unavailable"],
                note="No assurance report could be read. This does not affect validation or wallet authorization.",
            )

        findings = [AssuranceFinding(**f) for f in data.get("manual_review", {}).get("findings", [])]
        open_f = [f for f in findings if f.status == "open"]
        open_medium = [f for f in open_f if f.severity in ("medium", "high")]

        current_hash = self._sha256(self.source_path)
        matches = None if current_hash is None else current_hash == data.get("source_sha256")

        lever = data.get("lever_cross_check", {}) or {}
        status = {
            "passed": "cross_check_passed",
            "failed": "cross_check_failed",
            "error": "cross_check_error",
        }.get(lever.get("status"), "not_run")
        if matches is False:
            status = "stale"

        note = (
            "Design-time assurance only. It is not a security guarantee; every transaction still "
            "needs deterministic validation and your explicit wallet approval."
        )
        if open_f:
            note += f" {len(open_f)} reviewed finding(s) are still open ({len(open_medium)} medium)."

        return ContractAssuranceReport(
            contract=data.get("contract", "DeFiAgent"),
            status=status,
            label=_LABELS[status],
            source_matches_report=matches,
            open_findings=len(open_f),
            open_medium_findings=len(open_medium),
            note=note,
            source_path=data.get("source_path"),
            lever_cross_check=lever,
            manual_review_method=data.get("manual_review", {}).get("method"),
            manual_review_date=data.get("manual_review", {}).get("date"),
            findings=findings,
            satisfied=data.get("manual_review", {}).get("satisfied", []),
        )

    def get_summary(self) -> ContractAssuranceSummary:
        r = self.get_report()
        return ContractAssuranceSummary(**r.model_dump(include=set(ContractAssuranceSummary.model_fields)))


assurance_service = AssuranceService()
