"""
Unit and integration tests for SQLAlchemy 2.0 eager loading and relationship handling.

Tests:
1. Transaction request retrieval with selectinload options
2. Intent relationship loading without lazy-loading / MissingGreenlet
3. Transaction validation endpoint (HTTP 200 on success, HTTP 400 when missing)
4. Dashboard endpoint with eager loading of intent and executed_transaction
5. Dashboard with no transaction history (zero-state handling)
6. Dashboard with parsed but unexecuted transactions
7. Dashboard with executed transactions
8. Missing relationship handling (graceful defaults for None intent / executed_tx)
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException
from sqlalchemy.orm.strategy_options import Load

from app.models.transaction import (
    TransactionRequest, StructuredIntent, ValidationResult,
    ExecutedTransaction, TransactionStatus,
)
from app.routers.dashboard import get_dashboard as dashboard_endpoint
from app.routers.transaction import validate_intent as validate_endpoint
from app.schemas.transaction import DashboardResponse, ValidationResponse
from app.services.transaction_service import transaction_service


def utcnow():
    return datetime.now(timezone.utc)


def test_transaction_request_retrieval_query_options():
    """1. Test that get_request attaches selectinload for all 4 relationships."""
    async def run():
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        req_id = str(uuid.uuid4())
        await transaction_service.get_request(mock_db, req_id)

        assert mock_db.execute.called
        stmt = mock_db.execute.call_args[0][0]
        
        # Verify that the query contains loader options (selectinload)
        options = stmt._with_options
        assert len(options) == 4, f"Expected 4 selectinload options, found {len(options)}"
        for opt in options:
            assert isinstance(opt, Load)

        # Test invalid UUID returns None without calling db.execute
        mock_db.reset_mock()
        invalid_result = await transaction_service.get_request(mock_db, "not-a-valid-uuid")
        assert invalid_result is None
        assert not mock_db.execute.called

    asyncio.run(run())


def test_intent_relationship_loading():
    """2. Test that retrieved TransactionRequest has intent accessible without lazy load."""
    async def run():
        mock_db = AsyncMock()
        req_id = uuid.uuid4()
        
        mock_request = TransactionRequest(
            id=req_id,
            wallet_address="0x1234567890123456789012345678901234567890",
            natural_language_input="Swap 10 USDC for ETH",
            status=TransactionStatus.INTENT_PARSED,
        )
        mock_intent = StructuredIntent(
            id=uuid.uuid4(),
            request_id=req_id,
            operation="swap",
            token_in="USDC",
            token_out="ETH",
            amount=10.0,
            chain="Sepolia",
            confidence=0.95,
            requires_confirmation=True,
        )
        mock_request.intent = mock_intent
        mock_intent.request = mock_request

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_request
        mock_db.execute.return_value = mock_result

        retrieved = await transaction_service.get_request(mock_db, str(req_id))
        assert retrieved is not None
        assert retrieved.intent is not None
        assert retrieved.intent.operation == "swap"
        assert retrieved.intent.token_in == "USDC"
        assert retrieved.intent.amount == 10.0

    asyncio.run(run())


def test_transaction_validation_endpoint_success():
    """3. Test validate endpoint loads intent and succeeds without MissingGreenlet error."""
    async def run():
        mock_db = AsyncMock()
        req_id = uuid.uuid4()

        mock_request = TransactionRequest(
            id=req_id,
            wallet_address="0x1234567890123456789012345678901234567890",
            natural_language_input="Transfer 0.05 ETH to 0x2222222222222222222222222222222222222222",
            status=TransactionStatus.INTENT_PARSED,
        )
        mock_intent = StructuredIntent(
            id=uuid.uuid4(),
            request_id=req_id,
            operation="transfer",
            token_in="ETH",
            token_out=None,
            amount=0.05,
            recipient="0x2222222222222222222222222222222222222222",
            chain="Sepolia",
            confidence=0.98,
            requires_confirmation=True,
        )
        mock_request.intent = mock_intent

        with patch.object(transaction_service, "get_request", AsyncMock(return_value=mock_request)):
            with patch.object(transaction_service, "save_validation", AsyncMock(side_effect=transaction_service.save_validation)) as mock_save:
                response: ValidationResponse = await validate_endpoint(
                    request_id=str(req_id), db=mock_db
                )

        assert response.overall_status == "passed"
        assert response.can_proceed_to_preview is True
        assert mock_save.called
        assert mock_request.validation_result is not None

    asyncio.run(run())


def test_transaction_validation_endpoint_missing_intent():
    """4. Test validate endpoint handles missing intent gracefully with HTTP 400."""
    async def run():
        mock_db = AsyncMock()
        req_id = uuid.uuid4()

        mock_request = TransactionRequest(
            id=req_id,
            wallet_address="0x1234567890123456789012345678901234567890",
            natural_language_input="Some input",
            status=TransactionStatus.INTENT_RECEIVED,
        )
        mock_request.intent = None

        with patch.object(transaction_service, "get_request", AsyncMock(return_value=mock_request)):
            with pytest.raises(HTTPException) as exc_info:
                await validate_endpoint(request_id=str(req_id), db=mock_db)

        assert exc_info.value.status_code == 400
        assert "Intent not yet parsed" in exc_info.value.detail

    asyncio.run(run())


def test_dashboard_endpoint_no_history():
    """5. Test dashboard endpoint when wallet has no transaction history."""
    async def run():
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        wallet = "0x1234567890123456789012345678901234567890"
        dashboard: DashboardResponse = await dashboard_endpoint(wallet_address=wallet, limit=20, db=mock_db)

        assert dashboard.wallet_address == wallet
        assert dashboard.total_transactions == 0
        assert dashboard.completed_transactions == 0
        assert dashboard.failed_transactions == 0
        assert dashboard.recent_transactions == []

    asyncio.run(run())


def test_dashboard_endpoint_parsed_unexecuted():
    """6. Test dashboard with parsed but unexecuted transactions."""
    async def run():
        mock_db = AsyncMock()
        req_id = uuid.uuid4()
        wallet = "0x1234567890123456789012345678901234567890"

        mock_request = TransactionRequest(
            id=req_id,
            wallet_address=wallet.lower(),
            natural_language_input="Swap 10 USDC for ETH",
            status=TransactionStatus.VALIDATION_PASSED,
            created_at=utcnow(),
        )
        mock_intent = StructuredIntent(
            id=uuid.uuid4(),
            request_id=req_id,
            operation="swap",
            token_in="USDC",
            token_out="ETH",
            amount=10.0,
            chain="Sepolia",
        )
        mock_request.intent = mock_intent
        mock_request.executed_transaction = None

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_request]
        mock_db.execute.return_value = mock_result

        dashboard = await transaction_service.get_dashboard(mock_db, wallet, limit=20)

        assert dashboard.total_transactions == 1
        assert dashboard.completed_transactions == 0
        assert dashboard.failed_transactions == 0
        assert len(dashboard.recent_transactions) == 1

        summary = dashboard.recent_transactions[0]
        assert summary.request_id == str(req_id)
        assert summary.operation == "swap"
        assert summary.token == "USDC"
        assert summary.amount == "10.0"
        assert summary.blockchain_tx_hash is None
        assert summary.status == "validation_passed"

    asyncio.run(run())


def test_dashboard_endpoint_executed_transactions():
    """7. Test dashboard with executed transactions."""
    async def run():
        mock_db = AsyncMock()
        req_id = uuid.uuid4()
        wallet = "0x1234567890123456789012345678901234567890"
        tx_hash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

        mock_request = TransactionRequest(
            id=req_id,
            wallet_address=wallet.lower(),
            natural_language_input="Transfer 0.1 ETH",
            status=TransactionStatus.COMPLETED,
            created_at=utcnow(),
        )
        mock_intent = StructuredIntent(
            id=uuid.uuid4(),
            request_id=req_id,
            operation="transfer",
            token_in="ETH",
            amount=0.1,
            recipient="0x9999999999999999999999999999999999999999",
        )
        mock_exec = ExecutedTransaction(
            id=uuid.uuid4(),
            request_id=req_id,
            blockchain_tx_hash=tx_hash,
            status="confirmed",
            from_address=wallet,
            operation="transfer",
            token="ETH",
            amount_display="0.1 ETH",
            integrity_hash="0x1111222233334444",
            executed_at=utcnow(),
        )
        mock_request.intent = mock_intent
        mock_request.executed_transaction = mock_exec

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_request]
        mock_db.execute.return_value = mock_result

        dashboard = await transaction_service.get_dashboard(mock_db, wallet, limit=20)

        assert dashboard.total_transactions == 1
        assert dashboard.completed_transactions == 1
        assert dashboard.failed_transactions == 0
        assert len(dashboard.recent_transactions) == 1

        summary = dashboard.recent_transactions[0]
        assert summary.request_id == str(req_id)
        assert summary.operation == "transfer"
        assert summary.token == "ETH"
        assert summary.amount == "0.1"
        assert summary.blockchain_tx_hash == tx_hash
        assert summary.integrity_hash == "0x1111222233334444"
        assert summary.status == "completed"

    asyncio.run(run())


def test_missing_relationship_handling():
    """8. Test graceful handling when relationships are None."""
    async def run():
        mock_db = AsyncMock()
        req_id = uuid.uuid4()
        wallet = "0x1234567890123456789012345678901234567890"

        mock_request = TransactionRequest(
            id=req_id,
            wallet_address=wallet.lower(),
            natural_language_input="Unparsed command",
            status=TransactionStatus.INTENT_RECEIVED,
            created_at=utcnow(),
        )
        mock_request.intent = None
        mock_request.executed_transaction = None

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_request]
        mock_db.execute.return_value = mock_result

        # Should not raise AttributeError, MissingGreenlet, or TypeError
        dashboard = await transaction_service.get_dashboard(mock_db, wallet, limit=20)

        assert dashboard.total_transactions == 1
        assert len(dashboard.recent_transactions) == 1
        summary = dashboard.recent_transactions[0]
        assert summary.operation == "unknown"
        assert summary.token is None
        assert summary.amount is None
        assert summary.recipient is None
        assert summary.blockchain_tx_hash is None
        assert summary.integrity_hash is None

    asyncio.run(run())


if __name__ == "__main__":
    print("Running test 1...", flush=True)
    test_transaction_request_retrieval_query_options()
    print("Test 1 passed!", flush=True)
    print("Running test 2...", flush=True)
    test_intent_relationship_loading()
    print("Test 2 passed!", flush=True)
    print("Running test 3...", flush=True)
    test_transaction_validation_endpoint_success()
    print("Test 3 passed!", flush=True)
    print("Running test 4...", flush=True)
    test_transaction_validation_endpoint_missing_intent()
    print("Test 4 passed!", flush=True)
    print("Running test 5...", flush=True)
    test_dashboard_endpoint_no_history()
    print("Test 5 passed!", flush=True)
    print("Running test 6...", flush=True)
    test_dashboard_endpoint_parsed_unexecuted()
    print("Test 6 passed!", flush=True)
    print("Running test 7...", flush=True)
    test_dashboard_endpoint_executed_transactions()
    print("Test 7 passed!", flush=True)
    print("Running test 8...", flush=True)
    test_missing_relationship_handling()
    print("Test 8 passed!", flush=True)
    print("ALL 8 RELATIONSHIP & EAGER LOADING TESTS PASSED!", flush=True)

