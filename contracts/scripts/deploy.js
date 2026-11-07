const { ethers } = require("hardhat");

/**
 * Deployment script for DeFiAgent contract.
 * Deploys to the configured network (hardhat local or Sepolia testnet).
 *
 * After deployment, copy the contract address to .env:
 *   DEFI_AGENT_CONTRACT=0x...
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Max transfer: 1 ETH in wei (matches backend MAX_TX_AMOUNT_ETH=1.0)
  const maxTransferWei = ethers.parseEther("1.0");

  console.log("\nDeploying DeFiAgent...");
  console.log("  Max transfer amount:", ethers.formatEther(maxTransferWei), "ETH");

  const DeFiAgent = await ethers.getContractFactory("DeFiAgent");
  const contract = await DeFiAgent.deploy(maxTransferWei);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✓ DeFiAgent deployed to:", address);
  console.log("  Network:", (await ethers.provider.getNetwork()).name);
  console.log("  Chain ID:", (await ethers.provider.getNetwork()).chainId);

  console.log("\n--- Add this to your .env ---");
  console.log(`DEFI_AGENT_CONTRACT=${address}`);
  console.log("----------------------------\n");

  // Verify the deployment
  const deployedMax = await contract.maxTransferAmount();
  console.log("✓ maxTransferAmount:", ethers.formatEther(deployedMax), "ETH");
  console.log("✓ owner:", await contract.owner());
  console.log("✓ paused:", await contract.paused());

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
