# AI-Driven Conversational DeFi Transaction Agent
### with Blockchain-Anchored Transaction Integrity

**BE Final Year Project — JSPM's Bhivrabai Sawant Institute of Technology and Research, Pune**
**Academic Year 2026–2027 | Domain: AI, NLP, Blockchain, DeFi**

---

## Overview

This project provides a controlled AI-assisted interface for selected DeFi operations. Users describe a financial operation in natural language; the system interprets the request, validates it deterministically, presents a human-readable preview, and only executes the transaction after the user explicitly approves it in their own (non-custodial) MetaMask wallet.

The AI is an **interpretation layer only**. It never controls user funds.

---

## Problem Statement

Current DeFi platforms require users to understand contract addresses, transaction parameters, gas estimation, protocol-specific interfaces, and raw blockchain concepts. This creates a significant barrier for non-technical users.

This project addresses the gap between a user's high-level financial intent ("swap 50 USDC for ETH") and the technical blockchain transaction that must be validated, authorized, and executed.

---

## Workflow

```
User Natural Language Request
         ↓
  AI/NLP Intent Parsing         ← Gemini API (structured JSON output only)
         ↓
  Structured DeFi Intent        ← Pydantic-validated schema
         ↓
  Deterministic Validation      ← Rule-based, independent of AI
         ↓
  Transaction Preview           ← Shown to user before any signing
         ↓
  Explicit Wallet Authorization ← MetaMask popup (user must approve)
         ↓
  Smart Contract Execution      ← Sepolia testnet
         ↓
  Transaction Record            ← PostgreSQL (off-chain)
         ↓
  Integrity Hash Anchoring      ← SHA-256 hash, anchored on-chain
         ↓
  Dashboard / History           ← Searchable transaction audit trail
```

---

## Security Model

| Principle | Implementation |
|-----------|---------------|
| AI has no fund authority | LLM produces a structured intent only; it cannot call contracts |
| Deterministic validation | All validation rules are code, not AI decisions |
| User authorization | MetaMask signs every transaction; app never sees private keys |
| Spending limits | Enforced both in backend config and smart contract |
| Fail closed | Any validation failure = no transaction |
| No key storage | Private keys and seed phrases are never requested or stored |

---

## Requirements Coverage

| Requirement | Description | Module |
|-------------|-------------|--------|
| FR-01 | Natural-language DeFi request understanding | AI/NLP (ai_service.py) |
| FR-02 | Conversion to structured intent | AI/NLP + schemas/intent.py |
| FR-03 | Transaction validation | Validation (validation_service.py) |
| FR-04 | Rejection of invalid transactions | Validation (fail closed) |
| FR-05 | Pre-execution transaction preview | Preview (preview_service.py) |
| FR-06 | Wallet connection + explicit authorization | Frontend (useWallet.ts) |
| FR-07 | Smart contract execution | Contracts (DeFiAgent.sol); design-time LeVer assurance (contract_assurance/) |
| FR-08 | On-chain record + integrity audit | Integrity (integrity_service.py) |
| NFR-01 | Explainable validation outcomes | All 6 checks individually reported; preview also states contract-assurance status |
| NFR-02 | Preview separate from execution | Separate API endpoints |
| NFR-03 | Open-source/testnet deployable | Sepolia + open stack |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, ethers.js |
| Backend | Python 3.11, FastAPI, SQLAlchemy (async), Alembic |
| AI/NLP | Google Gemini API (structured JSON intent extraction) |
| Blockchain | Solidity 0.8.20, Hardhat, ethers.js |
| Network | Ethereum Sepolia testnet |
| Wallet | MetaMask (non-custodial, BrowserProvider) |
| Database | PostgreSQL 16 |
| Integrity | SHA-256 hash, on-chain anchoring via DeFiAgent.sol |
| Contract assurance (design-time) | LeVer (vendored; Python, Foundry, Lean 4, Slither, `gpt-5`) |

---

## Project Structure

```
defi-agent/
├── backend/                   # Python FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── config.py          # Environment-based configuration
│   │   ├── database.py        # Async SQLAlchemy setup
│   │   ├── models/            # Database models (FR-08)
│   │   ├── schemas/           # Pydantic schemas (strict intent contract)
│   │   ├── services/
│   │   │   ├── ai_service.py          # FR-01, FR-02
│   │   │   ├── validation_service.py  # FR-03, FR-04, NFR-01
│   │   │   ├── preview_service.py     # FR-05, NFR-02
│   │   │   ├── blockchain_service.py  # FR-07
│   │   │   ├── integrity_service.py   # FR-08
│   │   │   ├── assurance_service.py   # reads LeVer assurance report (read-only, never a gate)
│   │   │   └── transaction_service.py # FR-08 (orchestration)
│   │   └── routers/           # API endpoints
│   └── tests/                 # 75 unit tests (60 original + 15 assurance)
│
├── frontend/                  # React TypeScript frontend
│   └── src/
│       ├── components/        # Chat, Preview, Validation, Dashboard, Wallet
│       ├── hooks/             # useWallet, useTransaction
│       ├── services/api.ts    # Backend API calls
│       └── types/             # Shared TypeScript types
│
├── contracts/                 # Solidity smart contracts
│   ├── contracts/DeFiAgent.sol   # Transfer, stake/unstake, per-wallet integrity anchoring
│   ├── scripts/deploy.js         # Deployment script
│   └── test/DeFiAgent.test.js    # Contract tests
│
├── contract_assurance/        # LeVer integration (design-time only)
│   ├── lever/                 # LeVer, vendored unchanged (MIT, ACL 2026)
│   ├── requirements/          # natural-language specs of DeFiAgent for LeVer
│   ├── reports/               # DeFiAgent.assurance.json (read by the backend)
│   └── run_assurance.py       # runs LeVer and updates the report
│
├── docs/                      # LeVer integration note and report section
├── docker-compose.yml         # PostgreSQL for development
├── .env.example               # Environment variable template
└── README.md
```

---

## Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker (for PostgreSQL)
- MetaMask browser extension
- Google Gemini API key (for AI intent parsing)
- Alchemy/Infura account (for Sepolia RPC)
- Sepolia testnet ETH (from [Sepolia faucet](https://sepoliafaucet.com))

### 1. Clone and configure

```bash
git clone <your-repo>
cd defi-agent
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env       # or use the root .env
uvicorn app.main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs: http://localhost:8000/docs

### 4. Frontend setup

```bash
cd frontend
cp .env.example .env
# Edit VITE_DEFI_AGENT_CONTRACT after contract deployment
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

### 5. Smart contracts setup

```bash
cd contracts
npm install

# Compile
npx hardhat compile

# Run contract tests (local Hardhat network)
npx hardhat test

# Deploy to local Hardhat node
npx hardhat node                        # Terminal 1
npx hardhat run scripts/deploy.js --network hardhat   # Terminal 2

# Deploy to Sepolia (add DEPLOYER_PRIVATE_KEY to contracts/.env)
npx hardhat run scripts/deploy.js --network sepolia
```

After deployment, copy the contract address to `.env`:
```
DEFI_AGENT_CONTRACT=0x...
```

### 6. Connect MetaMask

1. Install MetaMask → Add Sepolia network
2. Import a testnet wallet (NEVER use a wallet with real funds)
3. Get Sepolia ETH from a faucet
4. Open http://localhost:5173 → Click "Connect MetaMask"

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key for intent parsing |
| `AI_MODEL` | Gemini model (default: gemini-2.5-flash) |
| `DATABASE_URL` | PostgreSQL connection string |
| `RPC_URL` | Alchemy/Infura Sepolia RPC URL |
| `CHAIN_ID` | 11155111 (Sepolia) |
| `DEFI_AGENT_CONTRACT` | Deployed contract address |
| `MAX_TX_AMOUNT_ETH` | Spending limit per transaction (default: 1.0) |
| `ALLOWED_OPERATIONS` | Comma-separated: transfer,swap,stake |
| `ALLOWED_TOKENS` | Comma-separated: ETH,USDC,DAI,WETH |

---

## Example Natural Language Commands

```
Transfer 0.05 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
Swap 50 USDC for ETH
Stake 0.1 ETH
Send 100 DAI to 0x1234...
```

---

## Running Tests

### Backend unit tests (75 tests)
```bash
cd backend
pytest tests/ -v
```

### Smart contract tests (27 tests)
```bash
cd contracts
npx hardhat test
```

---

## Supported Operations (In-Scope)

| Operation | Description |
|-----------|-------------|
| `transfer` | Send ETH or ERC-20 tokens to an address |
| `swap` | Exchange one token for another (academic simulation) |
| `stake` | Stake ETH in the contract (simulated staking) |

**Out of scope:** Unrestricted autonomous trading, private key custody, mainnet deployment, multi-chain, regulatory compliance.

---

## Transaction Integrity

Each executed transaction generates a SHA-256 hash of:
- request ID, wallet address, operation, token, amount, recipient, blockchain tx hash, chain ID, execution timestamp

This hash is stored off-chain (PostgreSQL) and can be anchored on-chain via `DeFiAgent.anchorIntegrity()`.

Later, the hash can be recomputed and compared against the stored value to detect any record tampering.

**Distinction:**
- ON-CHAIN: blockchain transaction hash + integrity anchor
- OFF-CHAIN: full application record, dashboard metadata

---

## LeVer Contract Assurance (Design-Time)

LeVer (Zhang et al., "Towards Trustworthy Smart Contract Synthesis: A Multi-Agent Framework with Lean-Based Verification", ACL 2026) generates Solidity from a natural-language requirement and checks it with Lean-based formal verification and adversarial simulation. In this project it is used as a **development-time assurance stage for `DeFiAgent.sol`** (FR-07, FR-08), not as part of the runtime flow. The AI still has no authority over funds, and validation plus wallet approval remain the only gates.

How it is integrated:

| Part | Where | What it does |
|------|-------|--------------|
| LeVer | `contract_assurance/lever/` | Vendored unchanged with its MIT licence |
| Requirement specs | `contract_assurance/requirements/` | `DeFiAgent.txt` (as built) and `DeFiAgent_hardened.txt` (adds two fixes) |
| Runner | `contract_assurance/run_assurance.py` | Runs LeVer, saves the candidate contract and result, updates the report |
| Report | `contract_assurance/reports/DeFiAgent.assurance.json` | LeVer result plus reviewed findings mapped to LeVer's property library |
| Backend | `assurance_service.py`, `GET /api/v1/assurance/contract` | Read-only; flags a report as stale if `DeFiAgent.sol` changes |
| Preview / UI | `TransactionPreview` | Shows assurance status and open findings before the user approves (NFR-01) |

Run it (needs Foundry, Lean 4, Python 3.11, an OpenAI key for `gpt-5`; not needed to run the app):

```bash
cd contract_assurance && ./setup_assurance.sh
cp .env.example .env            # add LLM_API_KEY
python run_assurance.py --check
python run_assurance.py --req DeFiAgent --mode full
```

Limits to state honestly:
- The public LeVer release cannot ingest an existing `.sol` file. It synthesizes a reference candidate from the requirement, so a pass is a cross-check of the requirement, not a proof about `DeFiAgent.sol`.
- LeVer has **not been run yet** (status `not_run`). A "passed" result is never a security guarantee, and its Lean model uses unbounded integers, not `uint256`.
- The five findings in the report come from a manual review against LeVer's property library, not from LeVer. Two were medium (`unstake()` blocked while paused; `anchorIntegrity()` open to pre-emption by another wallet) and are now fixed and covered by Hardhat tests; three low/info items remain open. See `docs/LeVer_Integration_Note.md`.
- Foundry, Lean and `gpt-5` are extra to the documented Hardhat and Jest stack and are used only at development time.

---

## Limitations (Academic Prototype)

- Swap functionality is simulated (no real DEX integration in MVP)
- Staking is simulated (ETH held in contract, no real staking protocol)
- ERC-20 transfers require additional token contract setup
- Deployed on Sepolia testnet only — no real funds
- Single-chain (Ethereum/Sepolia only)

---




*This is an academic prototype. Do not deploy with real funds.*
