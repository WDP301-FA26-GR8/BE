ALTER TABLE "document_attachments" ADD COLUMN "invoice_id" UUID;
ALTER TABLE "document_attachments" DROP CONSTRAINT "document_attachments_owner_state";
ALTER TABLE "document_attachments" DROP CONSTRAINT "document_attachments_purpose_fits_owner";
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_owner_state" CHECK (
  ("status" = 'READY') = (num_nonnulls("contract_id", "invoice_id") = 1)
  AND (num_nonnulls("contract_id", "invoice_id") = 0) = ("attached_at" IS NULL)
);
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_purpose_fits_owner" CHECK (
  ("contract_id" IS NULL OR "purpose" IN ('CONTRACT_ATTACHMENT', 'PURCHASE_DOCUMENT'))
  AND ("invoice_id" IS NULL OR "purpose" IN ('PURCHASE_DOCUMENT', 'TAX_PAYMENT_PROOF'))
);
CREATE INDEX "document_attachments_invoice_id_idx" ON "document_attachments"("invoice_id");
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_tax_lines" ADD COLUMN "proof_document_id" UUID;
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_proof_document_id_fkey"
  FOREIGN KEY ("proof_document_id") REFERENCES "document_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
