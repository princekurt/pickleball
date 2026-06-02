import { Routes, Route, useParams } from 'react-router-dom';
import { RoundRobinSetup } from '@/components/round-robin/RoundRobinSetup';
import { RoundRobinDashboard } from '@/components/round-robin/RoundRobinDashboard';

function RoundRobinEventPage() {
  const { id } = useParams();
  if (!id) return null;
  return <RoundRobinDashboard eventId={id} />;
}

export function RoundRobinPage() {
  return (
    <Routes>
      <Route index element={
        <div className="md:ml-56 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Round Robin</h1>
            <p className="text-muted-foreground">Set up a casual group play session with auto-rotation.</p>
          </div>
          <RoundRobinSetup />
        </div>
      } />
      <Route path=":id" element={
        <div className="md:ml-56">
          <RoundRobinEventPage />
        </div>
      } />
    </Routes>
  );
}
