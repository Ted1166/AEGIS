import React, { useMemo } from 'react';
import { PageContent, PageHeader } from '../components/layout/Layout';
import { Card, CardLabel } from '../components/ui/Card';
import { Badge, TierBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useVault } from '../hooks/useVault';
import { useOracle } from '../hooks/useOracle';
import { useGuard } from '../hooks/useGuard';
import { useEvents } from '../hooks/useEvents';
import { formatUsdc, formatBps, scoreColor, tierLabel, timeAgo } from '../lib/utils';
import { explorerTx, explorerAddress } from '../config/chain';
import type { ethers } from 'ethers';

interface AnalyticsProps {
  address?: string;
  signer?: ethers.JsonRpcSigner;
  onConnect?: () => void;
}

function StatCell({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

function TxRow({ evt, isUser }: { evt: any; isUser?: boolean }) {
  const isDeposit = evt.type === 'deposit';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '80px 1fr 120px 80px',
      alignItems: 'center', gap: '12px',
      padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      <Badge variant={isDeposit ? 'green' : 'amber'}>{isDeposit ? '↓ Deposit' : '↑ Withdraw'}</Badge>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: isUser ? 'var(--green)' : 'var(--text-secondary)' }}>
          {evt.user.slice(0, 8)}...{evt.user.slice(-6)}
          {isUser && <span style={{ marginLeft: '6px', color: 'var(--text-dim)', fontSize: '10px' }}>(you)</span>}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
          Block #{evt.blockNumber.toLocaleString()}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: isDeposit ? 'var(--green)' : 'var(--amber)', textAlign: 'right' }}>
        {isDeposit ? '+' : '-'}${formatUsdc(evt.amount)} USDC
      </div>
      <a
        href={explorerTx(evt.txHash)}
        target="_blank" rel="noopener noreferrer"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--blue)', textAlign: 'right', textDecoration: 'none' }}
      >
        tx ↗
      </a>
    </div>
  );
}

export function Analytics({ address, signer, onConnect }: AnalyticsProps) {
  const vault  = useVault(address, signer);
  const oracle = useOracle(vault.sources.map(s => s.address));
  const guard  = useGuard(vault.sources.map(s => ({ address: s.address, name: s.name })), signer);
  const events = useEvents(address);

  const enrichedSources = useMemo(() =>
    vault.sources.map(src => ({
      ...src,
      scoreEntry: oracle.getScore(src.address),
      riskState:  guard.protocols.find(p => p.address.toLowerCase() === src.address.toLowerCase()),
    })),
    [vault.sources, oracle.scores, guard.protocols]
  );

  const avgScore    = enrichedSources.length
    ? Math.round(enrichedSources.reduce((a, s) => a + (s.scoreEntry ? Number(s.scoreEntry.score) : 0), 0) / enrichedSources.length)
    : 0;
  const totalSignals = guard.protocols.reduce((a, p) => a + p.signals.totalActive, 0);

  const annotatedEvents = events.allEvents.map(e => ({
    ...e,
    isUser: !!address && e.user.toLowerCase() === address.toLowerCase(),
  }));

  return (
    <PageContent>
      <PageHeader
        title="Analytics"
        subtitle="Live on-chain data · Yield scores · Risk signals"
        right={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Badge variant="neutral">Block #{guard.lastBlock?.toLocaleString() ?? '—'}</Badge>
            {events.loading && <Spinner size={14} />}
          </div>
        }
      />

      {/* Global stats — always visible */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCell label="Vault TVL"       value={`$${formatUsdc(vault.totalAssets)}`}           sub="USDC" color="var(--green)" />
        <StatCell label="Total Volume"    value={`$${formatUsdc(events.stats.totalVolume)}`}     sub={`${events.stats.depositCount + events.stats.withdrawCount} txns`} />
        <StatCell label="Unique Wallets"  value={`${events.stats.uniqueUsers}`}                  sub="depositors" />
        <StatCell label="Active Signals"  value={`${totalSignals}`}                              color={totalSignals > 0 ? 'var(--amber)' : 'var(--green)'} sub="across protocols" />
      </div>

      {/* Transaction history */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* All transactions */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <CardLabel style={{ marginBottom: 0 }}>Transaction History</CardLabel>
              {address
                ? <Badge variant="green" dot>Wallet connected</Badge>
                : <Badge variant="neutral">Global view</Badge>
              }
            </div>

            {events.loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}><Spinner /></div>
            ) : annotatedEvents.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
                No transactions recorded yet
              </div>
            ) : (
              <div>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 80px', gap: '12px', padding: '0 0 8px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                  {['Type', 'User', 'Amount', 'Tx'].map(h => (
                    <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: h === 'Amount' || h === 'Tx' ? 'right' : 'left' }}>{h}</div>
                  ))}
                </div>
                {annotatedEvents.slice(0, 20).map(evt => (
                  <TxRow key={evt.txHash} evt={evt} isUser={evt.isUser} />
                ))}
              </div>
            )}
          </Card>

          {/* activity - gated */}
          {address ? (
            <Card accent="green">
              <CardLabel style={{ marginBottom: '16px' }}>Your Activity</CardLabel>
              {events.userEvents.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
                  No transactions yet — make your first deposit!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <StatCell
                    label="Total Deposited"
                    value={`$${formatUsdc(events.userEvents.filter(e => e.type === 'deposit').reduce((a, e) => a + e.amount, 0n))}`}
                    color="var(--green)"
                  />
                  <StatCell
                    label="Total Withdrawn"
                    value={`$${formatUsdc(events.userEvents.filter(e => e.type === 'withdraw').reduce((a, e) => a + e.amount, 0n))}`}
                    color="var(--amber)"
                  />
                  <StatCell
                    label="Transactions"
                    value={`${events.userEvents.length}`}
                    sub={`${events.userEvents.filter(e => e.type === 'deposit').length}d / ${events.userEvents.filter(e => e.type === 'withdraw').length}w`}
                  />
                </div>
              )}
              <div>
                {events.userEvents.map(evt => <TxRow key={evt.txHash} evt={evt} isUser />)}
              </div>
            </Card>
          ) : (
            <Card>
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
                  Connect to see your activity
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '20px', lineHeight: 1.6 }}>
                  Your deposits, withdrawals, and personal yield stats are visible only after connecting your wallet.
                </div>
                {onConnect && (
                  <Button variant="primary" size="md" onClick={onConnect}>
                    Connect Wallet
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right column — scores + signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Yield scores */}
          <Card>
            <CardLabel style={{ marginBottom: '16px' }}>Yield Quality Scores</CardLabel>
            {enrichedSources.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>No sources tracked</div>
            ) : enrichedSources.map(src => {
              const score    = src.scoreEntry;
              const scoreNum = score ? Number(score.score) : 0;
              const color    = scoreColor(scoreNum);
              return (
                <div key={src.address} style={{ marginBottom: '14px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '2px' }}>{src.name}</div>
                      <a href={explorerAddress(src.address)} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--blue)', textDecoration: 'none' }}>
                        {src.address.slice(0, 8)}...↗
                      </a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {score && <TierBadge tier={score.tier} />}
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color }}>{scoreNum}</span>
                    </div>
                  </div>
                  <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ height: '100%', width: `${scoreNum}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    {[
                      { l: 'Total APY',  v: score ? formatBps(score.totalAPYBps) : '—' },
                      { l: 'Real Yield', v: score ? formatBps(score.realYieldBps) : '—' },
                      { l: 'TVL',        v: score ? `$${formatUsdc(score.tvl)}` : '—' },
                      { l: 'Updated',    v: score?.updatedAt ? timeAgo(score.updatedAt) : '—' },
                    ].map(({ l, v }) => (
                      <div key={l} style={{ padding: '5px', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', marginBottom: '2px', textTransform: 'uppercase' }}>{l}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Live signals */}
          <Card>
            <CardLabel style={{ marginBottom: '12px' }}>Live Signal State</CardLabel>
            {guard.protocols.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>No protocols monitored</div>
            ) : guard.protocols.map(protocol => {
              const SIGS = [
                { key: 'tvlDrainage',     label: 'TVL Drainage',   icon: '📉' },
                { key: 'oracleDeviation', label: 'Oracle Dev',     icon: '📊' },
                { key: 'flashLoan',       label: 'Flash Loan',     icon: '⚡' },
                { key: 'accessControl',   label: 'Access Control', icon: '🔐' },
              ] as const;
              return (
                <div key={protocol.address} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px' }}>{protocol.name}</span>
                    {protocol.inEmergency
                      ? <Badge variant="red" dot pulse>Emergency</Badge>
                      : protocol.signals.totalActive > 0
                      ? <Badge variant="amber" dot>{protocol.signals.totalActive} active</Badge>
                      : <Badge variant="green" dot>Clear</Badge>
                    }
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                    {SIGS.map(({ key, label, icon }) => {
                      const active = protocol.signals[key as keyof typeof protocol.signals] === true;
                      return (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', gap: '6px', padding: '7px',
                          background: active ? 'var(--red-dim)' : 'var(--bg-elevated)',
                          border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius)', transition: 'all 0.3s ease',
                        }}>
                          <span style={{ fontSize: '11px' }}>{icon}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: active ? 'var(--red)' : 'var(--text-dim)', flex: 1 }}>{label}</span>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: active ? 'var(--red)' : 'var(--text-dim)', animation: active ? 'pulse-red 1s ease-in-out infinite' : 'none' }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Emergency history */}
          <Card accent={guard.emergencyEvents.length > 0 ? 'red' : 'none'}>
            <CardLabel style={{ marginBottom: '12px' }}>Emergency History</CardLabel>
            {guard.emergencyEvents.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)' }}>
                ✅ No emergencies recorded
              </div>
            ) : guard.emergencyEvents.slice(0, 5).map(evt => (
              <div key={evt.txHash} style={{ padding: '10px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <Badge variant="red">Emergency</Badge>
                  <a href={explorerTx(evt.txHash)} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--blue)' }}>tx ↗</a>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Protocol: {evt.protocol.slice(0, 12)}... · Block #{evt.blockNumber}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </PageContent>
  );
}