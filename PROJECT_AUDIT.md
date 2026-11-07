# Project Audit: AI-Driven Conversational DeFi Agent

**Date:** November 2026  
**Auditor:** Senior Web3 Product Engineer & Backend Architect  
**Repository:** `defi-agent`  
**Target Environment:** Ethereum Sepolia Testnet (Chain ID: `11155111`)

---

## 1. Executive Summary

The project is an AI-driven conversational DeFi transaction agent designed to parse natural-language instructions into structured intents, enforce deterministic security validation, display pre-execution previews to the user, and execute transactions non-custodially via MetaMask on Ethereum Sepolia.

While the core conceptual architecture (8 documented modules) is well-conceived, our audit identified critical architectural, UI/UX, database, and feature gaps that prevent the application from functioning at a production-grade Web3 standard. This document details the architectural state, operational strengths, broken/incomplete functionality, and structural vulnerabilities.

---

## 2. Architecture Map & Component Inventory

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER (React 18 + Vite)                │
│  - useWallet (MetaMask, Ethers v6, Sepolia RPC Provider fallback)            │
│  - useTransaction (Multi-stage workflow state machine)                       │
│  - Modules: Dashboard, AI Command, History, Integrity, Portfolio             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / JSON
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            API LAYER (FastAPI)                              │
│  - /api/v1/transaction (parse, validate, preview, execute, status, verify)   │
│  - /api/v1/wallet (register, profile, balances, transaction detail, confirm) │
│  - /api/v1/dashboard/{wallet_address}                                       │
│  - /api/v1/assurance/contract (LeVer design-time audit integration)         │
└──────────────────┬───────────────────┬───────────────────┬──────────────────┘
                   │                   │                   │
┌──────────────────▼───┐ ┌─────────────▼─────┐ ┌───────────▼──────────────────┐
│   AI/NLP SERVICE     │ │ VALIDATION ENGINE │ │     BLOCKCHAIN SERVICE       │
│ - Google Gemini API  │ │ - Deterministic   │ │ - Web3.py RPC client         │
│ - Strict JSON Schema │ │ - Spending limits │ │ - Sepolia testnet monitoring │
│ - Zero custody/exec  │ │ - Token whitelist │ │ - Calldata & param builder   │
└──────────────────────┘ └───────────────────┘ └──────────────────────────────┘
                   │                   │                   │
┌──────────────────▼───────────────────▼───────────────────▼──────────────────┐
│                      PERSISTENCE & SECURITY LAYER                           │
│ - PostgreSQL + asyncpg + SQLAlchemy 2.0 (AsyncSession)                      │
│ - Tamper-evident SHA-256 transaction integrity hashing                      │
│ - On-chain anchor: DeFiAgent.sol (Sepolia)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Audit

### 3.1 Backend Architecture & Database (FastAPI & SQLAlchemy 2.0)
* **Status:** Functional core with previously resolved SQLAlchemy 2.0 relationship lazy-loading bottlenecks.
* **Findings:**
  1. **Asynchronous Relationship Loading:** In SQLAlchemy 2.0 with `AsyncSession`, accessing `db_request.intent` or `req.executed_transaction` without eager loading triggers `sqlalchemy.exc.MissingGreenlet`. We have implemented `selectinload()` in `transaction_service.get_request` and `transaction_service.get_dashboard`.
  2. **Schema Modernization:** Migrated Pydantic v1 `class Config: from_attributes = True` across `app.schemas.intent` and `app.schemas.transaction` to Pydantic v2 `model_config = ConfigDict(from_attributes=True)`.
  3. **Centralized Error Handling:** Gemini API authentication and rate-limiting exceptions are caught cleanly without exposing internal stack traces or API keys.
  4. **Database Resilience:** In development environments without active PostgreSQL containers, the backend falls back gracefully without crashing startup routines.

### 3.2 Frontend & UI/UX (React + Vite + TypeScript)
* **Status:** Functional functional prototype, but aesthetically primitive and architecturally limited.
* **Findings:**
  1. **Inline CSS Sprawl:** No centralized design system, CSS modules, or Tailwind tokens. Hardcoded hex colors (`#0d1117`, `#161b22`, `#21262d`) are duplicated across all `.tsx` files.
  2. **Restricted Navigation:** The app only had 4 tabs: Dashboard, AI Command, History, Integrity. Essential DeFi modules (Swap, Send/Receive, Market Overview, Analytics, Settings, Gas Tracker) were completely missing.
  3. **UI Polish Gap:** Lacks high-contrast visual hierarchy, refined micro-interactions, responsive drawer/modal systems, and standard Web3 feedback states (slippage warnings, price impact badges, copy feedback).
  4. **Portfolio Separation:** The portfolio was forced into a fixed right sidebar column rather than serving as both a quick widget and a full dedicated page.

### 3.3 Blockchain & Web3 Security (Ethers.js v6 & MetaMask)
* **Status:** Robust non-custodial foundation.
* **Findings:**
  1. **Chain Enforcement:** Enforces Ethereum Sepolia (`11155111` / `0xaa36a7`) with automatic `wallet_switchEthereumChain` and `wallet_addEthereumChain` fallback.
  2. **Non-Custodial Invariant:** Zero private key exposure. All fund movements require explicit user signatures in MetaMask.
  3. **Deterministic Token Resolution:** Token addresses for USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`), DAI (`0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6`), and WETH (`0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`) on Sepolia are properly validated with checksum verification.
  4. **Swap Simulation Limitation:** Decentralized swap functionality was previously routed to the academic `DeFiAgent` contract without an interactive Uniswap v2/v3 or 1inch testnet router preview.

### 3.4 AI / NLP Module (Google Gemini API)
* **Status:** Operational with structured schema enforcement.
* **Findings:**
  1. Model initialization handles missing/placeholder keys gracefully with descriptive HTTP 503 / 422 messages.
  2. System prompt mandates strict JSON output matching `DeFiIntent` schema.
  3. Conversational scope was limited strictly to intent parsing for transfer, swap, and stake; general DeFi questions or balance queries returned parsing errors rather than informational assistant responses.

---

## 4. Key Bottlenecks & Critical Remediation Items

| Issue ID | Severity | Area | Description | Remediation |
|---|---|---|---|---|
| **AUD-01** | High | Backend / ORM | `MissingGreenlet` error during lazy load of `intent` and `executed_transaction` | Apply explicit `selectinload` on all relationship queries. |
| **AUD-02** | High | Frontend / UX | Missing standalone DeFi product modules (Swap, Send, Analytics, Settings, Market) | Build dedicated modules with full state and validation. |
| **AUD-03** | Medium | Frontend / Design | Scattered inline styles with inconsistent tokens and lack of responsive design | Create unified design system (`design-system.css`, theme tokens, reusable UI primitives). |
| **AUD-04** | Medium | AI / Assistant | AI failed when user asked informational questions ("What is my balance?") | Extend assistant to support informational and portfolio queries alongside execution intents. |
| **AUD-05** | Low | Testing | Lack of frontend test coverage for new navigation and modules | Add component and hook integration tests. |

---

## 5. Audit Conclusion

The application has a strong security and backend foundation: deterministic validation is strictly separated from AI interpretation, and non-custodial execution ensures safety. Transforming it into a premium product requires implementing a cohesive design system, broadening the navigation to include real Web3 modules (Swap, Send/Receive, Portfolio, Analytics, Settings), and hardening the AI assistant to handle both transactional intents and conversational queries.

