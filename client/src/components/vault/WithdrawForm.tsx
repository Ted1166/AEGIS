import React, { useState } from 'react';
import { Card, CardLabel } from '../ui/Card';
import { Button } from '../ui/Button';

interface WithdrawFormProps {
  userShares?: bigint;
  userBalance?: bigint;
  onWithdraw: (shares: string) => Promise<void>;
  loading?: boolean;
  connected?: boolean;
}

function fmt(raw?: bigint) {
  if (raw === undefined) return '0.00';
  return (Number(raw) / 1e6).toFixed(2);
}

export function WithdrawForm({ userShares, userBalance, onWithdraw, loading, connected }: WithdrawFormProps) {
  const [shares, setShares] = useState('');
  const [error, setError] = useState('');

  const maxShares = userShares ? Number(userShares) / 1e6 : 0;
  const estimatedUsdc = shares ? parseFloat(shares).toFixed(2) : '0.00';

  function handleMax() {
    setShares(maxShares.toFixed(6));
    setError('');
  }

  function validate(val: string) {
    const n = parseFloat(val);
    if (!val || isNaN(n)) return 'Enter share amount';
    if (n <= 0) return 'Amount must be greater than 0';
    if (n > maxShares) return 'Insufficient shares';
    return '';
  }

  async function handleSubmit() {
    const err = validate(shares);
    if (err) { setError(err); return; }
    setError('');
    try {
      await onWithdraw(shares);
      setShares('');
    } catch (e: any) {
      setError(e?.message || 'Transaction failed');
    }
  }

  return (
    <Card>
      <CardLabel style={{ marginBottom: '16px' }}>Withdraw</CardLabel>

      {/* Balance row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
          Available shares
        </span>
        <button
          onClick={handleMax}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--green)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {fmt(userShares)} shares — MAX
        </button>
      </div>

      {/* Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-elevated)',
          border: `1px solid ${error ? 'var(--red)' : 'var(--border-bright)'}`,
          borderRadius: 'var(--radius)',
          padding: '0 14px',
          marginBottom: '8px',
        }}
      >
        <input
          type="number"
          placeholder="0.000000"
          value={shares}
          onChange={e => { setShares(e.target.value); setError(''); }}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '20px',
            fontWeight: 700,
            padding: '14px 0',
          }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>SHARES</span>
      </div>

      {error && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      {/* Info row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius)',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
          Estimated receive
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
          ~${estimatedUsdc} USDC
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius)',
          marginBottom: '16px',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>
          Current balance
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
          ${fmt(userBalance)} USDC
        </span>
      </div>

      <Button
        variant="secondary"
        size="lg"
        loading={loading}
        disabled={!connected || !shares || maxShares === 0}
        onClick={handleSubmit}
        style={{ width: '100%' }}
      >
        {connected ? 'Withdraw' : 'Connect Wallet'}
      </Button>
    </Card>
  );
}