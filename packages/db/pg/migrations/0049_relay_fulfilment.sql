-- Day 48 (v1.5): a relay org's pickup, delivery, hours and slots are its box's, like its catalogue: only the relay
-- publish command (which sets `shopper.relay`) writes them. Replayable.
CREATE OR REPLACE TRIGGER relay_lock BEFORE INSERT OR UPDATE OR DELETE ON branch_fulfilment FOR EACH ROW EXECUTE FUNCTION shopper_relay_lock();
