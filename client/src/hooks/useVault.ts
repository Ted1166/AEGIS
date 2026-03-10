import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES, VAULT_ABI, USDC_ABI, YIELD_SOURCE_ABI, GAS_PARAMS } from '../config/contracts';
import { parseUsdc, parseShares, parseError } from '../lib/utils';
import { RPC_URL } from '../config/chain';

export interface YieldSourceInfo {
  address: string;
  name: string;
  apy: string;       // formatted e.g. "8.00%"
  apyBps: bigint;
  tvl: bigint;
  score: number;
  tier: number;
  realYield: string;
  inEmergency: boolean;
}

interface VaultState {
  totalAssets?: bigint;
  totalShares?: bigint;
  userBalance?: bigint;
  userShares?: bigint;
  usdcBalance?: bigint;
  usdcAllowance?: bigint;
  sources: YieldSourceInfo[];
  loading: boolean;
  error?: string;
}

const readProvider = new ethers.JsonRpcProvider(RPC_URL);

export function useVault(address?: string, signer?: ethers.JsonRpcSigner) {
  const [state, setState] = useState<VaultState>({
    sources: [],
    loading: false,
  });
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState<string>();

  const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, readProvider);
  const usdc  = new ethers.Contract(ADDRESSES.usdc,  USDC_ABI,  readProvider);

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: undefined }));
    try {
      const [totalAssets, totalShares, sourceAddresses] = await Promise.all([
        vault.totalAssets(),
        vault.totalShares(),
        vault.getYieldSources(),
      ]);

      let userBalance: bigint | undefined;
      let userShares: bigint | undefined;
      let usdcBalance: bigint | undefined;
      let usdcAllowance: bigint | undefined;

      if (address) {
        [userBalance, userShares, usdcBalance, usdcAllowance] = await Promise.all([
          vault.balanceOf(address),
          vault.getUserShares(address),
          usdc.balanceOf(address),
          usdc.allowance(address, ADDRESSES.vault),
        ]);
      }

      // Fetch yield source details
      const sources: YieldSourceInfo[] = await Promise.all(
        sourceAddresses.map(async (src: string) => {
          try {
            const sourceContract = new ethers.Contract(src, YIELD_SOURCE_ABI, readProvider);
            const [name, apyBps, tvl] = await Promise.all([
              sourceContract.name().catch(() => `${src.slice(0, 8)}...`),
              sourceContract.currentAPY().catch(() => 0n),
              sourceContract.protocolTVL().catch(() => 0n),
            ]);
            return {
              address: src,
              name,
              apy:   `${(Number(apyBps) / 100).toFixed(2)}%`,
              apyBps,
              tvl,
              score: 0,   // filled by useOracle
              tier:  0,
              realYield: '—',
              inEmergency: false,
            };
          } catch {
            return {
              address: src,
              name: `${src.slice(0, 8)}...`,
              apy: '—',
              apyBps: 0n,
              tvl: 0n,
              score: 0,
              tier: 0,
              realYield: '—',
              inEmergency: false,
            };
          }
        })
      );

      setState({
        totalAssets,
        totalShares,
        userBalance,
        userShares,
        usdcBalance,
        usdcAllowance,
        sources,
        loading: false,
      });
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        error: parseError(err),
      }));
    }
  }, [address]);

  // Auto-refresh on mount and every 15s
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const deposit = useCallback(async (amount: string) => {
    if (!signer) throw new Error('Wallet not connected');
    setDepositing(true);
    setTxHash(undefined);
    try {
      const amountBn = parseUsdc(amount);
      const vaultWrite = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, signer);
      const usdcWrite  = new ethers.Contract(ADDRESSES.usdc,  USDC_ABI,  signer);

      // Check allowance
      if ((state.usdcAllowance ?? 0n) < amountBn) {
        const approveTx = await usdcWrite.approve(ADDRESSES.vault, amountBn, GAS_PARAMS);
        await approveTx.wait(1, 120_000);
      }

      const tx = await vaultWrite.deposit(amountBn, GAS_PARAMS);
      setTxHash(tx.hash);
      await tx.wait(1, 120_000);
      await refresh();
    } finally {
      setDepositing(false);
    }
  }, [signer, state.usdcAllowance, refresh]);

  const withdraw = useCallback(async (shares: string) => {
    if (!signer) throw new Error('Wallet not connected');
    setWithdrawing(true);
    setTxHash(undefined);
    try {
      const sharesBn = parseShares(shares);
      const vaultWrite = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, signer);
      const tx = await vaultWrite.withdraw(sharesBn, GAS_PARAMS);
      setTxHash(tx.hash);
      await tx.wait(1, 120_000);
      await refresh();
    } finally {
      setWithdrawing(false);
    }
  }, [signer, refresh]);

  return {
    ...state,
    depositing,
    withdrawing,
    txHash,
    deposit,
    withdraw,
    refresh,
  };
}