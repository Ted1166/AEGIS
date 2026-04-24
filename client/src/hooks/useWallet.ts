import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAIN_ID } from '../config/chain';

interface WalletState {
  address?: string;
  provider?: ethers.BrowserProvider;
  signer?: ethers.JsonRpcSigner;
  chainId?: number;
  balance?: bigint;
  connected: boolean;
  connecting: boolean;
  error?: string;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    connecting: false,
  });

  const updateBalance = useCallback(async (provider: ethers.BrowserProvider, address: string) => {
    try {
      const bal = await provider.getBalance(address);
      setState(s => ({ ...s, balance: bal }));
    } catch { }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState(s => ({ ...s, error: 'No wallet detected. Install MetaMask.' }));
      return;
    }

    setState(s => ({ ...s, connecting: true, error: undefined }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer  = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      setState({ address, provider, signer, chainId, connected: true, connecting: false });
      await updateBalance(provider, address);

      if (chainId !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          });
        } catch (switchErr: any) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId:         `0x${CHAIN_ID.toString(16)}`,
                chainName:       'Aegis-1 (Initia)',
                nativeCurrency:  { name: 'GAS', symbol: 'GAS', decimals: 18 },
                rpcUrls:         ['http://localhost:8545'],
                blockExplorerUrls: ['https://scan.testnet.initia.xyz/custom-network'],
              }],
            });
          }
        }
      }
    } catch (err: any) {
      setState(s => ({
        ...s,
        connecting: false,
        error: err?.message?.includes('rejected') ? 'Connection rejected' : 'Failed to connect',
      }));
    }
  }, [updateBalance]);

  const disconnect = useCallback(() => {
    setState({ connected: false, connecting: false });
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState(s => ({ ...s, address: accounts[0] }));
        if (state.provider) await updateBalance(state.provider, accounts[0]);
      }
    };

    const handleChainChanged = (chainId: string) => {
      setState(s => ({ ...s, chainId: parseInt(chainId, 16) }));
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect, updateBalance, state.provider]);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts.length > 0) connect();
    }).catch(() => {});
  }, []);

  return { ...state, connect, disconnect };
}