// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeFiAgent
 * @notice AI-Driven Conversational DeFi Transaction Agent — Smart Contract
 *
 * FR-07: Execute approved transactions through smart contracts.
 * FR-08: On-chain transaction recording.
 *
 * SECURITY DESIGN:
 * - This contract ONLY executes transactions that have been explicitly
 *   signed and submitted by the user's wallet (non-custodial).
 * - The AI and backend have NO authority to call this contract.
 * - Only the connected user wallet (msg.sender) initiates transactions.
 * - All executed transactions are recorded as events on-chain.
 * - Pausing blocks new transfers/stakes only; users can always unstake.
 * - Spending limits are enforced both in the backend AND on-chain.
 *
 * SCOPE: Academic prototype — Sepolia testnet only.
 * Supports: ETH transfers, basic stake simulation.
 */
contract DeFiAgent {

    // ── Events (on-chain transaction record — FR-08) ──────────────────────────

    event TransferExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        bytes32 indexed intentHash  // Links to the off-chain integrity hash
    );

    event StakeExecuted(
        address indexed staker,
        uint256 amount,
        uint256 timestamp,
        bytes32 indexed intentHash
    );

    event IntegrityAnchored(
        bytes32 indexed requestId,
        bytes32 integrityHash,
        address indexed wallet,
        uint256 timestamp
    );

    // ── State ──────────────────────────────────────────────────────────────────

    address public owner;
    uint256 public maxTransferAmount;   // Spending limit enforced on-chain
    bool public paused;                 // Emergency stop

    // Staking ledger (simulated for academic prototype)
    mapping(address => uint256) public stakedBalance;

    // Integrity anchors: wallet → requestId → integrityHash (FR-08).
    // Keyed by the anchoring wallet so no other wallet can pre-empt (front-run)
    // or block another wallet's anchor for the same requestId.
    mapping(address => mapping(bytes32 => bytes32)) public integrityAnchors;

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "DeFiAgent: caller is not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "DeFiAgent: contract is paused");
        _;
    }

    modifier validAmount(uint256 amount) {
        require(amount > 0, "DeFiAgent: amount must be positive");
        require(amount <= maxTransferAmount, "DeFiAgent: amount exceeds spending limit");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────────

    /**
     * @param _maxTransferAmount Maximum ETH per transaction (in wei).
     *        Set to 1 ETH (1e18 wei) for academic prototype.
     */
    constructor(uint256 _maxTransferAmount) {
        owner = msg.sender;
        maxTransferAmount = _maxTransferAmount;
        paused = false;
    }

    // ── Transfer (FR-07) ───────────────────────────────────────────────────────

    /**
     * @notice Execute an ETH transfer to a recipient.
     *
     * The user calls this directly via MetaMask after approving the preview.
     * The intentHash links this on-chain event to the off-chain integrity record.
     *
     * @param recipient   Destination address
     * @param intentHash  SHA-256 hash of the application intent record (bytes32)
     */
    function transfer(
        address payable recipient,
        bytes32 intentHash
    )
        external
        payable
        notPaused
        validAmount(msg.value)
    {
        require(recipient != address(0), "DeFiAgent: recipient is zero address");
        require(recipient != msg.sender, "DeFiAgent: cannot transfer to self");

        (bool success, ) = recipient.call{value: msg.value}("");
        require(success, "DeFiAgent: transfer failed");

        emit TransferExecuted(
            msg.sender,
            recipient,
            msg.value,
            block.timestamp,
            intentHash
        );
    }

    // ── Stake (FR-07 — simulated for academic prototype) ─────────────────────

    /**
     * @notice Stake ETH — held in this contract (simulated staking).
     *
     * For the academic prototype, staking is simulated by holding ETH
     * in the contract. Real staking would integrate with a staking protocol.
     *
     * @param intentHash  Links to the off-chain intent/integrity record
     */
    function stake(bytes32 intentHash)
        external
        payable
        notPaused
        validAmount(msg.value)
    {
        stakedBalance[msg.sender] += msg.value;

        emit StakeExecuted(
            msg.sender,
            msg.value,
            block.timestamp,
            intentHash
        );
    }

    /**
     * @notice Unstake ETH and return to the user.
     *
     * Intentionally NOT guarded by notPaused: the emergency stop blocks new
     * transfers and stakes only, so users can always withdraw their own staked
     * funds even if the owner pauses the contract.
     *
     * @param amount  Amount to unstake (in wei)
     */
    function unstake(uint256 amount) external {
        require(amount > 0, "DeFiAgent: amount must be positive");
        require(stakedBalance[msg.sender] >= amount, "DeFiAgent: insufficient staked balance");

        stakedBalance[msg.sender] -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "DeFiAgent: unstake failed");
    }

    // ── Integrity Anchoring (FR-08) ────────────────────────────────────────────

    /**
     * @notice Anchor a transaction integrity hash on-chain.
     *
     * The backend calls this (via user wallet signature) to anchor
     * the SHA-256 integrity hash of the application transaction record.
     * Later, this can be used to verify the off-chain record has not been tampered with.
     *
     * ON-CHAIN: (wallet, requestId) → integrityHash mapping
     * OFF-CHAIN: full application record details (database)
     *
     * The anchor is stored under msg.sender, so another wallet cannot anchor
     * a different hash first and block this wallet's anchor. A wallet can
     * anchor each requestId only once and cannot overwrite it.
     *
     * @param requestId      Application request UUID as bytes32
     * @param integrityHash  SHA-256 hash of the canonical transaction record
     */
    function anchorIntegrity(
        bytes32 requestId,
        bytes32 integrityHash
    )
        external
        notPaused
    {
        require(requestId != bytes32(0), "DeFiAgent: invalid requestId");
        require(integrityHash != bytes32(0), "DeFiAgent: invalid integrityHash");
        require(
            integrityAnchors[msg.sender][requestId] == bytes32(0),
            "DeFiAgent: integrity already anchored for this request"
        );

        integrityAnchors[msg.sender][requestId] = integrityHash;

        emit IntegrityAnchored(
            requestId,
            integrityHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Retrieve the integrity hash a wallet anchored for a request.
     * @param wallet     Wallet that anchored the hash
     * @param requestId  Application request UUID as bytes32
     * @return The anchored integrity hash (zero if not anchored)
     */
    function getIntegrityHash(address wallet, bytes32 requestId) external view returns (bytes32) {
        return integrityAnchors[wallet][requestId];
    }

    // ── Admin (emergency controls) ─────────────────────────────────────────────

    /**
     * @notice Pause all transactions (emergency stop).
     */
    function pause() external onlyOwner {
        paused = true;
    }

    /**
     * @notice Resume transactions.
     */
    function unpause() external onlyOwner {
        paused = false;
    }

    /**
     * @notice Update the maximum transfer amount spending limit.
     * @param newLimit  New limit in wei
     */
    function setMaxTransferAmount(uint256 newLimit) external onlyOwner {
        require(newLimit > 0, "DeFiAgent: limit must be positive");
        maxTransferAmount = newLimit;
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    function getStakedBalance(address user) external view returns (uint256) {
        return stakedBalance[user];
    }

    receive() external payable {}
    fallback() external payable {}
}
