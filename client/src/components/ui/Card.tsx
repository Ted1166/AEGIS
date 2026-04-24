import React from 'react';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  accent?: 'green' | 'amber' | 'red' | 'blue' | 'none';
  onClick?: () => void;
}

export function Card({ children, style, className, accent = 'none', onClick }: CardProps) {
  const accentColor = {
    green: 'var(--green)',
    amber: 'var(--amber)',
    red: 'var(--red)',
    blue: 'var(--blue)',
    none: 'transparent',
  }[accent];

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease',
        ...(accent !== 'none' && {
          borderTopColor: accentColor,
          borderTopWidth: '2px',
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface CardLabelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function CardLabel({ children, style }: CardLabelProps) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-dim)',
        marginBottom: '8px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface CardValueProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function CardValue({ children, style, size = 'lg' }: CardValueProps) {
  const fontSize = { sm: '16px', md: '20px', lg: '28px', xl: '36px' }[size];
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize,
        fontWeight: 700,
        color: 'var(--text-primary)',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {children}
    </div>
  );
}