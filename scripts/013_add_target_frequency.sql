ALTER TABLE quarterly_key_results
ADD COLUMN IF NOT EXISTS target_frequency TEXT NOT NULL DEFAULT 'quarterly';
