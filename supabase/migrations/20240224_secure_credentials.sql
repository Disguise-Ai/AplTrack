-- Add secure credential columns to connected_apps table

-- Add column for masked credentials (safe to return to client)
ALTER TABLE connected_apps
ADD COLUMN IF NOT EXISTS credentials_masked JSONB;

-- Add column to track if credentials are encrypted
ALTER TABLE connected_apps
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_connected_apps_user_provider
ON connected_apps(user_id, provider);

-- Update RLS policies to ensure credentials column is never returned to client
-- (This is handled at the application level in api.ts)

-- Comment for documentation
COMMENT ON COLUMN connected_apps.credentials IS 'Encrypted credentials - never return to client';
COMMENT ON COLUMN connected_apps.credentials_masked IS 'Masked credentials safe to display in UI';
COMMENT ON COLUMN connected_apps.is_encrypted IS 'True if credentials are stored encrypted';
