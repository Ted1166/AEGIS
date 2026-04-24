import React from 'react';
import { Card, CardLabel, CardValue } from '../ui/Card';
import { Badge, TierBadge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';

interface YieldSource {
  address: string;
  name: string;
  apy: string;
  tvl: bigint;
  score: number;
  tier: number;
  realYield: string;
  inEmergency: boolean;
}

interface VaultStatsProps {
  totalAssets?: bigint;
  userBalance?: bigint;
  userShares?: bigint;
  sources?: YieldSource[];
  loading?: boolean;
}

function fmt(raw?: bigint, decimals = 6) {
  if (raw === undefined) return '—';
  const n = Number(raw) / 10 ** decimals;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          flex: 1,
          height: '3px',
          background: 'var(--border)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: color,
            borderRadius: '2px',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color,
          minWidth: '32px',
          textAlign: 'right',
        }}
      >
        {score}/100
      </span>
    </div>
  );
}

export function VaultStats({ totalAssets, userBalance, userShares, sources = [], loading }: VaultStatsProps) {
  const avgScore = sources.length
    ? Math.round(sources.reduce((a, s) => a + s.score, 0) / sources.length)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}
      >
        <Card accent="green">
          <CardLabel>Vault TVL</CardLabel>
          {loading ? <Spinner size={20} /> : (
            <CardValue size="xl">
              ${fmt(totalAssets)}
            </CardValue>
          )}
          <div style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
            USDC
          </div>
        </Card>

        <Card>
          <CardLabel>Your Balance</CardLabel>
          {loading ? <Spinner size={20} /> : (
            <CardValue size="xl">
              ${fmt(userBalance)}
            </CardValue>
          )}
          <div style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
            {fmt(userShares)} shares
          </div>
        </Card>

        <Card accent={avgScore !== null ? (avgScore >= 70 ? 'green' : avgScore >= 40 ? 'amber' : 'red') : 'none'}>
          <CardLabel>Avg Yield Score</CardLabel>
          {loading ? <Spinner size={20} /> : (
            <>
              <CardValue
                size="xl"
                style={{
                  color: avgScore !== null
                    ? avgScore >= 70 ? 'var(--green)' : avgScore >= 40 ? 'var(--amber)' : 'var(--red)'
                    : 'var(--text-dim)',
                }}
              >
                {avgScore !== null ? `${avgScore}` : '—'}
              </CardValue>
              <div style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                /100 · {sources.length} source{sources.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Yield Sources */}
      <Card>
        <CardLabel style={{ marginBottom: '16px' }}>Yield Sources</CardLabel>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            <Spinner />
          </div>
        ) : sources.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-dim)',
            }}
          >
            No yield sources registered
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {sources.map((src, i) => (
              <div
                key={src.address}
                style={{
                  padding: '14px 0',
                  borderBottom: i < sources.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 120px auto',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                {/* Name + address */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{src.name}</span>
                    {src.inEmergency && <Badge variant="red" pulse dot>Emergency</Badge>}
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--text-dim)',
                    }}
                  >
                    {src.address.slice(0, 10)}...{src.address.slice(-6)}
                  </span>
                </div>

                {/* APY */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--green)' }}>
                    {src.apy}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                    APY
                  </div>
                </div>

                {/* Score bar */}
                <div>
                  <ScoreBar score={src.score} />
                </div>

                {/* Tier */}
                <TierBadge tier={src.tier} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}