require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * Hardhat configuration.
 * NFR-03: Open-source/testnet deployable.
 * Uses Sepolia testnet. Never deploys to mainnet in academic mode.
 * All secrets via environment variables — never hard-coded.
 */

// Deployer private key — TESTNET ONLY, no real funds
// Load from .env — NEVER commit a real private key
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);
const SEPOLIA_RPC_URL = process.env.RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/placeholder";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Local Hardhat network for development
    hardhat: {
      chainId: 31337,
    },
    // Sepolia testnet — academic prototype deployment
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
