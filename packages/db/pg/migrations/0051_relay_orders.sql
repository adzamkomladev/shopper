-- Day 50 (v1.5): the order inbox. A relay org marks the orders its box has taken (`relay_acked_at`); a box keeps the
-- price check of each relayed order it accepted and which of its status changes it has told the relay. Replayable.
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "relay_acked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "online_order" ADD COLUMN IF NOT EXISTS "price_check" jsonb;--> statement-breakpoint
ALTER TABLE "online_order_event" ADD COLUMN IF NOT EXISTS "relayed_at" timestamp with time zone;
