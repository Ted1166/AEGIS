import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES, ORACLE_ABI } from '../config/contracts';
import { RPC_URL } from '../config/chain';
import { parseError } from '../lib/utils';

export interface ScoreEntry {
  address: string;
  score: number;
  realYieldBps: bigint;
  emissionsYieldBps: bigint;
  totalAPYBps: bigint;
  tvl: bigint;
  updatedAt: number;
  tier: number;
  active: boolean;
  fresh: boolean;
}

const readProvider = new ethers.JsonRpcProvider(RPC_URL);
const oracle = new ethers.Contract(ADDRESSES.oracle, ORACLE_ABI, readProvider);

export function useOracle(sourceAddresses: string[]) {
  const [scores, setScores]   = useState<Record<string, ScoreEntry>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string>();

  const refresh = useCallback(async () => {
    if (sourceAddresses.length === 0) return;
    setLoading(true);
    setError(undefined);
    try {
      const entries = await Promise.all(
        sourceAddresses.map(async (addr) => {
          try {
            const entry = await oracle.getScoreUnchecked(addr);
            const now   = Math.floor(Date.now() / 1000);
            const age   = now - Number(entry.updatedAt);
            return {
              address:          addr,
              score:            Number(entry.score),
              realYieldBps:     entry.realYieldBps,
              emissionsYieldBps: entry.emissionsYieldBps,
              totalAPYBps:      entry.totalAPYBps,
              tvl:              entry.tvl,
              updatedAt:        Number(entry.updatedAt),
              tier:             Number(entry.tier),
              active:           entry.active,
              fresh:            age < 3600, // < 1 hour
            } as ScoreEntry;
          } catch {
            return null;
          }
        })
      );

      const map: Record<string, ScoreEntry> = {};
      for (const e of entries) {
        if (e) map[e.address.toLowerCase()] = e;
      }
      setScores(map);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [sourceAddresses.join(',')]); // eslint-disable-line

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  function getScore(address: string): ScoreEntry | undefined {
    return scores[address.toLowerCase()];
  }

  return { scores, loading, error, refresh, getScore };
}