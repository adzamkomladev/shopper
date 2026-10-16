ALTER TABLE payment ADD COLUMN IF NOT EXISTS phone_fingerprint text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'payment'::regclass AND conname = 'payment_phone_fingerprint'
  ) THEN
    ALTER TABLE payment ADD CONSTRAINT payment_phone_fingerprint
      CHECK (phone_fingerprint IS NULL OR phone_fingerprint ~ '^[0-9a-f]{64}$');
  END IF;
END $$;
