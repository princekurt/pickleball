import { Routes, Route, useParams } from 'react-router-dom';
import { TournamentSetup } from '@/components/tournament/TournamentSetup';
import { TournamentDashboard } from '@/components/tournament/TournamentDashboard';

function TournamentEventPage() {
  const { id } = useParams();
  if (!id) return null;
  return <TournamentDashboard eventId={id} />;
}

export function TournamentPage() {
  return (
    <Routes>
      <Route index element={
        <div className="md:ml-56 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Tournament</h1>
            <p className="text-muted-foreground">Create a bracket-style competitive tournament.</p>
          </div>
          <TournamentSetup />
        </div>
      } />
      <Route path=":id" element={
        <div className="md:ml-56">
          <TournamentEventPage />
        </div>
      } />
    </Routes>
  );
}
