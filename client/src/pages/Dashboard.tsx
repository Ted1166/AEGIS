import React, { useMemo } from 'react';
import { PageContent, PageHeader } from '../components/layout/Layout';
import { VaultStats } from '../components/vault/VaultStats';
import { RiskPanel } from '../components/vault/RiskPanel';
import { Card, CardLabel, CardValue } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useVault } from '../hooks/useVault';
import { useOracle } from '../hooks/useOracle';
import { useGuard } from '../hooks/useGuard';
import { formatUsdc, formatBps, timeAgo } from '../lib/utils';
import { explorerAddress, explorerTx } from '../config/chain';
import { ADDRESSES } from '../config/contracts';
import type { ethers } from 'ethers';

interface DashboardProps {
  address?: string;
  signer?: ethers.JsonRpcSigner;
  onNavigate: (page: string) => void;
}

export function Dashboard({ address, signer, onNavigate }: DashboardProps) {
  const vault  = useVault(address, signer);
  const oracle = useOracle(vault.sources.map(s => s.address));
  const guard  = useGuard(vault.sources.map(s => ({ address: s.address, name: s.name })), signer);

  const enrichedSources = useMemo(() =>
    vault.sources.map(src => {
      const score = oracle.getScore(src.address);
      return {
        ...src,
        score:       score ? Number(score.score) : 0,
        tier:        score ? score.tier : 0,
        realYield:   score ? formatBps(score.realYieldBps) : '—',
        inEmergency: guard.protocols.find(p =>
          p.address.toLowerCase() === src.address.toLowerCase()
        )?.inEmergency ?? false,
      };
    }),
    [vault.sources, oracle.scores, guard.protocols]
  );

  return (
    <PageContent>
      <PageHeader
        title="Dashboard"
        subtitle={`Initia EVM · aegis-1 · Block #${guard.lastBlock?.toLocaleString() ?? '—'}`}
        right={
          guard.anyEmergency
            ? <Badge variant="red" dot pulse>Emergency Active</Badge>
            : <Badge variant="green" dot pulse>System Healthy</Badge>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <VaultStats
            totalAssets={vault.totalAssets}
            userBalance={vault.userBalance}
            userShares={vault.userShares}
            sources={enrichedSources}
            loading={vault.loading}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => onNavigate('vault')}
              style={{
                padding: '20px',
                background: 'var(--green-dim)',
                border: '1px solid var(--green)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>💰</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--green)', marginBottom: '4px' }}>
                Deposit USDC
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                Earn yield across AI-scored sources
              </div>
            </button>

            <button
              onClick={() => onNavigate('analytics')}
              style={{
                padding: '20px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>📊</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                View Analytics
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                Signal history, scores, events
              </div>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <RiskPanel
            protocols={guard.protocols}
            loading={guard.loading}
            lastBlock={guard.lastBlock}
            sentinelActive={true}
          />

          {guard.emergencyEvents.length > 0 && (
            <Card accent="red">
              <CardLabel style={{ marginBottom: '12px' }}>Recent Emergency Events</CardLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {guard.emergencyEvents.slice(0, 3).map(evt => (
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
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', fontWeight: 700 }}>
                        🚨 EMERGENCY
                      </span>
                      <a
                        href={explorerTx(evt.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--blue)' }}
                      >
                        tx ↗
                      </a>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                      Protocol: {evt.protocol.slice(0, 10)}...
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                      Bounty: ${formatUsdc(evt.bountyPaid)} USDC
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardLabel style={{ marginBottom: '12px' }}>Deployed Contracts</CardLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { label: 'Vault',    addr: ADDRESSES.vault },
                { label: 'Guard',    addr: ADDRESSES.guard },
                { label: 'Oracle',   addr: ADDRESSES.oracle },
                { label: 'Treasury', addr: ADDRESSES.treasury },
              ].map(({ label, addr }) => (
                <div
                  key={addr}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                    {label}
                  </span>
                  <a
                    href={explorerAddress(addr)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--blue)', textDecoration: 'none' }}
                  >
                    {addr.slice(0, 8)}...{addr.slice(-6)} ↗
                  </a>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContent>
  );
}