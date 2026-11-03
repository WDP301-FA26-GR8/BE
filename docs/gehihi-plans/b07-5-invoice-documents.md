# B07-5 — Gắn tệp gốc và chứng từ thuế vào hóa đơn

| Gói  | Hạng mục               | AC                                                                 | Loại   | Cổng vào                  |
| ---- | ---------------------- | ------------------------------------------------------------------ | ------ | ------------------------- |
| B-07 | `g8-invoice-recording` | `US-12-10` AC-5; `US-04-04` AC-4, AC-7; `US-01-12` AC-10, Task 6+7 | `CODE` | B07-2 xong; Q-10 đã báo A |

`catalog` là phần của A. Chỉ thêm, trừ đúng một luật siết có căn cứ ở mục dưới. Báo A trước khi sửa `catalog`.

## Đọc trước

- `src/modules/catalog/contract/document.service.ts`, nhất là `attach`
- `src/modules/catalog/contract/contract.policy.ts`: `PURPOSE_ROLES`, `assertPurposeAvailable`, `mayOpen`
- `src/modules/catalog/contract/document.repo.ts`, `documents.controller.ts`
- `prisma/migrations/20261020250000_catalog_contracts_and_documents/migration.sql`
- `test/support/document-harness.ts`

## Hướng phụ thuộc

`budgets` (T5) gọi xuống `catalog` (T4). `catalog` không biết `invoices`, không đọc bảng đó.

```text
POST /invoices/{id}/documents  →  budgets kiểm hóa đơn  →  CatalogApi.attachDocumentToInvoice(tx, actor, ...)
```

## Migration

`prisma/migrations/<timestamp>_invoice_documents/migration.sql`:

```sql
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
```

Đối chiếu tên CHECK với migration gốc trước khi chạy. Thêm cột và relation vào Prisma. `proof_document_id` là bổ sung so với
Inventory (F-15), ghi vào spec. Hàng cũ vẫn hợp lệ vì `invoice_id` đều null.

## Code `catalog`

`contract.policy.ts`:

- Thêm `ATTACHES_TO_INVOICE = PURCHASE_DOCUMENT, TAX_PAYMENT_PROOF`.
- `assertPurposeAvailable` nhận cả hai tập. `PURPOSE_ROLES` giữ nguyên.
- Thêm `assertMayAttachTo(purpose, target, roles)` theo bảng mục đích của `US-04-04` (F-17):

  | Mục đích              | Đích     | Vai được gắn          |
  | --------------------- | -------- | --------------------- |
  | `CONTRACT_ATTACHMENT` | hợp đồng | `IT_ADMIN`, `FINANCE` |
  | `PURCHASE_DOCUMENT`   | hợp đồng | `IT_ADMIN`            |
  | `PURCHASE_DOCUMENT`   | hóa đơn  | `FINANCE`             |
  | `TAX_PAYMENT_PROOF`   | hóa đơn  | `FINANCE`             |

- `mayOpen` giữ nguyên: nó đã cho `IT_ADMIN`, `FINANCE` mở và từ chối vai khác, đúng `US-04-04` AC-7.

`document.service.ts`: thêm `attachToInvoice(tx, actor, documentId, invoiceId)`. Dùng lại `assertAttachable` và kiểm người tải
lên như `attach`. Bọc bằng hàm mới trong `CatalogApi`. Không đổi chữ ký `attach`, nhưng `attach` gọi thêm `assertMayAttachTo`.

## Code `budgets`

Trong `src/modules/budgets/invoice/`, thêm service gắn tệp:

- `POST /invoices/{id}/documents` body `{ documentId, taxLinePosition? }`, `@RequireRoles('FINANCE')`.
- Khóa hàng hóa đơn; không có thì `INVOICE.NOT_FOUND`.
- `taxLinePosition` có giá trị: dòng phải tồn tại và có `payer = BUYER_REMITS`, ghi `proof_document_id`.
- Audit `INVOICE.DOCUMENT_ATTACHED`.
- `GET /invoices/{id}/documents`, `FINANCE`, `IT_ADMIN`: danh sách tệp, gồm cả chứng từ thuế. Mở tệp dùng route `/documents/{id}/links`
  có sẵn.

IT Admin đính hóa đơn bị từ chối theo `US-01-12` AC-10 nhờ `@RequireRoles('FINANCE')`.

**Test cũ phải đổi, có căn cứ:** ca `US-04-04 AC-9` ở `test/integration/catalog/document-http.integration-spec.ts` đang để Finance gắn tệp
`PURCHASE_DOCUMENT` vào hợp đồng, vì lúc viết chưa có hóa đơn. Sửa ca đó sang gắn vào hóa đơn. Test khác của `catalog` đỏ thì xử lý theo
luật sửa ngoài plan ở `00-agent-rules.md`.

## Test

| AC               | Tình huống                                                          | Tầng               | Đáp án                                             |
| ---------------- | ------------------------------------------------------------------- | ------------------ | -------------------------------------------------- |
| `US-04-04` AC-4  | Hóa đơn chưa có Contract, Finance đính tệp gốc                      | integration        | Lưu được, tệp thuộc hóa đơn, trạng thái `READY`    |
| `US-04-04` AC-7  | Finance gắn chứng từ thuế; IT Admin mở; trưởng phòng mở             | integration        | Finance, IT Admin mở được; trưởng phòng 403        |
| `US-04-04` AC-7  | IT Admin chọn mục đích `TAX_PAYMENT_PROOF` khi tải lên              | HTTP               | Từ chối                                            |
| `US-12-10` AC-5  | Gắn vào dòng thuế `BUYER_REMITS`                                    | integration        | Dòng trỏ tới tệp, tệp hiện ở danh sách của hóa đơn |
| Sai dòng         | Gắn vào dòng `VENDOR_COLLECTS`                                      | integration        | Từ chối                                            |
| `US-01-12` AC-10 | IT Admin đính hóa đơn; Finance gắn `PURCHASE_DOCUMENT` vào hợp đồng | HTTP + integration | Từ chối                                            |
| `US-01-12` AC-10 | IT Admin gắn báo giá vào hợp đồng; Finance gắn hóa đơn              | integration        | Lưu được                                           |
| Giữ nguyên       | Finance gắn `CONTRACT_ATTACHMENT` vào hợp đồng                      | integration        | Lưu được                                           |
| CHECK            | Ghi SQL tệp có cả `contract_id` và `invoice_id`                     | integration        | CHECK từ chối                                      |
| Hồi quy          | Luồng tệp hợp đồng hiện có                                          | integration        | `test/integration/catalog` vẫn xanh                |

## Tài liệu

- `src/modules/budgets/README.md`: capability `invoice/`, bảng mới, phụ thuộc.
- `src/modules/catalog/README.md`: hàm facade mới.
- `docs/decisions/0016-budgets-context.md`: chú thích `budgets` sở hữu hóa đơn.

## Verify

```powershell
pnpm test:integration -- test/integration/catalog
pnpm test:integration -- test/integration/budgets
pnpm test:http -- test/http/budgets
pnpm check
pnpm openapi:export
pnpm arch:routes
pnpm arch:graph
```

## Xong khi

Hạng mục `g8-invoice-recording` đủ bằng chứng để chạy `pnpm test:http`, `pnpm test:integration`, `pnpm test:integration:serial`,
`pnpm test:e2e` và bàn giao. Không tự ghi `verified` nếu chưa chạy các lệnh đó.
