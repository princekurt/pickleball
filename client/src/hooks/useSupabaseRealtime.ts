import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RealtimeSubscription {
  table: 'Player' | 'Match' | 'Standing';
  filter?: string;
}

export function useSupabaseRealtime(
  channelName: string,
  subscriptions: RealtimeSubscription[],
  onChange: () => void
) {
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(onChange, 150);
    };

    const channel = client.channel(channelName);
    subscriptions.forEach(({ table, filter }) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        scheduleRefresh
      );
    });

    channel.subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      client.removeChannel(channel);
    };
  }, [channelName, onChange, subscriptions]);
}
