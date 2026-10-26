-- Before the build queue (20261026000000_build_queue) every build started when it was sent, so an agent message from
-- then started at its createdAt. With this, an agent message without startedAt is one that left the line without
-- starting (stopped, waited too long, or not allowed at its turn): the site says "Didn't start, not charged" for it.
UPDATE "Message" SET "startedAt" = "createdAt" WHERE role = 'agent' AND "startedAt" IS NULL AND status IS DISTINCT FROM 'queued';
