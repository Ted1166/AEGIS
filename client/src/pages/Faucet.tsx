import React, { useState } from 'react';
import { PageContent, PageHeader } from '../components/layout/Layout';
import { Card, CardLabel } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ethers } from 'ethers';
import { ADDRESSES, USDC_ABI, GAS_PARAMS } from '../config/contracts';
import type { ethers as EthersType } from 'ethers';

interface FaucetProps {
  address?: string;
  signer?: EthersType.JsonRpcSigner;
  onConnect: () => void;
}

const USDC_MINT_ABI = ['function mint(address to, uint256 amount) external'];

export function Faucet({ address, signer, onConnect }: FaucetProps) {
  const [minting, setMinting]   = useState(false);
  const [txHash, setTxHash]     = useState<string>();
  const [error, setError]       = useState<string>();
  const [amount, setAmount]     = useState('10000');

  async function handleMint() {
    if (!signer || !address) return;
    setMinting(true);
    setError(undefined);
    setTxHash(undefined);
    try {
      const usdc = new ethers.Contract(ADDRESSES.usdc, USDC_MINT_ABI, signer);
      const amountBn = BigInt(Math.round(parseFloat(amount) * 1e6));
      const tx = await usdc.mint(address, amountBn, GAS_PARAMS);
      setTxHash(tx.hash);
      await tx.wait();
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Mint failed';
      if (msg.includes('insufficient funds') || msg.includes('1010')) {
        setError('You need PAS tokens for gas first. Use the faucet below.');
      } else {
        setError(msg.slice(0, 120));
      }
    } finally {
      setMinting(false);
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Faucet"
        subtitle="Get testnet tokens to try Aegis"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Step 1 — PAS Gas */}
        <Card accent="blue">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'var(--blue-dim)', border: '1px solid var(--blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--blue)',
              flexShrink: 0,
            }}>1</span>
            <CardLabel style={{ marginBottom: 0 }}>Get PAS for Gas</CardLabel>
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
            You need PAS tokens to pay for gas on Paseo Asset Hub. Get free testnet PAS from the official Polkadot faucet.
          </p>

          <div style={{
            padding: '10px', background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            marginBottom: '16px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>
              Your address
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
              {address || 'Connect wallet first'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a
              href="https://faucet.polkadot.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Button variant="primary" size="md" style={{ width: '100%' }}>
                Open Polkadot Faucet ↗
              </Button>
            </a>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
              Select <strong style={{ color: 'var(--text-secondary)' }}>Passet Hub</strong> · paste your address above
            </div>
          </div>
        </Card>

        {/* Step 2 - Mint USDC */}
        <Card accent="green">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'var(--green-dim)', border: '1px solid var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--green)',
              flexShrink: 0,
            }}>2</span>
            <CardLabel style={{ marginBottom: 0 }}>Mint Mock USDC</CardLabel>
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
            Mint free MockUSDC to your wallet. You need PAS for gas (Step 1) before minting.
          </p>

          {/* Amount selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' }}>
            {['1000', '5000', '10000', '50000'].map(a => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                style={{
                  padding: '6px',
                  background: amount === a ? 'var(--green-dim)' : 'var(--bg-elevated)',
                  border: `1px solid ${amount === a ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  color: amount === a ? 'var(--green)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                ${a}
              </button>
            ))}
          </div>

          {!address ? (
            <Button variant="primary" size="md" style={{ width: '100%' }} onClick={onConnect}>
              Connect Wallet First
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              style={{ width: '100%' }}
              loading={minting}
              onClick={handleMint}
            >
              Mint {parseInt(amount).toLocaleString()} USDC
            </Button>
          )}

          {txHash && (
            <div style={{
              marginTop: '12px', padding: '10px',
              background: 'var(--green-dim)', border: '1px solid var(--green)',
              borderRadius: 'var(--radius)',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', marginBottom: '4px' }}>
                ✅ Minted successfully!
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', wordBreak: 'break-all' }}>
                tx: {txHash.slice(0, 20)}...
              </div>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '12px', padding: '10px',
              background: 'var(--red-dim)', border: '1px solid var(--red)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)',
            }}>
              ❌ {error}
            </div>
          )}
        </Card>
      </div>

      {/* How to add Paseo Asset Hub to MetaMask */}
      <Card>
        <CardLabel style={{ marginBottom: '16px' }}>Add Paseo Asset Hub to MetaMask</CardLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[
            { label: 'Network Name',    value: 'Paseo Asset Hub' },
            { label: 'RPC URL',         value: 'https://services.polkadothub-rpc.com/testnet' },
            { label: 'Chain ID',        value: '420420417' },
            { label: 'Currency Symbol', value: 'PAS' },
            { label: 'Block Explorer',  value: 'blockscout-passet-hub.parity-testnet.parity.io' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '10px', background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>
                {label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageContent>
  );
}