import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerWithStats } from '@/types';

interface PlayerStore {
  players: PlayerWithStats[];
  loading: boolean;
  search: string;
  skillFilter: number | null;
  setSearch: (search: string) => void;
  setSkillFilter: (level: number | null) => void;
  setPlayers: (players: PlayerWithStats[]) => void;
  setLoading: (loading: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      players: [],
      loading: false,
      search: '',
      skillFilter: null,
      setSearch: (search) => set({ search }),
      setSkillFilter: (skillFilter) => set({ skillFilter }),
      setPlayers: (players) => set({ players }),
      setLoading: (loading) => set({ loading }),
    }),
    { name: 'pickleball-players', partialize: (s) => ({ players: s.players }) }
  )
);

interface ThemeStore {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      darkMode: false,
      toggleDarkMode: () => {
        const next = !get().darkMode;
        document.documentElement.classList.toggle('dark', next);
        set({ darkMode: next });
      },
    }),
    {
      name: 'pickleball-theme',
      onRehydrateStorage: () => (state) => {
        if (state?.darkMode) {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);

interface EventStore {
  currentEventId: string | null;
  setCurrentEventId: (id: string | null) => void;
}

export const useEventStore = create<EventStore>()(
  persist(
    (set) => ({
      currentEventId: null,
      setCurrentEventId: (id) => set({ currentEventId: id }),
    }),
    { name: 'pickleball-event' }
  )
);
