#!/usr/bin/env bash
# One-time setup of the LeVer contract-assurance stage (design-time only, not needed to run the app).
# Needs: python3.11+, git, Foundry (forge, anvil), solc 0.8.x, Lean 4 (elan). See lever/README.md.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r lever/requirements.txt
python -m pip install "slither-analyzer==0.10.0"
mkdir -p lever/libs_cache
[ -d lever/libs_cache/forge-std ] || git clone --depth 1 https://github.com/foundry-rs/forge-std.git lever/libs_cache/forge-std
[ -d lever/libs_cache/openzeppelin-contracts ] || git clone --depth 1 https://github.com/OpenZeppelin/openzeppelin-contracts.git lever/libs_cache/openzeppelin-contracts
echo "Done. Next: cp .env.example .env ; python run_assurance.py --check"
