"""
Unit tests for the contract assurance service (LeVer-based, design-time).
FR-07, FR-08, NFR-01. The service is informational and must never act as a gate.
"""

import hashlib
import json

import pytest

from app.schemas.intent import DeFiIntent, SupportedOperation
from app.services.assurance_service import AssuranceService, assurance_service
from app.services.preview_service import PreviewService
from app.services.validation_service import ValidationService


def _write(tmp_path, source_text="contract X {}", lever_status="not_run", findings=None, hash_override=None):
    src = tmp_path / "DeFiAgent.sol"
    src.write_text(source_text)
    report = {
        "contract": "DeFiAgent",
        "source_path": "contracts/contracts/DeFiAgent.sol",
        "source_sha256": hash_override or hashlib.sha256(source_text.encode()).hexdigest(),
        "lever_cross_check": {"status": lever_status, "scope_note": "n"},
        "manual_review": {
            "date": "2026-10-20",
            "method": "manual",
            "findings": findings or [],
            "satisfied": [{"lever_property": "L1.1", "note": "ok"}],
        },
    }
    rp = tmp_path / "report.json"
    rp.write_text(json.dumps(report))
    return AssuranceService(report_path=str(rp), source_path=str(src))


FINDING = {"id": "MR-1", "lever_property": "L3.1-Withdrawal", "severity": "medium", "status": "open",
           "title": "t", "detail": "d", "recommendation": "r"}


class TestStatus:
    def test_not_run(self, tmp_path):
        r = _write(tmp_path).get_report()
        assert r.status == "not_run" and r.source_matches_report is True

    @pytest.mark.parametrize("lever,expected", [
        ("passed", "cross_check_passed"), ("failed", "cross_check_failed"), ("error", "cross_check_error")])
    def test_lever_results(self, tmp_path, lever, expected):
        assert _write(tmp_path, lever_status=lever).get_report().status == expected

    def test_stale_when_source_changed(self, tmp_path):
        svc = _write(tmp_path, lever_status="passed", hash_override="0" * 64)
        r = svc.get_report()
        assert r.status == "stale" and r.source_matches_report is False

    def test_unavailable_when_report_missing(self, tmp_path):
        r = AssuranceService(report_path=str(tmp_path / "nope.json"), source_path=str(tmp_path / "x")).get_report()
        assert r.status == "unavailable"

    def test_unavailable_when_report_corrupt(self, tmp_path):
        bad = tmp_path / "bad.json"
        bad.write_text("{not json")
        assert AssuranceService(report_path=str(bad)).get_report().status == "unavailable"


class TestFindings:
    def test_open_findings_counted(self, tmp_path):
        r = _write(tmp_path, findings=[FINDING, {**FINDING, "id": "MR-3", "severity": "low"}]).get_report()
        assert r.open_findings == 2 and r.open_medium_findings == 1
        assert "not a security guarantee" in r.note

    def test_resolved_not_counted(self, tmp_path):
        r = _write(tmp_path, findings=[{**FINDING, "status": "resolved"}]).get_report()
        assert r.open_findings == 0

    def test_summary_has_no_full_findings(self, tmp_path):
        assert not hasattr(_write(tmp_path).get_summary(), "findings")


class TestShippedReport:
    """The committed report must describe the committed contract (guards against stale reports)."""

    def test_report_matches_contract_source(self):
        r = assurance_service.get_report()
        assert r.status != "unavailable"
        assert r.source_matches_report is True, (
            "contracts/DeFiAgent.sol changed: re-run contract_assurance/run_assurance.py "
            "and refresh reports/DeFiAgent.assurance.json")

    def test_medium_findings_are_resolved_and_documented(self):
        r = assurance_service.get_report()
        assert r.open_medium_findings == 0
        resolved = [f for f in r.findings if f.status == "resolved"]
        assert {f.id for f in resolved} >= {"MR-1", "MR-2"}
        assert all(f.resolution for f in resolved)

    def test_findings_reference_lever_properties(self):
        assert all(f.lever_property for f in assurance_service.get_report().findings)


class TestPreviewAndSecurityBoundary:
    @staticmethod
    def _intent():
        return DeFiIntent(operation=SupportedOperation.TRANSFER, token_in="ETH", amount=0.1, amount_raw="0.1 ETH",
                          recipient="0xAbCdEf1234567890AbCdEf1234567890AbCdEf12", chain="Sepolia",
                          confidence=0.95, requires_confirmation=True, missing_fields=[])

    def test_preview_includes_assurance_and_keeps_final_line(self):
        intent = self._intent()
        validation = ValidationService().validate(intent)
        validation.request_id = "r1"
        p = PreviewService().generate_preview("r1", "p1", intent, validation)
        assert p.contract_assurance is not None
        assert any("Smart contract assurance" in w for w in p.warnings)
        assert "preview only" in p.warnings[-1]

    def test_validation_outcome_independent_of_assurance(self):
        intent = self._intent()
        a = ValidationService().validate(intent)
        assert a.overall_status == "passed"
        assert {c.check_name for c in a.checks} == {
            "Supported Operation", "Token Validation", "Amount Validation",
            "Recipient Address", "Spending Limit", "Intent Completeness"}
