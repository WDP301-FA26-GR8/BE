-- The raw history of the AI calls moves to MongoDB (ADR-0020): PostgreSQL keeps the calls, their state, the result the summary of
-- the owner is built from, and a transactional outbox the worker delivers to MongoDB. `ai_invocation_contents` is emptied into the
-- two new tables and dropped, in this one migration: its `result` goes to `ai_invocation_results`, and its context, prompt, raw
-- answer and parsed output become the first snapshot of each call in `ai_history_deliveries`, which the worker writes into MongoDB.
-- Nothing is lost, but there is no way back to the old table (DB-05): restoring the backup taken before `migrate deploy` is the
-- only rollback.

-- CreateEnum
CREATE TYPE "AiHistoryState" AS ENUM ('PENDING', 'AVAILABLE', 'ERROR', 'PURGING', 'PURGED');

-- CreateEnum
CREATE TYPE "AiHistoryOperation" AS ENUM ('SNAPSHOT', 'PURGE');

-- AlterTable
ALTER TABLE "ai_invocations"
    ADD COLUMN "history_state" "AiHistoryState" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "history_version" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "history_stored_version" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "history_generation" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "history_error_code" TEXT,
    ADD COLUMN "history_purged_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ai_invocation_results" (
    "invocation_id" UUID NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_invocation_results_pkey" PRIMARY KEY ("invocation_id")
);

-- CreateTable
CREATE TABLE "ai_history_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invocation_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "operation" "AiHistoryOperation" NOT NULL,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL,
    "lease_token" UUID,
    "lease_until" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "parked_at" TIMESTAMPTZ(3),
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_history_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Prisma's default name for @@unique([invocationId, generation, version, operation]), cut to 63 characters as PostgreSQL
-- requires (a longer name would be silently truncated and drift from the schema).
CREATE UNIQUE INDEX "ai_history_deliveries_invocation_id_generation_version_oper_key" ON "ai_history_deliveries"("invocation_id", "generation", "version", "operation");

-- CreateIndex
CREATE INDEX "ai_history_deliveries_available_at_idx" ON "ai_history_deliveries"("available_at");

-- AddForeignKey
ALTER TABLE "ai_invocation_results" ADD CONSTRAINT "ai_invocation_results_invocation_id_fkey" FOREIGN KEY ("invocation_id") REFERENCES "ai_invocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_history_deliveries" ADD CONSTRAINT "ai_history_deliveries_invocation_id_fkey" FOREIGN KEY ("invocation_id") REFERENCES "ai_invocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: the result each call kept.
INSERT INTO "ai_invocation_results" ("invocation_id", "result", "created_at")
SELECT c."invocation_id", c."result", c."created_at"
FROM "ai_invocation_contents" c
WHERE c."result" IS NOT NULL;

-- Backfill: every call with a content gets version 1 of its history, still to be delivered.
UPDATE "ai_invocations" i
SET "history_state" = 'PENDING', "history_version" = 1
FROM "ai_invocation_contents" c
WHERE c."invocation_id" = i."id";

-- Backfill: the snapshot itself, in the shape the worker decodes (`invocation-history-payload.json.ts`). `validation` is what the
-- checks rejected, from the result; null when the checks never ran.
INSERT INTO "ai_history_deliveries" (
    "id", "organization_id", "invocation_id", "generation", "version", "operation", "payload", "available_at", "created_at"
)
SELECT gen_random_uuid(), i."organization_id", i."id", 0, 1, 'SNAPSHOT',
       jsonb_build_object(
           'context', c."context",
           'promptText', c."prompt_text",
           'rawResponse', c."raw_response",
           'parsed', c."parsed",
           'validation', CASE WHEN c."result" IS NULL THEN NULL
                              ELSE jsonb_build_object('rejections', COALESCE(c."result" -> 'rejections', '[]'::jsonb)) END
       ),
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ai_invocations" i
JOIN "ai_invocation_contents" c ON c."invocation_id" = i."id";

-- A call with no content row had it purged by the old `ops:ai-purge`: nothing of it is left to deliver, MongoDB never held it.
UPDATE "ai_invocations" i
SET "history_state" = 'PURGED', "history_purged_at" = COALESCE(i."finished_at", i."created_at")
WHERE NOT EXISTS (SELECT 1 FROM "ai_invocation_contents" c WHERE c."invocation_id" = i."id");

-- DropTable: everything it held is in the two tables above.
DROP TABLE "ai_invocation_contents";

-- What MongoDB confirmed never runs ahead of what was written; the purge stamp is set exactly while the history is purging or purged.
ALTER TABLE "ai_invocations"
    ADD CONSTRAINT "ai_invocations_history_versions_check" CHECK (
      "history_version" >= 0 AND "history_generation" >= 0 AND "history_stored_version" BETWEEN 0 AND "history_version"
    ),
    ADD CONSTRAINT "ai_invocations_history_purged_at_check" CHECK (
      ("history_state" IN ('PURGING', 'PURGED')) = ("history_purged_at" IS NOT NULL)
    );

-- A tombstone carries no content; a snapshot carries its payload until MongoDB confirmed it or a purge made it obsolete.
ALTER TABLE "ai_history_deliveries"
    ADD CONSTRAINT "ai_history_deliveries_payload_check" CHECK (
      CASE "operation"
        WHEN 'PURGE' THEN "payload" IS NULL
        ELSE "payload" IS NOT NULL OR "closed_at" IS NOT NULL
      END
    ),
    ADD CONSTRAINT "ai_history_deliveries_counters_check" CHECK (
      "generation" >= 0 AND "version" >= 0 AND "attempts" >= 0
    ),
    ADD CONSTRAINT "ai_history_deliveries_lease_check" CHECK (("lease_token" IS NULL) = ("lease_until" IS NULL));
