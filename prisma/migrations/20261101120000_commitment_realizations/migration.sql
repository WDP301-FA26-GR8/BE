-- AlterTable: add realized_minor column to budget_commitments
ALTER TABLE "budget_commitments" ADD COLUMN "realized_minor" BIGINT NOT NULL DEFAULT 0;

-- Backfill realized_minor for existing EXPENSED rows to satisfy the updated CHECK constraint.
-- Trigger guard currently rejects updates on non-HELD rows, so temporarily disable the row guard trigger.
ALTER TABLE "budget_commitments" DISABLE TRIGGER budget_commitments_guard_row;
UPDATE "budget_commitments"
   SET "realized_minor" = "amount_minor" - "released_minor"
 WHERE "state" = 'EXPENSED';
ALTER TABLE "budget_commitments" ENABLE TRIGGER budget_commitments_guard_row;

-- Replace release check constraint with 3-state check (F-01)
ALTER TABLE "budget_commitments" DROP CONSTRAINT "budget_commitments_release_check";
ALTER TABLE "budget_commitments" ADD CONSTRAINT "budget_commitments_release_check" CHECK (
  "released_minor" >= 0 AND "realized_minor" >= 0
  AND "released_minor" + "realized_minor" <= "amount_minor"
  AND (
    ("state" = 'RELEASED' AND "released_minor" = "amount_minor" AND "realized_minor" = 0 AND "released_at" IS NOT NULL)
    OR ("state" = 'HELD' AND "released_minor" + "realized_minor" < "amount_minor" AND "released_at" IS NULL)
    OR ("state" = 'EXPENSED' AND "realized_minor" > 0
        AND "released_minor" + "realized_minor" = "amount_minor" AND "released_at" IS NULL)
  )
);

-- Guard trigger function: preserve existing logic, add check that realized_minor cannot decrease (F-01)
CREATE OR REPLACE FUNCTION budget_commitments_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_id <> OLD.request_id OR NEW.cost_center_id <> OLD.cost_center_id OR NEW.year <> OLD.year
     OR NEW.currency <> OLD.currency OR NEW.amount_minor <> OLD.amount_minor THEN
    RAISE EXCEPTION 'budget_commitments keeps the request, the Cost Center, the year and the amount it was made for (UPDATE rejected)'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.state <> 'HELD' THEN
    RAISE EXCEPTION 'a commitment that is % does not change again (UPDATE rejected)', OLD.state
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.released_minor < OLD.released_minor THEN
    RAISE EXCEPTION 'what went back to the budget does not come back (UPDATE rejected)'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.realized_minor < OLD.realized_minor THEN
    RAISE EXCEPTION 'what became an expense does not go back (UPDATE rejected)'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- CreateTable: commitment_realizations (F-21)
CREATE TABLE "commitment_realizations" (
    "id" UUID NOT NULL,
    "commitment_id" UUID NOT NULL,
    "invoice_line_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_employee_id" UUID NOT NULL,

    CONSTRAINT "commitment_realizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commitment_realizations_amount_check" CHECK ("amount_minor" > 0)
);

-- CreateIndex: unique invoice_line_id (F-21)
CREATE UNIQUE INDEX "commitment_realizations_invoice_line_id_key" ON "commitment_realizations"("invoice_line_id");

-- CreateIndex: index commitment_id
CREATE INDEX "commitment_realizations_commitment_id_idx" ON "commitment_realizations"("commitment_id");

-- AddForeignKey
ALTER TABLE "commitment_realizations" ADD CONSTRAINT "commitment_realizations_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "budget_commitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_realizations" ADD CONSTRAINT "commitment_realizations_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only trigger for commitment_realizations (same pattern as budget_commitment_releases)
CREATE FUNCTION commitment_realizations_reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'commitment_realizations is append-only (% rejected)', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER commitment_realizations_no_update_delete
  BEFORE UPDATE OR DELETE ON commitment_realizations
  FOR EACH ROW EXECUTE FUNCTION commitment_realizations_reject_change();

CREATE TRIGGER commitment_realizations_no_truncate
  BEFORE TRUNCATE ON commitment_realizations
  FOR EACH STATEMENT EXECUTE FUNCTION commitment_realizations_reject_change();
