import React, { useState, useMemo } from 'react';
import { PageContent, PageHeader } from '../components/layout/Layout';
import { DepositForm } from '../components/vault/DepositForm';
import { WithdrawForm } from '../components/vault/WithdrawForm';
import { Card, CardLabel, CardValue } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useVault } from '../hooks/useVault';
import { useOracle } from '../hooks/useOracle';
import { formatUsdc, formatBps, tierLabel, tierColor, scoreColor, parseError } from '../lib/utils';
import { explorerTx } from '../config/chain';
import type { ethers } from 'ethers';

interface VaultPageProps {
  address?: string;
  signer?: ethers.JsonRpcSigner;
}

type Tab = 'deposit' | 'withdraw';

export function VaultPage({ address, signer }: VaultPageProps) {
  const [tab, setTab]     = useState<Tab>('deposit');
  const [txHash, setTxHash] = useState<string>();
  const [txError, setTxError] = useState<string>();

  const vault  = useVault(address, signer);
  const oracle = useOracle(vault.sources.map(s => s.address));

  const enrichedSources = useMemo(() =>
    vault.sources.map(src => {
      const score = oracle.getScore(src.address);
      return { ...src, scoreEntry: score };
    }),
    [vault.sources, oracle.scores]
  );

  async function handleDeposit(amount: string) {
    setTxHash(undefined);
    setTxError(undefined);
    try {
      await vault.deposit(amount);
      setTxHash(vault.txHash);
    } catch (err) {
      setTxError(parseError(err));
    }
  }

  async function handleWithdraw(shares: string) {
    setTxHash(undefined);
    setTxError(undefined);
    try {
      await vault.withdraw(shares);
      setTxHash(vault.txHash);
    } catch (err) {
      setTxError(parseError(err));
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Vault"
        subtitle="Deposit USDC · Earn yield · Withdraw anytime"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left — forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Tab switcher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
              background: 'var(--bg-elevated)',
              padding: '4px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            {(['deposit', 'withdraw'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '10px',
                  background: tab === t ? 'var(--bg-card)' : 'transparent',
                  border: tab === t ? '1px solid var(--border-bright)' : '1px solid transparent',
                  borderRadius: 'var(--radius)',
                  color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Form */}
          {tab === 'deposit' ? (
            <DepositForm
              usdcBalance={vault.usdcBalance}
              onDeposit={handleDeposit}
              loading={vault.depositing}
              connected={!!address}
            />
          ) : (
            <WithdrawForm
              userShares={vault.userShares}
              userBalance={vault.userBalance}
              onWithdraw={handleWithdraw}
              loading={vault.withdrawing}
              connected={!!address}
            />
          )}

          {/* Tx feedback */}
          {txHash && (
            <div
              style={{
                padding: '12px',
                background: 'var(--green-dim)',
                border: '1px solid var(--green)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)' }}>
                ✅ Transaction confirmed
              </span>
              <a
                href={explorerTx(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--blue)' }}
              >
                View ↗
              </a>
            </div>
          )}

          {txError && (
            <div
              style={{
                padding: '12px',
                background: 'var(--red-dim)',
                border: '1px solid var(--red)',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--red)',
              }}
            >
              ❌ {txError}
            </div>
          )}

          {/* Position summary */}
          {address && (
            <Card>
              <CardLabel style={{ marginBottom: '12px' }}>Your Position</CardLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Balance',       value: `$${formatUsdc(vault.userBalance)} USDC` },
                  { label: 'Shares',        value: `${formatUsdc(vault.userShares, 6)}` },
                  { label: 'Wallet USDC',   value: `$${formatUsdc(vault.usdcBalance)}` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
                      {label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right — yield source breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <CardLabel style={{ marginBottom: '16px' }}>Where Your Yield Comes From</CardLabel>

            {vault.loading ? (
              <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
                Loading sources...
              </div>
            ) : enrichedSources.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
                No yield sources registered
              </div>
            ) : (
              enrichedSources.map((src) => {
                const score = src.scoreEntry;
                const scoreNum = score ? Number(score.score) : 0;
                return (
                  <div
                    key={src.address}
                    style={{
                      padding: '16px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      marginBottom: '12px',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>{src.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                          {src.address.slice(0, 10)}...{src.address.slice(-8)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '18px', color: 'var(--green)' }}>
                          {src.apy}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>APY</div>
                      </div>
                    </div>

                    {/* Score + stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      {[
                        { label: 'Quality Score', value: score ? `${scoreNum}/100` : '—', color: scoreColor(scoreNum) },
                        { label: 'Real Yield',    value: score ? formatBps(score.realYieldBps) : '—', color: 'var(--text-primary)' },
                        { label: 'Emissions',     value: score ? formatBps(score.emissionsYieldBps) : '—', color: 'var(--amber)' },
                        { label: 'TVL',           value: score ? `$${formatUsdc(score.tvl)}` : '—', color: 'var(--text-primary)' },
                        { label: 'Tier',          value: score ? tierLabel(score.tier) : '—', color: tierColor(score?.tier ?? 0) },
                        { label: 'Score Fresh',   value: score ? (score.fresh ? 'Yes' : 'Stale') : '—', color: score?.fresh ? 'var(--green)' : 'var(--amber)' },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          style={{
                            padding: '8px',
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {label}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </Card>

          {/* How it works */}
          <Card>
            <CardLabel style={{ marginBottom: '12px' }}>How Aegis Works</CardLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { icon: '🛡️', title: 'Sentinel watches every block', desc: 'AI monitors TVL, oracle prices, flash loan spikes, and access control events in real time.' },
                { icon: '🧠', title: 'Scorer rates yield quality', desc: 'Each protocol gets a quality score based on real yield vs emissions, TVL depth, and APY stability.' },
                { icon: '🚨', title: 'Auto-emergency protection', desc: 'If risk thresholds breach, funds are automatically moved to the treasury safe harbor.' },
                { icon: '📋', title: 'Weekly AI advisor report', desc: 'Plain-English summary of your earnings, rebalances, and risk outlook generated by Claude.' },
              ].map(({ icon, title, desc }) => (
                <div
                  key={title}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '10px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>{title}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContent>
  );
}