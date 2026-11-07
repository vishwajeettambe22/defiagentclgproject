const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Smart contract tests for DeFiAgent.
 * Tests authorization, valid/invalid execution, spending limits, integrity anchoring.
 *
 * FR-07: Smart contract execution tests.
 * FR-08: On-chain integrity anchoring tests.
 */

describe("DeFiAgent", function () {
  let contract;
  let owner;
  let user1;
  let user2;
  const MAX_TRANSFER = ethers.parseEther("1.0");  // 1 ETH limit

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const DeFiAgent = await ethers.getContractFactory("DeFiAgent");
    contract = await DeFiAgent.deploy(MAX_TRANSFER);
    await contract.waitForDeployment();
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the owner correctly", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should set the spending limit correctly", async function () {
      expect(await contract.maxTransferAmount()).to.equal(MAX_TRANSFER);
    });

    it("should not be paused initially", async function () {
      expect(await contract.paused()).to.equal(false);
    });
  });

  // ── Transfer (FR-07) ────────────────────────────────────────────────────────

  describe("Transfer", function () {
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test-request-001"));

    it("should transfer ETH to recipient and emit event", async function () {
      const amount = ethers.parseEther("0.1");
      const recipientBalanceBefore = await ethers.provider.getBalance(user2.address);

      const tx = await contract.connect(user1).transfer(user2.address, intentHash, {
        value: amount,
      });

      const receipt = await tx.wait();
      const recipientBalanceAfter = await ethers.provider.getBalance(user2.address);

      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(amount);

      // Check event was emitted (FR-08: on-chain record)
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "TransferExecuted"
      );
      expect(event).to.not.be.undefined;
    });

    it("should reject transfer of zero ETH", async function () {
      await expect(
        contract.connect(user1).transfer(user2.address, intentHash, { value: 0 })
      ).to.be.revertedWith("DeFiAgent: amount must be positive");
    });

    it("should reject transfer exceeding spending limit (FR-03)", async function () {
      const overLimit = ethers.parseEther("2.0");  // Over 1 ETH limit
      await expect(
        contract.connect(user1).transfer(user2.address, intentHash, { value: overLimit })
      ).to.be.revertedWith("DeFiAgent: amount exceeds spending limit");
    });

    it("should reject transfer to zero address", async function () {
      await expect(
        contract.connect(user1).transfer(ethers.ZeroAddress, intentHash, {
          value: ethers.parseEther("0.1"),
        })
      ).to.be.revertedWith("DeFiAgent: recipient is zero address");
    });

    it("should reject transfer to self", async function () {
      await expect(
        contract.connect(user1).transfer(user1.address, intentHash, {
          value: ethers.parseEther("0.1"),
        })
      ).to.be.revertedWith("DeFiAgent: cannot transfer to self");
    });

    it("should reject transfer when paused (emergency stop)", async function () {
      await contract.connect(owner).pause();
      await expect(
        contract.connect(user1).transfer(user2.address, intentHash, {
          value: ethers.parseEther("0.1"),
        })
      ).to.be.revertedWith("DeFiAgent: contract is paused");
    });

    it("should allow transfer exactly at spending limit", async function () {
      const atLimit = ethers.parseEther("1.0");
      await expect(
        contract.connect(user1).transfer(user2.address, intentHash, { value: atLimit })
      ).to.not.be.reverted;
    });
  });

  // ── Stake (FR-07 — simulated) ───────────────────────────────────────────────

  describe("Stake", function () {
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("stake-request-001"));

    it("should stake ETH and increase balance", async function () {
      const amount = ethers.parseEther("0.5");
      await contract.connect(user1).stake(intentHash, { value: amount });
      expect(await contract.getStakedBalance(user1.address)).to.equal(amount);
    });

    it("should emit StakeExecuted event", async function () {
      const amount = ethers.parseEther("0.3");
      const tx = await contract.connect(user1).stake(intentHash, { value: amount });
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "StakeExecuted"
      );
      expect(event).to.not.be.undefined;
    });

    it("should reject stake over spending limit", async function () {
      await expect(
        contract.connect(user1).stake(intentHash, { value: ethers.parseEther("5.0") })
      ).to.be.revertedWith("DeFiAgent: amount exceeds spending limit");
    });

    it("should allow unstake after stake", async function () {
      const amount = ethers.parseEther("0.5");
      await contract.connect(user1).stake(intentHash, { value: amount });
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      await contract.connect(user1).unstake(amount);
      expect(await contract.getStakedBalance(user1.address)).to.equal(0);
    });

    it("should allow unstake while paused so staked funds are never locked", async function () {
      const amount = ethers.parseEther("0.5");
      await contract.connect(user1).stake(intentHash, { value: amount });
      await contract.connect(owner).pause();
      await contract.connect(user1).unstake(amount);
      expect(await contract.getStakedBalance(user1.address)).to.equal(0);
    });

    it("should still block new stakes while paused", async function () {
      await contract.connect(owner).pause();
      await expect(
        contract.connect(user1).stake(intentHash, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("DeFiAgent: contract is paused");
    });

    it("should reject unstake of more than staked", async function () {
      await contract.connect(user1).stake(intentHash, { value: ethers.parseEther("0.1") });
      await expect(
        contract.connect(user1).unstake(ethers.parseEther("1.0"))
      ).to.be.revertedWith("DeFiAgent: insufficient staked balance");
    });
  });

  // ── Integrity Anchoring (FR-08) ────────────────────────────────────────────

  describe("Integrity Anchoring", function () {
    const requestId = ethers.keccak256(ethers.toUtf8Bytes("request-uuid-001"));
    const integrityHash = ethers.keccak256(ethers.toUtf8Bytes("sha256-hash-of-record"));

    it("should anchor integrity hash and emit event", async function () {
      const tx = await contract.connect(user1).anchorIntegrity(requestId, integrityHash);
      const receipt = await tx.wait();

      const stored = await contract.getIntegrityHash(user1.address, requestId);
      expect(stored).to.equal(integrityHash);

      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "IntegrityAnchored"
      );
      expect(event).to.not.be.undefined;
    });

    it("should reject duplicate anchoring for same requestId", async function () {
      await contract.connect(user1).anchorIntegrity(requestId, integrityHash);
      await expect(
        contract.connect(user1).anchorIntegrity(requestId, integrityHash)
      ).to.be.revertedWith("DeFiAgent: integrity already anchored for this request");
    });

    it("should reject zero requestId", async function () {
      await expect(
        contract.connect(user1).anchorIntegrity(ethers.ZeroHash, integrityHash)
      ).to.be.revertedWith("DeFiAgent: invalid requestId");
    });

    it("should not let another wallet pre-empt or block an anchor (front-running)", async function () {
      const bogusHash = ethers.keccak256(ethers.toUtf8Bytes("attacker-hash"));
      // Attacker (user2) anchors a wrong hash for the same requestId first
      await contract.connect(user2).anchorIntegrity(requestId, bogusHash);
      // The real wallet can still anchor its own hash
      await contract.connect(user1).anchorIntegrity(requestId, integrityHash);
      expect(await contract.getIntegrityHash(user1.address, requestId)).to.equal(integrityHash);
      expect(await contract.getIntegrityHash(user2.address, requestId)).to.equal(bogusHash);
    });

    it("should not let a wallet read another wallet's anchor as its own", async function () {
      await contract.connect(user1).anchorIntegrity(requestId, integrityHash);
      expect(await contract.getIntegrityHash(user2.address, requestId)).to.equal(ethers.ZeroHash);
    });

    it("should return zero for unanchored requestId", async function () {
      const unknown = ethers.keccak256(ethers.toUtf8Bytes("unknown-request"));
      expect(await contract.getIntegrityHash(user1.address, unknown)).to.equal(ethers.ZeroHash);
    });
  });

  // ── Admin controls ─────────────────────────────────────────────────────────

  describe("Admin Controls", function () {
    it("should allow owner to pause and unpause", async function () {
      await contract.connect(owner).pause();
      expect(await contract.paused()).to.equal(true);
      await contract.connect(owner).unpause();
      expect(await contract.paused()).to.equal(false);
    });

    it("should reject non-owner pause attempt", async function () {
      await expect(
        contract.connect(user1).pause()
      ).to.be.revertedWith("DeFiAgent: caller is not owner");
    });

    it("should allow owner to update spending limit", async function () {
      const newLimit = ethers.parseEther("0.5");
      await contract.connect(owner).setMaxTransferAmount(newLimit);
      expect(await contract.maxTransferAmount()).to.equal(newLimit);
    });

    it("should reject non-owner spending limit update", async function () {
      await expect(
        contract.connect(user1).setMaxTransferAmount(ethers.parseEther("5.0"))
      ).to.be.revertedWith("DeFiAgent: caller is not owner");
    });
  });
});
