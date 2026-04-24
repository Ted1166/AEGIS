import React, { useState } from 'react';
import { PageContent, PageHeader } from '../components/layout/Layout';
import { Card, CardLabel } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ethers } from 'ethers';
import { ADDRESSES, GAS_PARAMS } from '../config/contracts';
import type { ethers as EthersType } from 'ethers';

interface FaucetProps {
  address?: string;
  signer?: EthersType.JsonRpcSigner;
  onConnect: () => void;
}

const USDC_MINT_ABI = ['function mint(address to, uint256 amount) external'];

export function Faucet({ address, signer, onConnect }: FaucetProps) {
  const [minting, setMinting] = useState(false);
  const [txHash, setTxHash]   = useState<string>();
  const [error, setError]     = useState<string>();
  const [amount, setAmount]   = useState('10000');

  async function handleMint() {
    if (!signer || !address) return;
    setMinting(true);
    setError(undefined);
    setTxHash(undefined);
    try {
      const usdc     = new ethers.Contract(ADDRESSES.usdc, USDC_MINT_ABI, signer);
      const amountBn = BigInt(Math.round(parseFloat(amount) * 1e6));
      const tx       = await usdc.mint(address, amountBn, GAS_PARAMS);
      setTxHash(tx.hash);
      await tx.wait();
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Mint failed';
      if (msg.includes('insufficient funds')) {
        setError('You need INIT tokens for gas first. Get them from the Initia faucet below.');
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
        subtitle="Get testnet tokens to try Aegis on Initia"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        <Card accent="blue">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'var(--blue-dim)', border: '1px solid var(--blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--blue)',
              flexShrink: 0,
            }}>1</span>
            <CardLabel style={{ marginBottom: 0 }}>Get INIT for Gas</CardLabel>
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
            You need INIT tokens to pay for gas on the Initia testnet. Get free tokens from the official Initia faucet.
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
              href="https://app.testnet.initia.xyz/faucet"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Button variant="primary" size="md" style={{ width: '100%' }}>
                Open Initia Faucet ↗
              </Button>
            </a>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
              Paste your address · select <strong style={{ color: 'var(--text-secondary)' }}>initiation-2</strong>
            </div>
          </div>
        </Card>

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
            Mint free MockUSDC to your wallet. You need INIT for gas (Step 1) before minting.
          </p>

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
            <Button variant="primary" size="md" style={{ width: '100%' }} loading={minting} onClick={handleMint}>
              Mint {parseInt(amount).toLocaleString()} USDC
            </Button>
          )}

          {txHash && (
            <div style={{ marginTop: '12px', padding: '10px', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', marginBottom: '4px' }}>✅ Minted successfully!</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', wordBreak: 'break-all' }}>tx: {txHash.slice(0, 20)}...</div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: '12px', padding: '10px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)' }}>
              ❌ {error}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardLabel style={{ marginBottom: '16px' }}>Add aegis-1 to MetaMask</CardLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[
            { label: 'Network Name',    value: 'Aegis-1 (Initia)' },
            { label: 'RPC URL',         value: 'http://localhost:8545' },
            { label: 'Chain ID',        value: '2559569424467142' },
            { label: 'Currency Symbol', value: 'GAS' },
            { label: 'Block Explorer',  value: 'scan.testnet.initia.xyz/custom-network' },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
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