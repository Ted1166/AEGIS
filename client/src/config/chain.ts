import { defineChain } from 'viem';

export const paseoHub = defineChain({
  id: 420420417,
  name: 'Paseo Asset Hub',
  nativeCurrency: {
    name: 'Paseo',
    symbol: 'PAS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://services.polkadothub-rpc.com/testnet'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://blockscout-passet-hub.parity-testnet.parity.io',
    },
  },
  testnet: true,
});

export const CHAIN_ID = 420420417;

export const RPC_URL = 'https://services.polkadothub-rpc.com/testnet';

export const EXPLORER_URL = 'https://blockscout-passet-hub.parity-testnet.parity.io';

export function explorerTx(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}