import { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { VaultPage } from './pages/Vault';
import { Analytics } from './pages/Analytics';
import { Faucet } from './pages/Faucet';
import { OnboardingModal } from './components/OnboardingModal';
import { useWallet } from './hooks/useWallet';

type Page = 'dashboard' | 'vault' | 'analytics' | 'faucet';

export default function App() {
  const [page, setPage]             = useState<Page>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const wallet = useWallet();

  useEffect(() => {
    const seen = localStorage.getItem('aegis_onboarded');
    if (!seen) setShowOnboarding(true);
  }, []);

  function closeOnboarding() {
    localStorage.setItem('aegis_onboarded', '1');
    setShowOnboarding(false);
  }

  const balanceFormatted = wallet.balance !== undefined
    ? (Number(wallet.balance) / 1e18).toFixed(3)
    : undefined;

  const pageProps = { address: wallet.address, signer: wallet.signer };

  return (
    <Layout>
      {showOnboarding && (
        <OnboardingModal
          onClose={closeOnboarding}
          onNavigate={(p) => { setPage(p as Page); closeOnboarding(); }}
        />
      )}

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
      {page === 'vault'      && <VaultPage  {...pageProps} onNavigate={(p) => setPage(p as Page)} />}
      {page === 'analytics'  && <Analytics  {...pageProps} onConnect={wallet.connect} />}
      {page === 'faucet'     && <Faucet     {...pageProps} onConnect={wallet.connect} />}
    </Layout>
  );
}