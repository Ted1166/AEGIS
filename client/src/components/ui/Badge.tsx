import React from 'react';

type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  style?: React.CSSProperties;
}

const variantMap: Record<BadgeVariant, { color: string; bg: string; border: string }> = {
  green:   { color: 'var(--green)',   bg: 'var(--green-dim)',  border: 'var(--green)' },
  amber:   { color: 'var(--amber)',   bg: 'var(--amber-dim)',  border: 'var(--amber)' },
  red:     { color: 'var(--red)',     bg: 'var(--red-dim)',    border: 'var(--red)' },
  blue:    { color: 'var(--blue)',    bg: 'var(--blue-dim)',   border: 'var(--blue)' },
  neutral: { color: 'var(--text-secondary)', bg: 'transparent', border: 'var(--border)' },
};

export function Badge({ variant = 'neutral', children, dot = false, pulse = false, style }: BadgeProps) {
  const v = variantMap[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: v.color,
        background: v.bg,
        border: `1px solid ${v.border}`,
        borderRadius: '2px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: v.color,
            flexShrink: 0,
            animation: pulse ? 'pulse-green 1.5s ease-in-out infinite' : 'none',
          }}
        />
      )}
      {children}
    </span>
  );
}

// Tier badge specifically for yield quality scores
export function TierBadge({ tier }: { tier: number | string }) {
  const t = Number(tier);
  if (t === 2) return <Badge variant="green" dot>Sustainable</Badge>;
  if (t === 1) return <Badge variant="amber" dot>Mixed</Badge>;
  return <Badge variant="red" dot>Risky</Badge>;
}