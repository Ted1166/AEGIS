import React from 'react';
import { Card, CardLabel } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';

interface SignalState {
  tvlDrainage: boolean;
  oracleDeviation: boolean;
  flashLoan: boolean;
  accessControl: boolean;
  totalActive: number;
}

interface ProtocolRisk {
  address: string;
  name: string;
  signals?: SignalState;
  inEmergency: boolean;
}

interface RiskPanelProps {
  protocols?: ProtocolRisk[];
  loading?: boolean;
  lastBlock?: number;
  sentinelActive?: boolean;
}

const SIGNAL_LABELS = [
  { key: 'tvlDrainage',    label: 'TVL Drainage',          icon: '📉', desc: 'Rapid TVL decline detected' },
  { key: 'oracleDeviation',label: 'Oracle Deviation',       icon: '📊', desc: 'APY deviating from baseline' },
  { key: 'flashLoan',      label: 'Flash Loan Spike',       icon: '⚡', desc: 'Abnormal volume in single block' },
  { key: 'accessControl',  label: 'Access Control Event',   icon: '🔐', desc: 'Ownership/role change detected' },
] as const;

function ThreatLevel({ active }: { active: number }) {
  if (active === 0) return <Badge variant="green" dot pulse>All Clear</Badge>;
  if (active === 1) return <Badge variant="amber" dot>1 Signal Active</Badge>;
  if (active === 2) return <Badge variant="amber" dot pulse>{active} Signals Active</Badge>;
  return <Badge variant="red" dot pulse>🚨 {active} Signals — High Risk</Badge>;
}

function SignalRow({ label, icon, desc, active }: {
  label: string;
  icon: string;
  desc: string;
  active: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        background: active ? 'var(--red-dim)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        transition: 'all 0.3s ease',
      }}
    >
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            color: active ? 'var(--red)' : 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-dim)',
            marginTop: '2px',
          }}
        >
          {desc}
        </div>
      </div>
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: active ? 'var(--red)' : 'var(--text-dim)',
          flexShrink: 0,
          animation: active ? 'pulse-red 1s ease-in-out infinite' : 'none',
        }}
      />
    </div>
  );
}

export function RiskPanel({ protocols = [], loading, lastBlock, sentinelActive }: RiskPanelProps) {
  const anyEmergency = protocols.some(p => p.inEmergency);
  const totalActive  = protocols.reduce((sum, p) => sum + (p.signals?.totalActive ?? 0), 0);

  return (
    <Card accent={anyEmergency ? 'red' : totalActive > 0 ? 'amber' : 'green'}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <CardLabel style={{ marginBottom: 0 }}>AI Risk Monitor</CardLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {sentinelActive && (
            <Badge variant="green" dot pulse style={{ fontSize: '9px' }}>
              Sentinel Live
            </Badge>
          )}
          {lastBlock && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-dim)',
              }}
            >
              Block #{lastBlock.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Emergency banner */}
      {anyEmergency && (
        <div
          style={{
            padding: '12px',
            background: 'var(--red-dim)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '18px' }}>🚨</span>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '12px',
                color: 'var(--red)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Emergency Mode Active
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Funds moved to safe harbor. Claim available.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <Spinner />
        </div>
      ) : protocols.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-dim)',
          }}
        >
          No protocols being monitored
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {protocols.map(protocol => (
            <div key={protocol.address}>
              {/* Protocol header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px', marginRight: '8px' }}>
                    {protocol.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)' }}>
                    {protocol.address.slice(0, 8)}...
                  </span>
                </div>
                {protocol.inEmergency
                  ? <Badge variant="red" pulse dot>Emergency</Badge>
                  : <ThreatLevel active={protocol.signals?.totalActive ?? 0} />
                }
              </div>

              {/* Signals grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {SIGNAL_LABELS.map(({ key, label, icon, desc }) => (
                  <SignalRow
                    key={key}
                    label={label}
                    icon={icon}
                    desc={desc}
                    active={protocol.signals?.[key as keyof SignalState] === true}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}