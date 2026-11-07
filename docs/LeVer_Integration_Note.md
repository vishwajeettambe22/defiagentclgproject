# LeVer Integration Note

**Where LeVer fits.** Design-time contract assurance for `DeFiAgent.sol` (FR-07, FR-08). It is not in the runtime path
(intent -> validation -> preview -> MetaMask approval -> execution -> record -> anchoring). The report is shown in the
transaction preview (NFR-01) but never blocks or approves a transaction.

**Findings from the manual review against LeVer's property library** (see `contract_assurance/reports/DeFiAgent.assurance.json`):

| ID | Severity | LeVer property | Finding | Suggested fix |
|----|----------|----------------|---------|---------------|
| MR-1 | medium (RESOLVED) | L3.1-Withdrawal | `unstake()` has `notPaused`; owner cannot be changed, so stakers can be locked out | Remove `notPaused` from `unstake()` |
| MR-2 | medium (RESOLVED) | L3.4-FrontRunning | `anchorIntegrity()` is first-come per `requestId`; another wallet can anchor a wrong hash first and it can't be changed (FR-08) | Bind anchor to `msg.sender` and test it |
| MR-3 | low | L2.4-SideEffects | `unstake()` emits no event | Add `UnstakeExecuted` |
| MR-4 | low | L1.3-UnexpectedEther | `receive`/`fallback` accept Ether that can't be recovered | Remove or document |
| MR-5 | info | scope | Swap and ERC-20 are not on-chain (already in README limitations) | Keep documented |

**Update 2026-10-20:** MR-1 and MR-2 are fixed in `DeFiAgent.sol`. `unstake()` no longer has `notPaused`. Anchors are keyed by
(wallet, requestId) and the getter is now `getIntegrityHash(address wallet, bytes32 requestId)`; the frontend ABI was updated. Four new
Hardhat tests cover both fixes (27 tests pass; run in a sandbox with a solc-js compiler). The contract must be redeployed and
`DEFI_AGENT_CONTRACT` updated, because the old deployed contract has the old behaviour. MR-3 to MR-5 are left open.
The fixes have not been re-reviewed by a second person or by LeVer.

**Open points for the team**
1. Project documents (13 Aug report) treat LeVer as supporting literature, not the base paper. Keep that wording unless the documents are updated.
2. LeVer has not been run (needs Foundry, Lean 4, Slither, `gpt-5` key). Status stays `not_run` until it is.
3. LeVer cannot verify an existing `.sol`; a pass is a cross-check of the requirement text only.
4. Pre-existing frontend type errors (4) in `App.tsx`, `Dashboard.tsx`, `api.ts` make `npm run build` fail; unrelated to LeVer.
