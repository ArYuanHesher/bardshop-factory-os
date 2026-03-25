-- Add / convert qa_disposition column on schedule_anomaly_reports
-- If the column does not exist, create it as jsonb.
ALTER TABLE schedule_anomaly_reports
  ADD COLUMN IF NOT EXISTS qa_disposition jsonb;

-- If the column already exists as text (from an earlier migration),
-- convert it to jsonb, safely ignoring any rows with invalid JSON.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_anomaly_reports'
      AND column_name = 'qa_disposition'
      AND data_type = 'text'
  ) THEN
    -- Null out any values that aren't valid JSON first
    UPDATE schedule_anomaly_reports
    SET qa_disposition = NULL
    WHERE qa_disposition IS NOT NULL
      AND qa_disposition::text NOT LIKE '{%';

    ALTER TABLE schedule_anomaly_reports
      ALTER COLUMN qa_disposition TYPE jsonb
      USING qa_disposition::jsonb;
  END IF;
END $$;
