import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';

const STEPS = [
  {
    icon: '💰',
    title: 'Get PAS Gas Tokens',
    desc: 'You need PAS tokens to pay for transactions on Paseo Asset Hub. Visit the Polkadot faucet and select Passet Hub to claim free testnet tokens.',
    action: 'Open Faucet',
    link: 'https://faucet.polkadot.io/?parachain=1111',
  },
  {
    icon: '🪙',
    title: 'Mint Mock USDC',
    desc: 'Aegis uses MockUSDC as the deposit token. Head to the Faucet tab inside the app to mint free USDC directly to your wallet.',
    action: null,
  },
  {
    icon: '🛡️',
    title: 'Deposit & Earn',
    desc: 'Go to the Vault tab, choose an amount, and deposit. Your USDC is deployed across AI-scored yield sources. You receive vault shares representing your position.',
    action: null,
  },
  {
    icon: '🧠',
    title: 'AI Monitors 24/7',
    desc: 'The Sentinel watches every block for risk signals — TVL drainage, oracle manipulation, flash loans, and access control events. If a protocol breaches thresholds, funds are auto-moved to safety.',
    action: null,
  },
  {
    icon: '📊',
    title: 'Track Everything',
    desc: 'The Analytics tab shows your deposit history, yield quality scores, live risk signals, and emergency events — all pulled directly from on-chain data.',
    action: null,
  },
  {
    icon: '💸',
    title: 'Withdraw Anytime',
    desc: 'Redeem your vault shares for USDC at any time from the Vault tab. No lockups, no penalties.',
    action: null,
  },
];

interface OnboardingModalProps {
  onClose: () => void;
  onNavigate: (page: string) => void;
}

export function OnboardingModal({ onClose, onNavigate }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '480px',
        padding: '32px', position: 'relative',
        animation: 'fade-in 0.2s ease forwards',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', fontSize: '18px', lineHeight: 1,
          }}
        >×</button>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                height: '3px', flex: 1, borderRadius: '2px', cursor: 'pointer',
                background: i <= step ? 'var(--green)' : 'var(--border)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{current.icon}</div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: '20px', letterSpacing: '-0.02em',
            color: 'var(--text-primary)', marginBottom: '12px',
          }}>
            {current.title}
          </h2>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '12px',
            color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            {current.desc}
          </p>
        </div>

        {/* Step counter */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--text-dim)', textAlign: 'center', marginBottom: '20px',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Step {step + 1} of {STEPS.length}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {step > 0 && (
            <Button variant="ghost" size="md" onClick={() => setStep(s => s - 1)} style={{ flex: 1 }}>
              Back
            </Button>
          )}

          {current.link && (
            <a href={current.link} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
              <Button variant="secondary" size="md" style={{ width: '100%' }}>
                {current.action} ↗
              </Button>
            </a>
          )}

          {isLast ? (
            <Button
              variant="primary" size="md"
              style={{ flex: 1 }}
              onClick={() => { onClose(); onNavigate('faucet'); }}
            >
              Get Started →
            </Button>
          ) : (
            <Button variant="primary" size="md" style={{ flex: 1 }} onClick={() => setStep(s => s + 1)}>
              Next →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}