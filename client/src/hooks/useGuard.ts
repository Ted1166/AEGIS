import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ADDRESSES, GUARD_ABI } from '../config/contracts';
import { RPC_URL } from '../config/chain';
import { parseError } from '../lib/utils';

export interface SignalState {
  tvlDrainage: boolean;
  oracleDeviation: boolean;
  flashLoan: boolean;
  accessControl: boolean;
  bridgeAnomaly: boolean;
  totalActive: number;
}

export interface ProtocolRiskState {
  address: string;
  name: string;
  signals: SignalState;
  inEmergency: boolean;
  isCheckable: boolean;
}

export interface EmergencyEvent {
  protocol: string;
  caller: string;
  bountyPaid: bigint;
  txHash: string;
  blockNumber: number;
}

const readProvider = new ethers.JsonRpcProvider(RPC_URL);
const guard = new ethers.Contract(ADDRESSES.guard, GUARD_ABI, readProvider);

export function useGuard(
  sources: Array<{ address: string; name: string }>,
  signer?: ethers.JsonRpcSigner
) {
  const [protocols, setProtocols]             = useState<ProtocolRiskState[]>([]);
  const [emergencyEvents, setEmergencyEvents] = useState<EmergencyEvent[]>([]);
  const [lastBlock, setLastBlock]             = useState<number>();
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string>();

  const refresh = useCallback(async () => {
    if (sources.length === 0) return;
    setLoading(protocols.length === 0);
    setError(undefined);
    try {
      const [block, results] = await Promise.all([
        readProvider.getBlockNumber(),
        Promise.all(
          sources.map(async ({ address, name }) => {
            const [signals, inEmergency, isCheckable] = await Promise.all([
              guard.getSignalState(address).catch(() => [false, false, false, false, false, 0n]),
              guard.isEmergency(address).catch(() => false),
              guard.isCheckable(address).catch(() => false),
            ]);
            return {
              address,
              name,
              signals: {
                tvlDrainage:     signals[0],
                oracleDeviation: signals[1],
                flashLoan:       signals[2],
                accessControl:   signals[3],
                bridgeAnomaly:   signals[4],
                totalActive:     Number(signals[5]),
              },
              inEmergency,
              isCheckable,
            } as ProtocolRiskState;
          })
        ),
      ]);
      setLastBlock(block);
      setProtocols(results);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [sources.map(s => s.address).join(',')]);

  const fetchEvents = useCallback(async () => {
    try {
      const currentBlock = await readProvider.getBlockNumber();
      const fromBlock    = Math.max(0, currentBlock - 10_000);
      const filter       = guard.filters.EmergencyTriggered();
      const logs         = await guard.queryFilter(filter, fromBlock, currentBlock);
      const events: EmergencyEvent[] = logs.map((log: any) => ({
        protocol:    log.args.protocol,
        caller:      log.args.caller,
        bountyPaid:  log.args.bountyPaid,
        txHash:      log.transactionHash,
        blockNumber: log.blockNumber,
      }));
      setEmergencyEvents(events.reverse());
    } catch { }
  }, []);

  useEffect(() => {
    refresh();
    fetchEvents();
    const id = setInterval(refresh, 12_000);
    return () => clearInterval(id);
  }, [refresh, fetchEvents]);

  const triggerCheck = useCallback(async (protocol: string) => {
    if (!signer) throw new Error('Wallet not connected');
    const guardWrite = new ethers.Contract(ADDRESSES.guard, GUARD_ABI, signer);
    const tx = await guardWrite.checkAndExecute(protocol, { gasLimit: 500_000n });
    await tx.wait(1, 120_000);
    await refresh();
    return tx.hash;
  }, [signer, refresh]);

  const anyEmergency  = protocols.some(p => p.inEmergency);
  const totalSignals  = protocols.reduce((sum, p) => sum + p.signals.totalActive, 0);

  return {
    protocols,
    emergencyEvents,
    lastBlock,
    loading,
    error,
    anyEmergency,
    totalSignals,
    refresh,
    triggerCheck,
  };
}