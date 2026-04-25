import { defineChain } from 'viem';

const NGROK_URL = 'https://defiant-spout-breeches.ngrok-free.dev';

export const aegisChain = defineChain({
  id: 2559569424467142,
  name: 'Aegis-1 (Initia)',
  nativeCurrency: {
    name: 'GAS',
    symbol: 'GAS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [NGROK_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Initia Scan',
      url: 'https://scan.testnet.initia.xyz/custom-network',
    },
  },
  testnet: true,
});

export const CHAIN_ID = 2559569424467142;

export const RPC_URL = NGROK_URL;

export const EXPLORER_URL = 'https://scan.testnet.initia.xyz/initiation-2';

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/txs/${hash}`;
}

export function explorerAddress(address: string) {
  return `${EXPLORER_URL}/accounts/${address}`;
}