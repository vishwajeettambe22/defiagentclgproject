/**
 * useWallet hook — MetaMask connection, network switching, auto-reconnect, and balance loading.
 * FR-06: Non-custodial wallet connection and explicit authorization.
 *
 * SECURITY: Private keys NEVER leave MetaMask.
 * App never requests, stores, or transmits private keys or seed phrases.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import * as api from "../services/api";
import type { WalletProfile, WalletBalances, TokenBalance } from "../types";

const DEFI_AGENT_ABI = [
  "function transfer(address payable recipient, bytes32 intentHash) external payable",
  "function stake(bytes32 intentHash) external payable",
  "function anchorIntegrity(bytes32 requestId, bytes32 integrityHash) external",
  "function getIntegrityHash(address wallet, bytes32 requestId) external view returns (bytes32)",
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

const SEPOLIA_RPC_FALLBACKS = [
  import.meta.env.VITE_SEPOLIA_RPC_URL,
  "https://rpc.sepolia.org",
  "https://ethereum-sepolia.publicnode.com",
  "https://sepolia.drpc.org",
].filter(Boolean) as string[];

export const SEPOLIA_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin (Sepolia)",
    decimals: 6,
    address: import.meta.env.VITE_USDC_CONTRACT || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin (Sepolia)",
    decimals: 18,
    address: import.meta.env.VITE_DAI_CONTRACT || "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether (Sepolia)",
    decimals: 18,
    address: import.meta.env.VITE_WETH_CONTRACT || "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  },
];

export function getNetworkName(chainId: number | null): string {
  if (!chainId) return "Not Connected";
  switch (chainId) {
    case 11155111:
      return "Sepolia Testnet";
    case 1:
      return "Ethereum Mainnet";
    case 5:
      return "Goerli Testnet";
    case 17000:
      return "Holesky Testnet";
    case 137:
      return "Polygon";
    case 42161:
      return "Arbitrum One";
    case 10:
      return "Optimism";
    case 31337:
    case 1337:
      return "Localhost / Hardhat";
    default:
      return `Chain ${chainId}`;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000, errorMsg = "RPC request timed out"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs)),
  ]);
}

interface WalletState {
  address: string | null;
  chainId: number | null;
  networkName: string;
  isConnected: boolean;
  isConnecting: boolean;
  isWrongNetwork: boolean;
  error: string | null;
  profile: WalletProfile | null;
  balances: WalletBalances | null;
  balancesLoading: boolean;
  balancesError: string | null;
}

const STORAGE_KEY = "defi_agent_wallet";

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    networkName: "Not Connected",
    isConnected: false,
    isConnecting: false,
    isWrongNetwork: false,
    error: null,
    profile: null,
    balances: null,
    balancesLoading: false,
    balancesError: null,
  });

  const isFetchingBalancesRef = useRef<boolean>(false);

  // ── Helper to resolve Sepolia provider ─────────────────────────────────────
  const getSepoliaProvider = useCallback((currentChainId?: number | null): ethers.Provider => {
    // If the browser wallet is currently connected to Sepolia, use BrowserProvider directly
    if (window.ethereum && currentChainId === SEPOLIA_CHAIN_ID) {
      console.log("[Web3] Using connected MetaMask BrowserProvider for Sepolia");
      return new ethers.BrowserProvider(window.ethereum);
    }
    // If wallet is on another chain (e.g. Chain 1 / Mainnet), use direct Sepolia RPC
    // to guarantee we only fetch Sepolia balances, never mainnet data
    const rpcUrl = SEPOLIA_RPC_FALLBACKS[0] || "https://rpc.sepolia.org";
    console.log("[Web3] Using dedicated Sepolia JsonRpcProvider:", rpcUrl);
    return new ethers.JsonRpcProvider(rpcUrl);
  }, []);

  // ── Load balances ─────────────────────────────────────────────────────────
  const loadBalances = useCallback(async (address: string, currentChainId?: number | null) => {
    if (!address || isFetchingBalancesRef.current) return;
    isFetchingBalancesRef.current = true;
    setState(s => ({ ...s, balancesLoading: true, balancesError: null }));

    console.log(`[Web3] Loading balances for ${address} on Sepolia testnet...`);

    try {
      const provider = getSepoliaProvider(currentChainId);

      // 1. Fetch native Sepolia ETH
      console.log("[Web3] Calling provider.getBalance()...");
      const rawEthBalance = await withTimeout(
        provider.getBalance(address),
        8000,
        "Failed to fetch Sepolia ETH balance (RPC timeout)"
      );
      const ethBalanceStr = ethers.formatEther(rawEthBalance);
      const formattedEth = parseFloat(ethBalanceStr).toFixed(4);
      console.log(`[Web3] Sepolia ETH balance: ${formattedEth} ETH (${rawEthBalance.toString()} wei)`);

      // 2. Fetch block number
      let blockNumber: number | undefined;
      try {
        blockNumber = await withTimeout(provider.getBlockNumber(), 4000);
      } catch {
        // optional metadata
      }

      // 3. Fetch ERC-20 balances with address validation
      const tokenBalances: TokenBalance[] = [];
      for (const token of SEPOLIA_TOKENS) {
        if (!token.address || !ethers.isAddress(token.address) || token.address === ethers.ZeroAddress) {
          console.warn(`[Web3] Skipping invalid ERC-20 contract address for ${token.symbol}: ${token.address}`);
          tokenBalances.push({
            symbol: token.symbol,
            name: token.name,
            balance: "0.0000",
            balance_raw: "0",
            decimals: token.decimals,
            contract_address: token.address,
          });
          continue;
        }

        try {
          console.log(`[Web3] Calling balanceOf() for ${token.symbol} at ${token.address}...`);
          const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
          const rawBal: bigint = await withTimeout(
            contract.balanceOf(address),
            5000,
            `${token.symbol} balanceOf call timed out`
          );
          const humanBal = ethers.formatUnits(rawBal, token.decimals);
          const formatted = parseFloat(humanBal).toFixed(token.decimals === 6 ? 2 : 4);
          console.log(`[Web3] ${token.symbol} balance: ${formatted}`);

          tokenBalances.push({
            symbol: token.symbol,
            name: token.name,
            balance: formatted,
            balance_raw: rawBal.toString(),
            decimals: token.decimals,
            contract_address: token.address,
          });
        } catch (tokenErr) {
          console.warn(`[Web3] Could not read ${token.symbol} balance (contract may not be deployed on Sepolia):`, tokenErr);
          tokenBalances.push({
            symbol: token.symbol,
            name: token.name,
            balance: "0.0000",
            balance_raw: "0",
            decimals: token.decimals,
            contract_address: token.address,
          });
        }
      }

      const balancesData: WalletBalances = {
        wallet_address: address,
        network: "Sepolia",
        block_number: blockNumber,
        balances: [
          {
            symbol: "ETH",
            name: "Sepolia Ether",
            balance: formattedEth,
            balance_raw: rawEthBalance.toString(),
            decimals: 18,
            contract_address: undefined,
          },
          ...tokenBalances,
        ],
        fetched_at: new Date().toISOString(),
      };

      setState(s => ({
        ...s,
        balances: balancesData,
        balancesLoading: false,
        balancesError: null,
      }));
      console.log("[Web3] Balance loading complete.");
    } catch (err) {
      console.error("[Web3] Balance loading error:", err);
      setState(s => ({
        ...s,
        balancesLoading: false,
        balancesError: err instanceof Error ? err.message : "Failed to load Sepolia balances.",
      }));
    } finally {
      isFetchingBalancesRef.current = false;
    }
  }, [getSepoliaProvider]);

  // ── Register wallet with backend (optional / non-blocking) ─────────────────
  const registerWithBackend = useCallback(async (address: string) => {
    try {
      const profile = await api.registerWallet(address, "Sepolia");
      setState(s => ({ ...s, profile }));
    } catch (e) {
      console.warn("[Web3] Backend registration skipped or offline:", e);
    }
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState(s => ({
        ...s,
        error: "MetaMask is not installed. Please install MetaMask to use this application.",
      }));
      return;
    }

    setState(s => ({ ...s, isConnecting: true, error: null }));
    console.log("[Web3] Requesting MetaMask connection...");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      if (!accounts.length) throw new Error("No accounts returned from MetaMask.");

      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const address = accounts[0].toLowerCase();
      const isWrong = chainId !== SEPOLIA_CHAIN_ID;
      const networkName = getNetworkName(chainId);

      console.log(`[Web3] Connected: ${address} | Chain ID: ${chainId} (${networkName}) | Wrong Network: ${isWrong}`);

      localStorage.setItem(STORAGE_KEY, address);
      setState(s => ({
        ...s,
        address,
        chainId,
        networkName,
        isConnected: true,
        isConnecting: false,
        isWrongNetwork: isWrong,
        error: null,
      }));

      // Non-blocking registration
      registerWithBackend(address);

      // Load balances immediately
      loadBalances(address, chainId);
    } catch (err) {
      console.error("[Web3] Connection failed:", err);
      setState(s => ({
        ...s,
        isConnecting: false,
        isConnected: false,
        error: err instanceof Error ? err.message : "Connection failed.",
      }));
    }
  }, [registerWithBackend, loadBalances]);

  // ── Switch Network to Sepolia ─────────────────────────────────────────────
  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) {
      setState(s => ({ ...s, error: "MetaMask is not installed." }));
      return;
    }

    console.log(`[Web3] Initiating network switch to Sepolia (0x${SEPOLIA_CHAIN_ID.toString(16)})...`);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      console.log("[Web3] Switched to Sepolia successfully.");
    } catch (switchError: unknown) {
      const err = switchError as { code?: number; data?: { originalError?: { code?: number } } };
      console.warn("[Web3] wallet_switchEthereumChain returned:", switchError);

      // 4902: Chain has not been added to MetaMask
      if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
        try {
          console.log("[Web3] Sepolia not found in MetaMask. Calling wallet_addEthereumChain...");
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID_HEX,
                chainName: "Sepolia Test Network",
                nativeCurrency: {
                  name: "Sepolia Ether",
                  symbol: "SEP",
                  decimals: 18,
                },
                rpcUrls: SEPOLIA_RPC_FALLBACKS,
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          console.log("[Web3] Sepolia successfully added and selected in MetaMask.");
        } catch (addError) {
          console.error("[Web3] Failed to add Sepolia network:", addError);
          setState(s => ({
            ...s,
            error: addError instanceof Error ? addError.message : "Failed to add Sepolia network.",
          }));
        }
      } else {
        setState(s => ({
          ...s,
          error: switchError instanceof Error ? switchError.message : "Failed to switch to Sepolia.",
        }));
      }
    }
  }, []);

  // ── Auto-reconnect on page load ───────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved || !window.ethereum) return;

    (async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum!);
        const accounts: string[] = await provider.send("eth_accounts", []);
        if (accounts.length && accounts[0].toLowerCase() === saved.toLowerCase()) {
          const network = await provider.getNetwork();
          const chainId = Number(network.chainId);
          const isWrong = chainId !== SEPOLIA_CHAIN_ID;
          const networkName = getNetworkName(chainId);

          console.log(`[Web3] Auto-reconnected: ${saved} | Chain ID: ${chainId} (${networkName})`);
          setState(s => ({
            ...s,
            address: saved.toLowerCase(),
            chainId,
            networkName,
            isConnected: true,
            isWrongNetwork: isWrong,
          }));

          registerWithBackend(saved);
          loadBalances(saved, chainId);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        console.warn("[Web3] Auto-reconnect check failed:", err);
      }
    })();
  }, [registerWithBackend, loadBalances]);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    console.log("[Web3] Disconnecting wallet...");
    localStorage.removeItem(STORAGE_KEY);
    setState({
      address: null,
      chainId: null,
      networkName: "Not Connected",
      isConnected: false,
      isConnecting: false,
      isWrongNetwork: false,
      error: null,
      profile: null,
      balances: null,
      balancesLoading: false,
      balancesError: null,
    });
  }, []);

  const refreshBalances = useCallback(() => {
    if (state.address) {
      loadBalances(state.address, state.chainId);
    }
  }, [state.address, state.chainId, loadBalances]);

  // ── MetaMask event listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      console.log("[Web3] MetaMask accountsChanged event:", accs);
      if (!accs || accs.length === 0) {
        disconnect();
      } else {
        const nextAddress = accs[0].toLowerCase();
        localStorage.setItem(STORAGE_KEY, nextAddress);
        setState(s => ({
          ...s,
          address: nextAddress,
          isConnected: true,
          error: null,
        }));
        registerWithBackend(nextAddress);
        loadBalances(nextAddress, state.chainId);
      }
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      const hexStr = chainIdHex as string;
      const newChainId = parseInt(hexStr, 16);
      const isWrong = newChainId !== SEPOLIA_CHAIN_ID;
      const netName = getNetworkName(newChainId);
      console.log(`[Web3] MetaMask chainChanged event: ${hexStr} => Chain ID: ${newChainId} (${netName})`);

      setState(s => ({
        ...s,
        chainId: newChainId,
        networkName: netName,
        isWrongNetwork: isWrong,
        error: null,
      }));

      if (state.address) {
        loadBalances(state.address, newChainId);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged as never);
    window.ethereum.on("chainChanged", handleChainChanged as never);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged as never);
      window.ethereum?.removeListener("chainChanged", handleChainChanged as never);
    };
  }, [disconnect, registerWithBackend, loadBalances, state.address, state.chainId]);

  // ── Execute transfer via MetaMask ─────────────────────────────────────────
  const executeTransfer = useCallback(async (
    contractAddress: string, recipient: string, amountEth: string, intentHash: string
  ): Promise<string> => {
    if (!window.ethereum || !state.address) throw new Error("Wallet not connected.");
    if (state.isWrongNetwork) {
      await switchNetwork();
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const isDeployed = contractAddress && contractAddress !== "0x" + "0".repeat(40);

    console.log(`[Web3] Executing transfer of ${amountEth} ETH to ${recipient}...`);
    if (isDeployed) {
      const contract = new ethers.Contract(contractAddress, DEFI_AGENT_ABI, signer);
      const tx = await contract.transfer(recipient, intentHash, { value: ethers.parseEther(amountEth) });
      await tx.wait();
      return tx.hash;
    } else {
      const tx = await signer.sendTransaction({ to: recipient, value: ethers.parseEther(amountEth) });
      await tx.wait();
      return tx.hash;
    }
  }, [state.address, state.isWrongNetwork, switchNetwork]);

  const executeStake = useCallback(async (
    contractAddress: string, amountEth: string, intentHash: string
  ): Promise<string> => {
    if (!window.ethereum || !state.address) throw new Error("Wallet not connected.");
    if (state.isWrongNetwork) {
      await switchNetwork();
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, DEFI_AGENT_ABI, signer);
    console.log(`[Web3] Executing stake of ${amountEth} ETH...`);
    const tx = await contract.stake(intentHash, { value: ethers.parseEther(amountEth) });
    await tx.wait();
    return tx.hash;
  }, [state.address, state.isWrongNetwork, switchNetwork]);

  const anchorIntegrity = useCallback(async (
    contractAddress: string, requestIdBytes32: string, integrityHashBytes32: string
  ): Promise<string> => {
    if (!window.ethereum || !state.address) throw new Error("Wallet not connected.");
    if (state.isWrongNetwork) {
      await switchNetwork();
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(contractAddress, DEFI_AGENT_ABI, signer);
    console.log(`[Web3] Anchoring integrity hash for request ${requestIdBytes32}...`);
    const tx = await contract.anchorIntegrity(requestIdBytes32, integrityHashBytes32);
    await tx.wait();
    return tx.hash;
  }, [state.address, state.isWrongNetwork, switchNetwork]);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    refreshBalances,
    executeTransfer,
    executeStake,
    anchorIntegrity,
  };
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: never) => void;
      removeListener: (event: string, handler: never) => void;
      isMetaMask?: boolean;
    };
  }
}
