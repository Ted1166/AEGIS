import React, { useState } from 'react';
import { Layout } from './components/layout/Layout';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { VaultPage } from './pages/Vault';
import { Analytics } from './pages/Analytics';
import { useWallet } from './hooks/useWallet';
import { formatUsdc } from './lib/utils';

type Page = 'dashboard' | 'vault' | 'analytics';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const wallet = useWallet();

  const balanceFormatted = wallet.balance !== undefined
    ? (Number(wallet.balance) / 1e18).toFixed(3)
    : undefined;

  const pageProps = {
    address: wallet.address,
    signer:  wallet.signer,
  };

  return (
    <Layout>
      <Header
        address={wallet.address}
        balance={balanceFormatted}
        chainId={wallet.chainId}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
        currentPage={page}
        onNavigate={(p) => setPage(p as Page)}
      />

      {page === 'dashboard'  && <Dashboard  {...pageProps} onNavigate={(p) => setPage(p as Page)} />}
      {page === 'vault'      && <VaultPage  {...pageProps} />}
      {page === 'analytics'  && <Analytics  {...pageProps} />}
    </Layout>
  );
}