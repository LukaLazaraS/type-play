-- TypePlay's own changes to a game (`admin run`): free, run with run.mjs --maintenance.
ALTER TABLE "QueuedRun" ADD COLUMN "maintenance" BOOLEAN NOT NULL DEFAULT false;
