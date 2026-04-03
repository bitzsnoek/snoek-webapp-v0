-- Add 'scheduled' to the automations type check constraint

-- Drop the existing constraint
ALTER TABLE automations DROP CONSTRAINT IF EXISTS automations_type_check;

-- Add the new constraint with 'scheduled' included
ALTER TABLE automations ADD CONSTRAINT automations_type_check 
  CHECK (type IN ('recurring', 'meeting_trigger', 'scheduled'));
