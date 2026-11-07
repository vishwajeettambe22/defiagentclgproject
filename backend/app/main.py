"""
AI-Driven Conversational DeFi Transaction Agent
Backend — FastAPI Application Entry Point

Architecture modules implemented here:
1. User/Web Interface  → CORS, frontend served separately
2. AI/NLP Module       → /api/v1/transaction/parse
3. Validation Module   → /api/v1/transaction/validate/:id
4. Preview Module      → /api/v1/transaction/preview/:id
5. Wallet & Auth       → handled in frontend (MetaMask), result recorded at /execute
6. Smart Contract      → blockchain_service + smart contracts (contracts/)
7. Record & Integrity  → /api/v1/transaction/verify-integrity
8. Dashboard           → /api/v1/dashboard/:wallet_address
   (design-time) Contract assurance report (LeVer) → /api/v1/assurance/contract
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import create_tables
from app.routers.transaction import router as transaction_router
from app.routers.dashboard import router as dashboard_router
from app.routers.wallet import router as wallet_router
from app.routers.assurance import router as assurance_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.is_development else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Application lifecycle ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("Starting DeFi Transaction Agent backend...")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Network: {settings.network_name} (chain_id={settings.chain_id})")
    logger.info(f"Allowed operations: {settings.allowed_operations}")
    logger.info(f"Spending limit: {settings.max_tx_amount_eth} ETH")

    # Create DB tables (dev only — use Alembic in production)
    if settings.is_development:
        try:
            await create_tables()
            logger.info("Database tables created/verified.")
        except Exception as e:
            logger.warning(f"Could not create DB tables (DB may not be running): {e}")

    yield

    logger.info("Shutting down DeFi Transaction Agent backend.")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI-Driven Conversational DeFi Transaction Agent",
    description=(
        "BE Final Year Project — AI-powered conversational interface for selected DeFi operations. "
        "Natural language → structured intent → deterministic validation → user preview → "
        "wallet authorization → blockchain execution → integrity audit."
    ),
    version="1.0.0-academic",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(transaction_router)
app.include_router(dashboard_router)
app.include_router(wallet_router)
app.include_router(assurance_router)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    """System health endpoint — verifies API is running."""
    from app.services.blockchain_service import blockchain_service
    return {
        "status": "ok",
        "service": "AI-Driven DeFi Transaction Agent",
        "version": "1.0.0-academic",
        "environment": settings.app_env,
        "network": settings.network_name,
        "chain_id": settings.chain_id,
        "blockchain_connected": blockchain_service.is_connected,
        "security_note": (
            "AI is an interpretation layer only. "
            "All transactions require deterministic validation and explicit wallet authorization."
        ),
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "AI-Driven Conversational DeFi Transaction Agent API",
        "docs": "/docs",
        "health": "/health",
    }
