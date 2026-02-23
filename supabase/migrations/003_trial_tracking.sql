-- Add trial tracking to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;

-- Function to start a trial
CREATE OR REPLACE FUNCTION start_user_trial(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO subscriptions (user_id, is_premium, is_trial, trial_started_at, trial_ends_at)
  VALUES (p_user_id, true, true, NOW(), NOW() + INTERVAL '72 hours')
  ON CONFLICT (user_id)
  DO UPDATE SET
    is_premium = CASE WHEN subscriptions.is_trial = false AND subscriptions.is_premium = true THEN true ELSE true END,
    is_trial = CASE WHEN subscriptions.is_trial = false AND subscriptions.is_premium = true THEN false ELSE true END,
    trial_started_at = CASE WHEN subscriptions.trial_started_at IS NULL THEN NOW() ELSE subscriptions.trial_started_at END,
    trial_ends_at = CASE WHEN subscriptions.trial_ends_at IS NULL THEN NOW() + INTERVAL '72 hours' ELSE subscriptions.trial_ends_at END;
END;
$$ LANGUAGE plpgsql;

-- Function to check and expire trials
CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- If trial has ended, set is_premium to false (unless they've paid)
  IF NEW.is_trial = true AND NEW.trial_ends_at < NOW() THEN
    NEW.is_premium := false;
    NEW.is_trial := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trial expiration check
DROP TRIGGER IF EXISTS trial_expiration_check ON subscriptions;
CREATE TRIGGER trial_expiration_check
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION check_trial_expiration();
