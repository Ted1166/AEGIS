import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES, VAULT_ABI } from '../config/contracts';
import { RPC_URL } from '../config/chain';

export interface VaultEvent {
  type: 'deposit' | 'withdraw';
  user: string;
  amount: bigint;
  shares: bigint;
  txHash: string;
  blockNumber: number;
  timestamp?: number;
}

export interface VaultStats {
  totalDeposits: bigint;
  totalWithdrawals: bigint;
  totalVolume: bigint;
  uniqueUsers: number;
  depositCount: number;
  withdrawCount: number;
}

const readProvider = new ethers.JsonRpcProvider(RPC_URL);
const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, readProvider);

export function useEvents(address?: string) {
  const [allEvents, setAllEvents]     = useState<VaultEvent[]>([]);
  const [userEvents, setUserEvents]   = useState<VaultEvent[]>([]);
  const [stats, setStats]             = useState<VaultStats>({
    totalDeposits: 0n, totalWithdrawals: 0n, totalVolume: 0n,
    uniqueUsers: 0, depositCount: 0, withdrawCount: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(allEvents.length === 0);
    try {
      const currentBlock = await readProvider.getBlockNumber();
      const fromBlock    = Math.max(0, currentBlock - 50_000);

      const [depositLogs, withdrawLogs] = await Promise.all([
        vault.queryFilter(vault.filters.Deposited(),  fromBlock, currentBlock),
        vault.queryFilter(vault.filters.Withdrawn(),  fromBlock, currentBlock),
      ]);

      const events: VaultEvent[] = [
        ...depositLogs.map((log: any) => ({
          type:        'deposit' as const,
          user:        log.args.user,
          amount:      log.args.amount,
          shares:      log.args.shares,
          txHash:      log.transactionHash,
          blockNumber: log.blockNumber,
        })),
        ...withdrawLogs.map((log: any) => ({
          type:        'withdraw' as const,
          user:        log.args.user,
          shares:      log.args.shares,
          amount:      log.args.amount,
          txHash:      log.transactionHash,
          blockNumber: log.blockNumber,
        })),
      ].sort((a, b) => b.blockNumber - a.blockNumber);

      setAllEvents(events);

      if (address) {
        setUserEvents(events.filter(e =>
          e.user.toLowerCase() === address.toLowerCase()
        ));
      }

      // Compute stats
      const deposits    = events.filter(e => e.type === 'deposit');
      const withdrawals = events.filter(e => e.type === 'withdraw');
      const uniqueUsers = new Set(events.map(e => e.user.toLowerCase())).size;
      const totalDep    = deposits.reduce((a, e) => a + e.amount, 0n);
      const totalWit    = withdrawals.reduce((a, e) => a + e.amount, 0n);

      setStats({
        totalDeposits:    totalDep,
        totalWithdrawals: totalWit,
        totalVolume:      totalDep + totalWit,
        uniqueUsers,
        depositCount:     deposits.length,
        withdrawCount:    withdrawals.length,
      });
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [fetch]);

  return { allEvents, userEvents, stats, loading, refresh: fetch };
}