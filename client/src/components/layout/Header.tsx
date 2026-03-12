import React from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface HeaderProps {
  address?: string;
  balance?: string;
  chainId?: number;
  onConnect: () => void;
  onDisconnect: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vault',     label: 'Vault' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'faucet',    label: 'Faucet' },
];

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Header({
  address, balance, chainId, onConnect, onDisconnect, currentPage, onNavigate,
}: HeaderProps) {
  const isPaseo = chainId === 420420417;

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10, 11, 13, 0.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px', height: '56px',
      display: 'flex', alignItems: 'center', gap: '32px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" width="26" height="29" style={{ flexShrink: 0 }}>
          <defs>
            <radialGradient id="hCG" cx="50%" cy="48%" r="35%">
              <stop offset="0%" stopColor="#00ff87" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#00ff87" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="hSF" x1="0%" y1="0%" x2="60%" y2="100%">
              <stop offset="0%" stopColor="#1a2035"/>
              <stop offset="100%" stopColor="#0a0d14"/>
            </linearGradient>
            <linearGradient id="hSE" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2a3a50"/>
              <stop offset="50%" stopColor="#00ff87"/>
              <stop offset="100%" stopColor="#1a2a3a"/>
            </linearGradient>
            <filter id="hGG" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path d="M100 12 L178 42 L178 108 Q178 162 100 208 Q22 162 22 108 L22 42 Z" fill="url(#hSF)"/>
          <circle cx="100" cy="108" r="30" fill="url(#hCG)">
            <animate attributeName="r" values="28;32;28" dur="2.8s" repeatCount="indefinite" calcMode="ease"/>
            <animate attributeName="opacity" values="0.85;1;0.85" dur="2.8s" repeatCount="indefinite"/>
          </circle>
          <g filter="url(#hGG)">
            <line x1="86" y1="126" x2="96" y2="92" stroke="#00ff87" strokeWidth="4.5" strokeLinecap="round"/>
            <line x1="114" y1="126" x2="104" y2="92" stroke="#00ff87" strokeWidth="4.5" strokeLinecap="round"/>
            <line x1="89.5" y1="113" x2="110.5" y2="113" stroke="#00ff87" strokeWidth="3.5" strokeLinecap="round"/>
            <circle cx="100" cy="87" r="3" fill="#00ff87">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite"/>
            </circle>
          </g>
          <path d="M100 12 L178 42 L178 108 Q178 162 100 208 Q22 162 22 108 L22 42 Z" fill="none" stroke="url(#hSE)" strokeWidth="2"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          AEGIS
        </span>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: '2px', flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              background: currentPage === item.id ? 'var(--bg-elevated)' : 'transparent',
              border: 'none',
              color: currentPage === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '12px',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '6px 14px', borderRadius: 'var(--radius)',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {address ? (
          <>
            {!isPaseo && <Badge variant="amber">Wrong Network</Badge>}
            {balance && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {balance} PAS
              </span>
            )}
            <button
              onClick={onDisconnect}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius)', padding: '6px 12px',
                cursor: 'pointer', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: '11px',
              }}
            >
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: isPaseo ? 'var(--green)' : 'var(--amber)',
                animation: isPaseo ? 'pulse-green 2s ease-in-out infinite' : 'none',
              }} />
              {short(address)}
            </button>
          </>
        ) : (
          <Button variant="primary" size="sm" onClick={onConnect}>
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  );
}