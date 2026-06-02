const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  players: {
    list: (params?: { search?: string; skillLevel?: number }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.skillLevel) qs.set('skillLevel', String(params.skillLevel));
      const q = qs.toString();
      return request<PlayerWithStats[]>(`/players${q ? `?${q}` : ''}`);
    },
    get: (id: string) => request<Player>(`/players/${id}`),
    create: (data: Partial<Player>) =>
      request<Player>('/players', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Player>) =>
      request<Player>(`/players/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/players/${id}`, { method: 'DELETE' }),
  },
  events: {
    list: (type?: string) =>
      request<EventSummary[]>(`/events${type ? `?type=${type}` : ''}`),
    get: (id: string) => request<EventDetail>(`/events/${id}`),
    create: (data: Partial<Event>) =>
      request<Event>('/events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Event>) =>
      request<Event>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/events/${id}`, { method: 'DELETE' }),
    history: (id: string) => request<MatchDetail[]>(`/events/${id}/history`),
    exportCsv: (id: string) => {
      window.open(`${API_BASE}/events/${id}/export/csv`, '_blank');
    },
  },
  courts: {
    list: () => request<Court[]>('/courts'),
    create: (data: Partial<Court>) =>
      request<Court>('/courts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Court>) =>
      request<Court>(`/courts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/courts/${id}`, { method: 'DELETE' }),
  },
  matches: {
    get: (id: string) => request<MatchDetail>(`/matches/${id}`),
    update: (id: string, data: Partial<Match>) =>
      request<MatchDetail>(`/matches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    submitScore: (id: string, data: { team1Score: number; team2Score: number; confirm?: boolean }) =>
      request<MatchDetail>(`/matches/${id}/score`, { method: 'POST', body: JSON.stringify(data) }),
  },
  roundRobin: {
    setup: (data: RoundRobinSetup) =>
      request<EventDetail>('/round-robin/setup', { method: 'POST', body: JSON.stringify(data) }),
    nextRound: (eventId: string) =>
      request<EventDetail>(`/round-robin/${eventId}/next-round`, { method: 'POST' }),
    swapPlayers: (eventId: string, data: { matchId: string; team1PlayerIds: string[]; team2PlayerIds: string[] }) =>
      request<MatchDetail>(`/round-robin/${eventId}/swap-players`, { method: 'POST', body: JSON.stringify(data) }),
  },
  tournament: {
    setup: (data: TournamentSetup) =>
      request<EventDetail>('/tournament/setup', { method: 'POST', body: JSON.stringify(data) }),
    bracket: (eventId: string) => request<BracketData>(`/tournament/${eventId}/bracket`),
  },
};

import type {
  Player,
  PlayerWithStats,
  Event,
  EventSummary,
  EventDetail,
  Court,
  Match,
  MatchDetail,
  RoundRobinSetup,
  TournamentSetup,
  BracketData,
} from '@/types';
