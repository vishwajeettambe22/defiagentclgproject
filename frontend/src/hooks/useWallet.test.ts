import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID_HEX,
  SEPOLIA_TOKENS,
  getNetworkName,
} from "./useWallet";

describe("Network and Wallet Specifications", () => {
  it("matches Sepolia chain specifications", () => {
    expect(SEPOLIA_CHAIN_ID).toBe(11155111);
    expect(SEPOLIA_CHAIN_ID_HEX).toBe("0xaa36a7");
    expect("0x" + Number(SEPOLIA_CHAIN_ID).toString(16)).toBe(SEPOLIA_CHAIN_ID_HEX);
  });

  it("identifies network names accurately", () => {
    expect(getNetworkName(11155111)).toBe("Sepolia Testnet");
    expect(getNetworkName(1)).toBe("Ethereum Mainnet");
    expect(getNetworkName(5)).toBe("Goerli Testnet");
    expect(getNetworkName(99999)).toBe("Chain 99999");
    expect(getNetworkName(null)).toBe("Not Connected");
  });

  it("validates all configured Sepolia token contract addresses", () => {
    for (const token of SEPOLIA_TOKENS) {
      expect(ethers.isAddress(token.address)).toBe(true);
      expect(token.address).not.toBe(ethers.ZeroAddress);
      expect(token.decimals).toBeGreaterThanOrEqual(6);
    }
  });

  it("converts Wei to ETH accurately using ethers.js formatEther", () => {
    const oneEthInWei = 1000000000000000000n; // 10^18
    expect(ethers.formatEther(oneEthInWei)).toBe("1.0");

    const halfEthInWei = 500000000000000000n; // 0.5 * 10^18
    expect(ethers.formatEther(halfEthInWei)).toBe("0.5");

    const smallWei = 123450000000000000n;
    const formatted = parseFloat(ethers.formatEther(smallWei)).toFixed(4);
    expect(formatted).toBe("0.1235");
  });

  it("converts USDC 6-decimal units accurately using ethers.js formatUnits", () => {
    const hundredUsdc = 100000000n; // 100 * 10^6
    expect(ethers.formatUnits(hundredUsdc, 6)).toBe("100.0");
    const halfUsdc = 500000n; // 0.5 * 10^6
    expect(ethers.formatUnits(halfUsdc, 6)).toBe("0.5");
  });
});

