-- CreateTable
CREATE TABLE "internal_cost_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "cost_center_id" UUID NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "amount_rate" DECIMAL(20,10) NOT NULL,
    "amount_rate_date" DATE NOT NULL,
    "amount_rate_source" "PriceRateSource" NOT NULL,
    "amount_reporting_minor" BIGINT NOT NULL,
    "note" TEXT,
    "cancel_reason" TEXT,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(3),
    "recorded_by_employee_id" UUID NOT NULL,

    CONSTRAINT "internal_cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_cost_entries_application_id_period_start_idx" ON "internal_cost_entries"("application_id", "period_start");

-- CreateIndex
CREATE INDEX "internal_cost_entries_cost_center_id_period_start_idx" ON "internal_cost_entries"("cost_center_id", "period_start");

-- AddForeignKey
ALTER TABLE "internal_cost_entries" ADD CONSTRAINT "internal_cost_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_cost_entries" ADD CONSTRAINT "internal_cost_entries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_cost_entries" ADD CONSTRAINT "internal_cost_entries_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_cost_entries" ADD CONSTRAINT "internal_cost_entries_amount_currency_fkey" FOREIGN KEY ("amount_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints per US-12-11 and Logical ERD 7.106
ALTER TABLE "internal_cost_entries" ADD CONSTRAINT "internal_cost_entries_period_order"
    CHECK ("period_end" >= "period_start");

ALTER TABLE "internal_cost_entries" ADD CONSTRAINT "internal_cost_entries_cancel_whole"
    CHECK (("cancelled_at" IS NULL AND "cancel_reason" IS NULL) OR ("cancelled_at" IS NOT NULL AND "cancel_reason" IS NOT NULL));

ALTER TABLE "internal_cost_entries" ADD CONSTRAINT "internal_cost_entries_amount_positive"
    CHECK ("amount_minor" > 0);

ALTER TABLE "internal_cost_entries" ADD CONSTRAINT "internal_cost_entries_amount_reporting_positive"
    CHECK ("amount_reporting_minor" > 0);
