# Feature Matrix: DeFi Agent Web3 Platform

| Module | Feature | Implementation Details | Backend / Blockchain Endpoint | Status |
|---|---|---|---|---|
| **A. Overview / Dashboard** | Portfolio Value Summary | USD valuation calculated from ETH + ERC-20 balances | Client-side aggregation + RPC | **Planned** |
| | Quick Action Bar | Direct shortcuts to Swap, Send, Receive, and AI Assistant | Frontend Router | **Planned** |
| | Asset Allocation Visualizer | Percentage distribution of ETH, USDC, DAI, WETH | Client-side token math | **Planned** |
| | Recent Activity Feed | Real-time list of latest transactions with status chips | `GET /api/v1/dashboard/{addr}` | **In Progress** |
| | Network & Chain Indicator | Live chain status badge with mismatch banner | MetaMask `eth_chainId` | **Implemented** |
| **B. Wallet Management** | MetaMask Connection | Non-custodial connection with localStorage persistence | MetaMask `eth_requestAccounts` | **Implemented** |
| | Network Switching | Seamless `wallet_switchEthereumChain` with Sepolia auto-add | `wallet_addEthereumChain` | **Implemented** |
| | Multi-Token Balance Loader | Sepolia ETH (native) + ERC-20 (`balanceOf`) with fallback RPC | `JsonRpcProvider` / `BrowserProvider` | **Implemented** |
| | Account Change Listener | Dynamic re-registration and balance re-fetch on account switch | `accountsChanged` event | **Implemented** |
| | Address Copy & Explorer Link | Formatted 0x address with copy-to-clipboard toast & Etherscan link | Etherscan Sepolia URL | **Planned** |
| **C. Swap Interface** | Token Selection & Search | Selection modal for ETH, USDC, DAI, WETH with balances | Local token registry | **Planned** |
| | Pair Inversion Button | Reversible swap inputs with balance synchronization | Client-side reactive state | **Planned** |
| | Price & Ratio Calculator | Realistic testnet exchange rates & output estimation | Price calculation service | **Planned** |
| | Slippage Tolerance Settings | Configurable 0.1%, 0.5%, 1.0%, or custom percentage | Client state | **Planned** |
| | Minimum Received & Price Impact | Calculation of slippage bounds and warning display | Client state | **Planned** |
| | Non-custodial Swap Signing | Transaction preparation & explicit signature in MetaMask | `DeFiAgent.sol` / direct transfer | **Planned** |
| **D. Send & Receive** | Native ETH / Token Transfer | Send form with token selector, balance check, and Max button | `DeFiAgent.transfer` / Signer tx | **Planned** |
| | Recipient Address Validation | Real-time `ethers.isAddress` validation and zero-address prevention | Client-side checksum validation | **Planned** |
| | Gas Estimation Display | Dynamic fee estimation before prompt | `provider.estimateGas` | **Planned** |
| | Receive QR Code | High-contrast QR code display for the connected wallet address | Client-side SVG generator | **Planned** |
| **E. Portfolio Tracker** | Detailed Holdings Table | Asset name, symbol, contract address, balance, USD value | `useWallet` balances | **Planned** |
| | Asset Search & Filter | Filter tokens by name, symbol, or minimum balance | Client state filter | **Planned** |
| | Testnet Faucet Shortcuts | Direct links to Sepolia ETH and Circle test USDC faucets | External resource links | **Planned** |
| **F. Activity & History** | Comprehensive Tx History | Full audit trail of past commands and executions | `GET /api/v1/dashboard/{addr}` | **In Progress** |
| | Status Filtering | Filter by Completed, Failed, Validation Failed, Pending | Client-side filter | **Planned** |
| | Transaction Detail Modal | Full inspection: intent, validation check breakdown, tx hash | `GET /api/v1/wallet/{addr}/transaction/{id}` | **Implemented** |
| | Integrity Verification | Cryptographic verification of off-chain record against SHA-256 hash | `POST /api/v1/transaction/verify-integrity` | **Implemented** |
| **G. AI DeFi Assistant** | Natural Language Parser | Gemini API conversational parsing to structured `DeFiIntent` | `POST /api/v1/transaction/parse` | **Implemented** |
| | Deterministic Security Rules | Enforces spending limit, token whitelist, valid operation | `POST /api/v1/transaction/validate/{id}` | **Implemented** |
| | Pre-Execution Preview Card | Explainable summary, security checks, warnings before signing | `POST /api/v1/transaction/preview/{id}` | **Implemented** |
| | Conversational Query Mode | Handles portfolio questions and general guidance gracefully | Gemini fallback prompt | **Planned** |
| **H. Analytics & Protocol** | Activity Summary Cards | Total requests, completion rate, volume estimation | `GET /api/v1/dashboard/{addr}` | **Planned** |
| | Protocol Security Metrics | LeVer smart contract formal assurance status display | `GET /api/v1/assurance/contract` | **Implemented** |
| **I. Settings & Security** | RPC Node Configuration | Read-only inspection of active Sepolia RPC endpoint | Client env config | **Planned** |
| | Slippage Defaults | Persistent default slippage tolerance stored in localStorage | `localStorage` | **Planned** |
| | Contract Address Registry | Verified Sepolia contract address inspection | `settings` / `import.meta.env` | **Planned** |
| **J. Design System** | Premium Dark Theme Tokens | Deep charcoal palette, typography hierarchy, border radiuses | `theme.css` | **Planned** |
| | Reusable UI Primitives | Button, Card, Badge, Modal, Toast, Skeleton, EmptyState | `components/common/` | **Planned** |

