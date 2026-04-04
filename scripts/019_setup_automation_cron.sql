-- Enable required extensions for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store the app URL and service key in Vault for secure access
-- Note: These need to be set manually via Supabase Dashboard > Project Settings > Vault
-- Or run these commands with your actual values:
-- SELECT vault.create_secret('https://login.snoek.app', 'app_url');
-- SELECT vault.create_secret('your-service-role-key', 'service_role_key');

-- Create a function to execute automations
CREATE OR REPLACE FUNCTION execute_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_url text;
  service_key text;
BEGIN
  -- Get secrets from vault
  SELECT decrypted_secret INTO app_url 
  FROM vault.decrypted_secrets 
  WHERE name = 'app_url';
  
  SELECT decrypted_secret INTO service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'service_role_key';
  
  -- Only proceed if secrets are configured
  IF app_url IS NOT NULL AND service_key IS NOT NULL THEN
    -- Make async HTTP POST to the automations endpoint
    PERFORM net.http_post(
      url := app_url || '/api/automations/execute',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := '{}'::jsonb
    );
  END IF;
END;
$$;

-- Schedule the automation execution every 5 minutes
SELECT cron.schedule(
  'execute-automations-every-5-min',
  '*/5 * * * *',
  'SELECT execute_automations()'
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('execute-automations-every-5-min');
