ALTER TABLE sale_tender DROP CONSTRAINT IF EXISTS sale_tender_amount;
--> statement-breakpoint
ALTER TABLE sale_tender ADD CONSTRAINT sale_tender_amount CHECK (amount > 0 OR (kind = 'cash' AND amount = 0));
