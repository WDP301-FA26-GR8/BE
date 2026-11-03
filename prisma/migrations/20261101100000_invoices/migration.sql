-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceReconStatus" AS ENUM ('NONE', 'PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "InvoiceTaxPayer" AS ENUM ('VENDOR_COLLECTS', 'BUYER_REMITS');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "contract_id" UUID,
    "credited_invoice_id" UUID,
    "invoice_number" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "invoice_date" DATE NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "amount_rate" DECIMAL(20,10) NOT NULL,
    "amount_rate_date" DATE NOT NULL,
    "amount_rate_source" "PriceRateSource" NOT NULL,
    "amount_reporting_minor" BIGINT NOT NULL,
    "reconciliation_status" "InvoiceReconStatus" NOT NULL DEFAULT 'NONE',
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_employee_id" UUID NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "subscription_id" UUID,
    "description" TEXT NOT NULL,
    "out_of_catalog" BOOLEAN NOT NULL DEFAULT false,
    "billed_quantity" INTEGER,
    "unit_price_minor" BIGINT,
    "service_period_start" DATE,
    "service_period_end" DATE,
    "amount_minor" BIGINT NOT NULL,
    "amount_reporting_minor" BIGINT NOT NULL,
    "cost_center_id" UUID,
    "fiscal_year" INTEGER NOT NULL,
    "cost_reporting_minor" BIGINT NOT NULL,
    "deductible_vat_reporting_minor" BIGINT NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_tax_lines" (
    "invoice_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "tax_type" TEXT NOT NULL,
    "rate_bp" INTEGER NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "amount_rate" DECIMAL(20,10) NOT NULL,
    "amount_rate_date" DATE NOT NULL,
    "amount_rate_source" "PriceRateSource" NOT NULL,
    "amount_reporting_minor" BIGINT NOT NULL,
    "payer" "InvoiceTaxPayer" NOT NULL,
    "deductible" BOOLEAN NOT NULL,
    "card_fee_or_fx" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "invoice_tax_lines_pkey" PRIMARY KEY ("invoice_id","position")
);

-- CreateIndex
CREATE INDEX "invoices_invoice_date_vendor_id_idx" ON "invoices"("invoice_date", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_vendor_id_kind_invoice_number_key" ON "invoices"("organization_id", "vendor_id", "kind", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_lines_subscription_id_idx" ON "invoice_lines"("subscription_id");

-- CreateIndex
CREATE INDEX "invoice_lines_cost_center_id_fiscal_year_idx" ON "invoice_lines"("cost_center_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_position_key" ON "invoice_lines"("invoice_id", "position");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credited_invoice_id_fkey" FOREIGN KEY ("credited_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_currency_fkey" FOREIGN KEY ("amount_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_amount_currency_fkey" FOREIGN KEY ("amount_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual CHECK constraints per B07-1
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_link"
  CHECK ("kind" = 'CREDIT_NOTE' OR "credited_invoice_id" IS NULL);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_check" CHECK ("amount_minor" >= 0);
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_subject"
  CHECK (("subscription_id" IS NOT NULL) <> "out_of_catalog");
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_rate_range"
  CHECK ("rate_bp" BETWEEN 0 AND 10000);
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_amount_check"
  CHECK ("amount_minor" >= 0);
