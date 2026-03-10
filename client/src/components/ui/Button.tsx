import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const styles: Record<string, React.CSSProperties> = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    borderRadius: 'var(--radius)',
    whiteSpace: 'nowrap',
    position: 'relative',
    overflow: 'hidden',
  },
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--green)',
    borderColor: 'var(--green)',
    color: '#0a0b0d',
  },
  secondary: {
    background: 'transparent',
    borderColor: 'var(--border-bright)',
    color: 'var(--text-primary)',
  },
  danger: {
    background: 'var(--red-dim)',
    borderColor: 'var(--red)',
    color: 'var(--red)',
  },
  ghost: {
    background: 'transparent',
    borderColor: 'transparent',
    color: 'var(--text-secondary)',
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '11px' },
  md: { padding: '10px 20px', fontSize: '12px' },
  lg: { padding: '14px 28px', fontSize: '13px' },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{
        ...styles.base,
        ...variantStyles[variant],
        ...sizeStyles[size],
        opacity: isDisabled ? 0.4 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {loading && (
        <span
          style={{
            width: '12px',
            height: '12px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </button>
  );
}