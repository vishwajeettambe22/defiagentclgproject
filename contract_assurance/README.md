# contract_assurance — LeVer-based design-time assurance

See the "LeVer Contract Assurance" section of the root README. Summary:

- `lever/` is LeVer (ACL 2026, MIT) vendored unchanged. `requirements/` holds natural-language specs of `DeFiAgent.sol`.
- `python run_assurance.py --req DeFiAgent --mode full` writes the candidate contract and logs to `output/` and updates `reports/DeFiAgent.assurance.json`.
- The backend only reads that report. If `contracts/contracts/DeFiAgent.sol` changes, the report becomes `stale` and a backend test fails until the review/run is refreshed.
- A candidate in `output/` is never copied into `contracts/` automatically. Compare it with `DeFiAgent.sol`, then test with Hardhat.
- Anvil keys in `lever/core/config.py` are public test keys for LeVer's local sandbox only. Never fund them.
