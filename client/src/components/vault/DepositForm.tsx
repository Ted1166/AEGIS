import React, { useState } from 'react';
import { Card, CardLabel } from '../ui/Card';
import { Button } from '../ui/Button';

interface DepositFormProps {
  usdcBalance?: bigint;
  onDeposit: (amount: string) => Promise<void>;
  loading?: boolean;
  connected?: boolean;
  onNavigateToFaucet?: () => void;
}

function fmt(raw?: bigint) {
  if (raw === undefined) return '0.00';
  return (Number(raw) / 1e6).toFixed(2);
}

const QUICK_AMOUNTS = ['100', '500', '1000', '5000'];

export function DepositForm({ usdcBalance, onDeposit, loading, connected, onNavigateToFaucet }: DepositFormProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const maxBalance = usdcBalance ? Number(usdcBalance) / 1e6 : 0;
  const hasNoUsdc = connected && usdcBalance !== undefined && usdcBalance === 0n;

  function handleMax() {
    setAmount(maxBalance.toFixed(2));
    setError('');
  }

  function validate(val: string) {
    const n = parseFloat(val);
    if (!val || isNaN(n)) return 'Enter an amount';
    if (n <= 0) return 'Amount must be greater than 0';
    if (n > maxBalance) return 'Insufficient USDC balance';
    return '';
  }

  async function handleSubmit() {
    const err = validate(amount);
    if (err) { setError(err); return; }
    setError('');
    try {
      await onDeposit(amount);
      setAmount('');
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Transaction failed';
      if (msg.includes('insufficient funds') || msg.includes('1010')) {
        setError('Insufficient PAS for gas. Visit the Faucet tab.');
      } else {
        setError(msg.slice(0, 100));
      }
    }
  }

  return (
    <Card>
      <CardLabel style={{ marginBottom: '16px' }}>Deposit USDC</CardLabel>

      {/* No USDC banner */}
      {hasNoUsdc && (
        <div style={{
          padding: '12px', marginBottom: '16px',
          background: 'var(--amber-dim)', border: '1px solid var(--amber)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)', marginBottom: '8px', fontWeight: 700 }}>
            ⚠️ No USDC in wallet
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
            You need MockUSDC to deposit. Also make sure you have PAS tokens for gas.
          </div>
          <button
            onClick={onNavigateToFaucet}
            style={{
              width: '100%', padding: '8px',
              background: 'var(--amber-dim)', border: '1px solid var(--amber)',
              borderRadius: 'var(--radius)', color: 'var(--amber)',
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Go to Faucet →
          </button>
        </div>
      )}

      {/* Balance row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
          Wallet balance
        </span>
        <button
          onClick={handleMax}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {fmt(usdcBalance)} USDC — MAX
        </button>
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg-elevated)',
        border: `1px solid ${error ? 'var(--red)' : 'var(--border-bright)'}`,
        borderRadius: 'var(--radius)', padding: '0 14px', marginBottom: '8px',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-dim)', marginRight: '8px' }}>$</span>
        <input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={e => { setAmount(e.target.value); setError(''); }}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
            fontSize: '20px', fontWeight: 700, padding: '14px 0',
          }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>USDC</span>
      </div>

      {error && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', marginBottom: '10px' }}>
          {error}
          {error.includes('Faucet') && (
            <button
              onClick={onNavigateToFaucet}
              style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'var(--blue)', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Go to Faucet
            </button>
          )}
        </div>
      )}

      {/* Quick amounts */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {QUICK_AMOUNTS.map(q => (
          <button
            key={q}
            onClick={() => { setAmount(q); setError(''); }}
            style={{
              flex: 1, padding: '6px',
              background: amount === q ? 'var(--green-dim)' : 'var(--bg-elevated)',
              border: `1px solid ${amount === q ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              color: amount === q ? 'var(--green)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            ${q}
          </button>
        ))}
      </div>

      {/* Info row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>You receive</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
          ~{amount ? parseFloat(amount).toFixed(2) : '0.00'} vault shares
        </span>
      </div>

      <Button
        variant="primary" size="lg" loading={loading}
        disabled={!connected || !amount || hasNoUsdc}
        onClick={handleSubmit}
        style={{ width: '100%' }}
      >
        {!connected ? 'Connect Wallet' : hasNoUsdc ? 'Get USDC First' : 'Deposit'}
      </Button>
    </Card>
  );
}