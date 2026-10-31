# B07-1 — Schema hóa đơn

| Gói  | Hạng mục               | AC                                     | Loại   | Cổng vào |
| ---- | ---------------------- | -------------------------------------- | ------ | -------- |
| B-07 | `g8-invoice-recording` | nền cho `US-12-10`, `US-12-02`, Task 1 | `CODE` | P01 xong |

Chỉ tạo bảng và ràng buộc. Chưa có service hay route.

## Đọc trước

- `docs/workspace/items/g8-invoice-recording/spec.md`
- `prisma/models/budgets.prisma`, model `BudgetCommitment` làm mẫu
- `../docs/ERD/logical/LOGICAL-ERD-INVENTORY.md`, mục 7.103, 7.104, 7.105
- `docs/rules/database-business.md`

Inventory là bản lịch sử. Cột lấy từ đó nhưng áp các chỉnh sửa dưới đây.

## Bảng

`prisma/models/budgets.prisma`, thêm:

**`Invoice` → `invoices`:** `id`, `organizationId`, `vendorId`, `contractId?`, `creditedInvoiceId?`, `invoiceNumber`, `kind`,
`invoiceDate` (Date), `amountMinor`, `amountCurrency`, `amountRate` (Decimal 20,10), `amountRateDate`, `amountRateSource`,
`amountReportingMinor`, `reconciliationStatus` (mặc định `NONE`), `recordedAt`, `recordedByEmployeeId`.
Unique `(organizationId, vendorId, kind, invoiceNumber)`; index `invoiceDate`, `vendorId`.

**`InvoiceLine` → `invoice_lines`:** `id`, `invoiceId`, `position` (SmallInt), `subscriptionId?`, `description`, `outOfCatalog`
(mặc định `false`), `billedQuantity?`, `unitPriceMinor?`, `servicePeriodStart?`, `servicePeriodEnd?`, `amountMinor`,
`amountReportingMinor`, `costCenterId?`, `fiscalYear`, `costReportingMinor`, `deductibleVatReportingMinor`.
Unique `(invoiceId, position)`; index `subscriptionId`, `(costCenterId, fiscalYear)`.

`costCenterId` null nghĩa là _Chưa phân bổ Cost Center_. Quan hệ tới `CostCenter` theo cách `BudgetCommitment` đang làm.

**`InvoiceTaxLine` → `invoice_tax_lines`:** khóa `(invoiceId, position)`, `taxType`, `rateBp`, `amountMinor`, `amountCurrency`,
`amountRate`, `amountRateDate`, `amountRateSource`, `amountReportingMinor`, `payer`, `deductible`, `cardFeeOrFx` (mặc định
`false`), `note?`.

Enum mới: `InvoiceKind` (`INVOICE`, `CREDIT_NOTE`); `InvoiceReconStatus` (`NONE`, `PARTIAL`, `FULL`);
`InvoiceTaxPayer` (`VENDOR_COLLECTS`, `BUYER_REMITS`). Dùng lại `PriceRateSource`.

Điểm khác Inventory, ghi vào spec:

- F-14: dòng thuế có đủ bộ tiền riêng, để `US-12-10` AC-7 kiểm chứng được.
- F-13: giá trị `payer` theo `TaxPayer` trong `src/modules/finance/public/finance.types.ts`.
- Người ghi dùng `recordedByEmployeeId`, là giá trị không khóa ngoại, theo `createdByEmployeeId` của `BudgetVersion`.
- Credit note lưu `amount_minor` dương; dấu do `kind` quyết định ở policy chi phí. `cost_reporting_minor` của dòng credit note là số
  âm để phép cộng `spent` tự đúng.
- `invoice_lines.amount_minor` được âm để ghi giảm giá, nên không có CHECK dấu.
- F-04: bốn cột `cost_center_id`, `fiscal_year`, `cost_reporting_minor`, `deductible_vat_reporting_minor` là bổ sung so với Inventory,
  để `spent` tính được theo Cost Center và năm.

Relation ngược ở `prisma/models/*.prisma` (`Organization`, `Vendor`, `Contract`, `Currency`, `Subscription`, `CostCenter`) chỉ thêm trường
quan hệ theo cách `BudgetCommitment` đang làm với `Currency`. Không đổi gì khác ở các model đó.

## Migration

Tạo `prisma/migrations/20261101100000_invoices/migration.sql`, timestamp phải lớn hơn migration cuối đang có.

Viết SQL tay cho phần Prisma không biểu diễn được:

```sql
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_link"
  CHECK ("kind" = 'CREDIT_NOTE' OR "credited_invoice_id" IS NULL);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_check" CHECK ("amount_minor" >= 0);
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_subject"
  CHECK (("subscription_id" IS NOT NULL) <> "out_of_catalog");
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_rate_range"
  CHECK ("rate_bp" BETWEEN 0 AND 10000);
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_amount_check"
  CHECK ("amount_minor" >= 0);
```

Không `GRANT`. Không backfill.

## Gate

Thêm `Invoice`, `InvoiceLine`, `InvoiceTaxLine` với giá trị `'budgets'` vào `PRISMA_MODEL_OWNER` ở
`test/gates/architecture-boundaries.gate-spec.ts`.

## Test

`test/integration/budgets/invoice-constraints.integration-spec.ts`, ghi SQL trực tiếp:

| Ca                                                   | Đáp án         |
| ---------------------------------------------------- | -------------- |
| `kind = INVOICE` có `credited_invoice_id`            | CHECK từ chối  |
| Dòng có `subscription_id` và `out_of_catalog = true` | CHECK từ chối  |
| Dòng không có cả hai                                 | CHECK từ chối  |
| `rate_bp = 10001`                                    | CHECK từ chối  |
| Trùng `organization, vendor, kind, invoice_number`   | unique từ chối |
| Cùng số, khác `kind`                                 | ghi được       |

## Verify

```powershell
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm test:gates
pnpm test:integration -- test/integration/budgets/invoice-constraints.integration-spec.ts
```

Trên database test mới: `pnpm db:migrate:deploy` rồi `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma --exit-code`.

## Xong khi

`migrate diff` không lệch, `pnpm check` xanh, chưa có code nghiệp vụ nào đọc ba bảng này.
