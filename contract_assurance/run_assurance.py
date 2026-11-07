#!/usr/bin/env python3
"""Design-time contract assurance runner (wraps the vendored LeVer pipeline).

Project role: supports FR-07 / FR-08 and NFR-01 / NFR-03. It is NOT part of the runtime
path (intent -> validation -> preview -> wallet approval -> execution -> record) and uses
no private key, wallet or user fund.

What LeVer does here: given a natural-language requirement it synthesizes a *reference
candidate* contract and checks it (Lean proofs, Foundry attack simulation, Slither).
The public LeVer release cannot ingest an existing .sol file, so a LeVer pass is a
cross-check of the requirement, not a proof about contracts/contracts/DeFiAgent.sol.
The team compares the candidate with DeFiAgent.sol and tests with Hardhat.

Usage:
  python run_assurance.py --check
  python run_assurance.py --req DeFiAgent --mode full
  python run_assurance.py --req DeFiAgent_hardened --mode no_lean
"""
import argparse, hashlib, json, os, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
LEVER = HERE / "lever"
REQ_DIR = HERE / "requirements"
OUT_DIR = HERE / "output"
REPORT = HERE / "reports" / "DeFiAgent.assurance.json"
SOURCE = ROOT / "contracts" / "contracts" / "DeFiAgent.sol"
MODES = {"lean_only": ["lean"], "no_lean": ["forge", "anvil", "slither"],
         "full": ["lean", "forge", "anvil", "slither"]}


def load_env_file():
    env = HERE / ".env"
    if env.is_file():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def preflight(mode):
    problems = []
    if not (os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY")):
        problems.append("LLM_API_KEY (or OPENAI_API_KEY) is not set")
    for tool in dict.fromkeys(["git", "forge", "solc"] + MODES[mode]):
        if tool == "slither" and os.getenv("SLITHER_COMMAND"):
            continue
        if shutil.which(tool) is None:
            problems.append(f"'{tool}' not found on PATH")
    if not (LEVER / "libs_cache" / "forge-std").is_dir():
        problems.append("lever/libs_cache/forge-std missing (run setup_assurance.sh)")
    try:
        import openai  # noqa: F401
    except ImportError:
        problems.append("python package 'openai' is not installed in this interpreter")
    return problems


def sha256_file(p: Path):
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None


def update_report(name, mode, run_id, rc, result):
    """Record the LeVer run in reports/DeFiAgent.assurance.json (read by the backend)."""
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    report["source_sha256"] = sha256_file(SOURCE)
    report["lever_cross_check"] = {
        "status": {0: "passed", 1: "failed"}.get(rc, "error"),
        "requirement": name,
        "mode": mode,
        "run_id": run_id,
        "passed": bool(result.get("passed")) if result else None,
        "lean_passed": (result or {}).get("lean", {}).get("passed"),
        "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "scope_note": report["lever_cross_check"]["scope_note"],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")


def run_one(name, mode, max_iters, attack_rounds):
    req = REQ_DIR / f"{name}.txt"
    if not req.is_file():
        sys.exit(f"Requirement file not found: {req}")
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    cmd = [sys.executable, "-m", "core.main_pipeline", "--mode", mode, "--req-file", str(req),
           "--exp-name", name, "--run-id", run_id, "--max-iters", str(max_iters),
           "--attack-rounds", str(attack_rounds)]
    print(f"\n=== {name} [{mode}] ===")
    rc = subprocess.call(cmd, cwd=LEVER)  # LeVer must run from its own root
    ws = LEVER / "experiments" / name / run_id
    dest = OUT_DIR / name / run_id
    dest.mkdir(parents=True, exist_ok=True)
    for f in ("result.json", "Target.sol", "execution.log"):
        if (ws / f).is_file():
            shutil.copy2(ws / f, dest / (f if f != "Target.sol" else f"{name}.candidate.sol"))
    result = json.loads((ws / "result.json").read_text()) if (ws / "result.json").is_file() else None
    update_report(name, mode, run_id, rc, result)
    print(f"Saved to {dest}; report updated: {REPORT}")
    return rc


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="only verify prerequisites")
    ap.add_argument("--req", default="DeFiAgent", help="requirement stem in requirements/ (or 'all')")
    ap.add_argument("--mode", choices=list(MODES), default="full")
    ap.add_argument("--max-iters", type=int, default=3)
    ap.add_argument("--attack-rounds", type=int, default=3)
    a = ap.parse_args()
    load_env_file()
    problems = preflight(a.mode)
    if a.check or problems:
        print("Prerequisite problems:\n - " + "\n - ".join(problems) if problems else "All prerequisites found.")
        sys.exit(1 if problems else 0)
    names = sorted(p.stem for p in REQ_DIR.glob("*.txt")) if a.req == "all" else [a.req]
    sys.exit(max(run_one(n, a.mode, a.max_iters, a.attack_rounds) for n in names))


if __name__ == "__main__":
    main()
