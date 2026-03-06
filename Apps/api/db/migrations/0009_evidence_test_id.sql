-- Ensure evidence has test_id (add if missing for legacy schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evidence')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evidence' AND column_name = 'test_id') THEN
    ALTER TABLE evidence ADD COLUMN test_id uuid REFERENCES tests(id) ON DELETE CASCADE;
  END IF;
END $$;
