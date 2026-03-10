import React, { useMemo } from 'react';
import { PageContent, PageHeader } from '../components/layout/Layout';
import { Card, CardLabel, CardValue } from '../components/ui/Card';
import { Badge, TierBadge } from '../components/ui/Badge';
import { useVault } from '../hooks/useVault';
import { useOracle } from '../hooks/useOracle';
import { useGuard } from '../hooks/useGuard';
import { formatUsdc, formatBps, scoreColor, tierLabel, timeAgo } from '../lib/utils';
import { explorerTx, explorerAddress } from '../config/chain';
import type { ethers } from 'ethers';

interface AnalyticsProps {
  address?: string;
  signer?: ethers.JsonRpcSigner;
}

function StatCell({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '3px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Analytics({ address, signer }: AnalyticsProps) {
  const vault  = useVault(address, signer);
  const oracle = useOracle(vault.sources.map(s => s.address));
  const guard  = useGuard(vault.sources.map(s => ({ address: s.address, name: s.name })), signer);

  const enrichedSources = useMemo(() =>
    vault.sources.map(src => ({
      ...src,
      scoreEntry: oracle.getScore(src.address),
      riskState:  guard.protocols.find(p => p.address.toLowerCase() === src.address.toLowerCase()),
    })),
    [vault.sources, oracle.scores, guard.protocols]
  );

  const avgScore = enrichedSources.length
    ? Math.round(enrichedSources.reduce((a, s) => a + (s.scoreEntry ? Number(s.scoreEntry.score) : 0), 0) / enrichedSources.length)
    : 0;

  const totalSignals = guard.protocols.reduce((a, p) => a + p.signals.totalActive, 0);

  return (
    <PageContent>
      <PageHeader
        title="Analytics"
        subtitle="Yield quality scores · Signal history · Risk state"
        right={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Badge variant="neutral">
              Block #{guard.lastBlock?.toLocaleString() ?? '—'}
            </Badge>
          </div>
        }
      />

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCell label="Vault TVL"       value={`$${formatUsdc(vault.totalAssets)}`}    sub="USDC" color="var(--green)" />
        <StatCell label="Yield Sources"   value={`${vault.sources.length}`}              sub="active protocols" />
        <StatCell label="Avg Score"       value={`${avgScore}/100`}                      color={scoreColor(avgScore)} sub={tierLabel(avgScore >= 70 ? 2 : avgScore >= 40 ? 1 : 0)} />
        <StatCell label="Active Signals"  value={`${totalSignals}`}                      color={totalSignals > 0 ? 'var(--amber)' : 'var(--green)'} sub="across all protocols" />
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Yield Quality Scores */}
        <Card>
          <CardLabel style={{ marginBottom: '16px' }}>Yield Quality Scores</CardLabel>
          {enrichedSources.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
              No sources tracked
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {enrichedSources.map(src => {
                const score = src.scoreEntry;
                const scoreNum = score ? Number(score.score) : 0;
                const color = scoreColor(scoreNum);
                return (
                  <div key={src.address} style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '3px' }}>{src.name}</div>
                        <a
                          href={explorerAddress(src.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--blue)', textDecoration: 'none' }}
                        >
                          {src.address.slice(0, 10)}...↗
                        </a>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {score && <TierBadge tier={score.tier} />}
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '16px', color }}>
                          {scoreNum}
                        </span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${scoreNum}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {[
                        { label: 'Total APY',  value: score ? formatBps(score.totalAPYBps) : '—' },
                        { label: 'Real Yield', value: score ? formatBps(score.realYieldBps) : '—' },
                        { label: 'Emissions',  value: score ? formatBps(score.emissionsYieldBps) : '—' },
                        { label: 'TVL',        value: score ? `$${formatUsdc(score.tvl)}` : '—' },
                        { label: 'Updated',    value: score && score.updatedAt ? timeAgo(score.updatedAt) : '—' },
                        { label: 'Fresh',      value: score ? (score.fresh ? 'Yes' : 'Stale') : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ padding: '6px', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', marginBottom: '3px', textTransform: 'uppercase' }}>{label}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Signal Monitor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <CardLabel style={{ marginBottom: '16px' }}>Live Signal State</CardLabel>
            {guard.protocols.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
                No protocols monitored
              </div>
            ) : (
              guard.protocols.map(protocol => {
                const SIGNALS = [
                  { key: 'tvlDrainage',     label: 'TVL Drainage',    icon: '📉' },
                  { key: 'oracleDeviation', label: 'Oracle Dev',      icon: '📊' },
                  { key: 'flashLoan',       label: 'Flash Loan',      icon: '⚡' },
                  { key: 'accessControl',   label: 'Access Control',  icon: '🔐' },
                ] as const;

                return (
                  <div key={protocol.address} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{protocol.name}</span>
                      {protocol.inEmergency
                        ? <Badge variant="red" dot pulse>Emergency</Badge>
                        : protocol.signals.totalActive > 0
                        ? <Badge variant="amber" dot>{protocol.signals.totalActive} active</Badge>
                        : <Badge variant="green" dot>Clear</Badge>
                      }
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {SIGNALS.map(({ key, label, icon }) => {
                        const active = protocol.signals[key as keyof typeof protocol.signals] === true;
                        return (
                          <div
                            key={key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px',
                              background: active ? 'var(--red-dim)' : 'var(--bg-elevated)',
                              border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                              borderRadius: 'var(--radius)',
                              transition: 'all 0.3s ease',
                            }}
                          >
                            <span style={{ fontSize: '12px' }}>{icon}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: active ? 'var(--red)' : 'var(--text-dim)', flex: 1 }}>
                              {label}
                            </span>
                            <div style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              background: active ? 'var(--red)' : 'var(--text-dim)',
                              animation: active ? 'pulse-red 1s ease-in-out infinite' : 'none',
                            }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </Card>

          {/* Emergency history */}
          <Card accent={guard.emergencyEvents.length > 0 ? 'red' : 'none'}>
            <CardLabel style={{ marginBottom: '12px' }}>Emergency Event History</CardLabel>
            {guard.emergencyEvents.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--green)',
              }}>
                ✅ No emergency events recorded
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {guard.emergencyEvents.slice(0, 5).map(evt => (
                  <div
                    key={evt.txHash}
                    style={{
                      padding: '10px',
                      background: 'var(--red-dim)',
                      border: '1px solid var(--red)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Badge variant="red">Emergency Triggered</Badge>
                      <a href={explorerTx(evt.txHash)} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--blue)' }}>
                        tx ↗
                      </a>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px' }}>
                      Protocol: {evt.protocol.slice(0, 12)}...
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                      Bounty paid: ${formatUsdc(evt.bountyPaid)} USDC · Block #{evt.blockNumber}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageContent>
  );
}