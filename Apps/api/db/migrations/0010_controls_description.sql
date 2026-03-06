-- Add description column to controls for framework reference data (implementation guidance)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'controls' AND column_name = 'description') THEN
    ALTER TABLE controls ADD COLUMN description text;
  END IF;
END $$;
