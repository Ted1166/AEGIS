import { defineChain } from 'viem';

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
      http: ['http://localhost:8545'],
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

export const CHAIN_ID = 0x917ea3252c4c6;

export const RPC_URL = 'http://localhost:8545';

export const EXPLORER_URL = 'https://scan.testnet.initia.xyz/initiation-2';

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/txs/${hash}`;
}

export function explorerAddress(address: string) {
  return `${EXPLORER_URL}/accounts/${address}`;
}