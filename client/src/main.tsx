import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/shared/Layout';
import { ToastContextProvider } from '@/hooks/useToast';
import { HomePage } from '@/pages/HomePage';
import { PlayersPage } from '@/pages/PlayersPage';
import { RoundRobinPage } from '@/pages/RoundRobinPage';
import { TournamentPage } from '@/pages/TournamentPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { CourtsPage } from '@/pages/CourtsPage';
import { registerServiceWorker } from '@/lib/registerServiceWorker';
import './index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastContextProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/round-robin/*" element={<RoundRobinPage />} />
            <Route path="/tournament/*" element={<TournamentPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/courts" element={<CourtsPage />} />
          </Routes>
        </Layout>
      </ToastContextProvider>
    </BrowserRouter>
  </StrictMode>
);
