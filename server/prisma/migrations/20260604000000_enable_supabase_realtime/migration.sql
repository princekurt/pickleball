-- Supabase Realtime only broadcasts tables added to its publication.
-- Keep this migration tolerant so local/non-Supabase PostgreSQL databases can still migrate.
DO $$
DECLARE
  realtime_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH realtime_table IN ARRAY ARRAY['Player', 'Match', 'Standing']
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = realtime_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', realtime_table);
      END IF;
    END LOOP;
  END IF;
END $$;

ALTER TABLE public."Player" REPLICA IDENTITY FULL;
ALTER TABLE public."Match" REPLICA IDENTITY FULL;
ALTER TABLE public."Standing" REPLICA IDENTITY FULL;
