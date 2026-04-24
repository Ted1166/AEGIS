export function formatUsdc(raw: bigint | undefined, decimals = 2): string {
  if (raw === undefined || raw === null) return '—';
  const n = Number(raw) / 1e6;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatUsdcDollar(raw: bigint | undefined): string {
  if (raw === undefined || raw === null) return '$—';
  return `$${formatUsdc(raw)}`;
}

export function formatBps(bps: bigint | number | undefined): string {
  if (bps === undefined || bps === null) return '—';
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

export function formatShares(raw: bigint | undefined): string {
  if (raw === undefined || raw === null) return '—';
  return (Number(raw) / 1e6).toFixed(6);
}

export function parseUsdc(amount: string): bigint {
  const n = parseFloat(amount);
  if (isNaN(n)) return 0n;
  return BigInt(Math.round(n * 1e6));
}

export function parseShares(amount: string): bigint {
  const n = parseFloat(amount);
  if (isNaN(n)) return 0n;
  return BigInt(Math.round(n * 1e6));
}

export function shortAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function tierLabel(tier: number): string {
  return ['Risky', 'Mixed', 'Sustainable'][tier] ?? 'Unknown';
}

export function tierColor(tier: number): string {
  return ['var(--red)', 'var(--amber)', 'var(--green)'][tier] ?? 'var(--text-dim)';
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'var(--green)';
  if (score >= 40) return 'var(--amber)';
  return 'var(--red)';
}

export function timeAgo(timestampSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestampSeconds;
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function parseError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const e = err as any;
  if (e?.reason) return e.reason;
  if (e?.shortMessage) return e.shortMessage;
  if (e?.message) {
    const msg: string = e.message;
    if (msg.includes('user rejected')) return 'Transaction rejected';
    if (msg.includes('insufficient funds')) return 'Insufficient funds for gas';
    if (msg.includes('1010')) return 'Invalid transaction — check gas wallet balance';
    return msg.slice(0, 120);
  }
  return 'Transaction failed';
}