# Báo Dev A và Owner: Thay đổi catalog, budgets và migration hóa đơn (B07-5)

- Ngày: 01/11/2026.
- Nhánh: `hien-dev`.
- Hạng mục: B07-5 (Gắn tệp gốc và chứng từ thuế vào hóa đơn).
- Phạm vi sửa: `catalog` (phần của Dev A), `budgets`, migration `20261101110000_invoice_documents`, tài liệu và tests.

## Lý do và chi tiết thay đổi

1. **Migration `20261101110000_invoice_documents`**:
   - Thêm cột `invoice_id UUID` vào bảng `document_attachments`.
   - Cập nhật CHECK constraint `document_attachments_owner_state`:
     READY khi và chỉ khi đúng một trong `contract_id`, `invoice_id` có giá trị (`num_nonnulls = 1`).
   - Cập nhật CHECK constraint `document_attachments_purpose_fits_owner`:
     Hợp đồng cho phép `CONTRACT_ATTACHMENT`, `PURCHASE_DOCUMENT`; hóa đơn cho phép `PURCHASE_DOCUMENT`, `TAX_PAYMENT_PROOF`.
   - Tạo index `document_attachments_invoice_id_idx`.
   - Thêm quan hệ FK `document_attachments_invoice_id_fkey` trỏ về `invoices(id)`.
   - Thêm cột `proof_document_id UUID` vào `invoice_tax_lines` có FK trỏ về `document_attachments(id)`.

2. **Code `catalog`**:
   - `src/modules/catalog/contract/contract.policy.ts`:
     - Thêm tập `ATTACHES_TO_INVOICE = Set(['PURCHASE_DOCUMENT', 'TAX_PAYMENT_PROOF'])`.
     - Cập nhật `assertPurposeAvailable` chấp nhận cả hai tập (`ATTACHES_TO_CONTRACT` và `ATTACHES_TO_INVOICE`).
     - Thêm hàm `assertMayAttachTo(purpose, target, roles)` thực thi phân quyền gắn tệp theo `US-04-04` (F-17) và `US-01-12` AC-10:
       - (`CONTRACT_ATTACHMENT`, CONTRACT) -> `IT_ADMIN`, `FINANCE`.
       - (`PURCHASE_DOCUMENT`, CONTRACT) -> `IT_ADMIN` (từ chối `FINANCE`).
       - (`PURCHASE_DOCUMENT`, INVOICE) -> `FINANCE` (từ chối `IT_ADMIN`).
       - (`TAX_PAYMENT_PROOF`, INVOICE) -> `FINANCE` (từ chối `IT_ADMIN`).
   - `src/modules/catalog/contract/document.repo.ts`:
     - Thêm trường `invoiceId: string | null` vào `DocumentRecord`.
     - Thêm hàm `markAttachedToInvoice(tx, id, invoiceId, now)`.
     - Thêm hàm `findByInvoiceId(invoiceId, tx?)`.
   - `src/modules/catalog/contract/document.service.ts`:
     - Thêm kiểm tra `assertMayAttachTo(current.purpose, 'CONTRACT', actor.roles)` vào hàm `attach`.
     - Thêm hàm `attachToInvoice(tx, actor, id, invoiceId)` dùng lại `assertAttachable`, kiểm uploader và quyền gắn hóa đơn, ghi audit `DOCUMENT.ATTACHED`.
     - Thêm hàm `listForInvoice(invoiceId, tx?)`.
   - `src/modules/catalog/public/catalog.types.ts`:
     - Khai báo kiểu công khai `AttachedDocument`.
   - `src/modules/catalog/public/catalog.errors.ts`:
     - Khai báo các class lỗi công khai: `DocumentNotFoundError`, `DocumentPurposeForbiddenError`, `DocumentAlreadyAttachedError`, `DocumentNotReadyToAttachError`.
   - `src/modules/catalog/public/catalog.api.ts`:
     - Inject `DocumentService` vào facade `CatalogApi`.
     - Mở hàm công khai `attachDocumentToInvoice(tx, actor, documentId, invoiceId)`.
     - Mở hàm công khai `getInvoiceDocuments(invoiceId, tx?)`.

3. **Code `budgets`**:
   - Thêm `src/modules/budgets/invoice/invoice-document.service.ts`:
     - `attach(actor, invoiceId, input)`: khóa hóa đơn (`InvoiceNotFoundError`), kiểm dòng thuế nếu có (`taxLinePosition`: phải tồn tại và `payer = BUYER_REMITS`, ghi `proof_document_id`), gọi `CatalogApi.attachDocumentToInvoice`, ghi audit `INVOICE.DOCUMENT_ATTACHED`.
     - `list(invoiceId, query)`: kiểm hóa đơn tồn tại, lấy danh sách tệp đính kèm từ `CatalogApi.getInvoiceDocuments`, phân trang.
   - Thêm routes trong `src/modules/budgets/invoice/invoices.controller.ts`:
     - `POST /api/v1/invoices/:id/documents`: `@RequireRoles('FINANCE')`, body `{ documentId, taxLinePosition? }`.
     - `GET /api/v1/invoices/:id/documents`: `@RequireRoles('FINANCE', 'IT_ADMIN')`, phân trang.
   - Bổ sung repo `src/modules/budgets/invoice/invoice.repo.ts`: `lockInvoice`, `findTaxLine`, `linkProofDocument`, `findInvoice`.
   - Bổ sung DTOs trong `src/modules/budgets/invoice/invoice.dto.ts`.
   - Bổ sung domain errors trong `invoice.errors.ts` và mapping trong `invoice.http-errors.ts`.
   - Đăng ký `InvoiceDocumentService` vào `budgets.module.ts`.

4. **Sửa test cũ có căn cứ**:
   - Sửa ca `US-04-04 AC-9` trong `test/integration/catalog/document-http.integration-spec.ts`: Finance gắn tệp `PURCHASE_DOCUMENT` sang gắn vào hóa đơn (thay vì hợp đồng) theo bảng mục đích `US-04-04`.

5. **Tài liệu**:
   - `src/modules/budgets/README.md`: thêm bảng `invoices`, `invoice_lines`, `invoice_tax_lines` và capability `invoice/`.
   - `src/modules/catalog/README.md`: thêm hàm facade `attachDocumentToInvoice`, `getInvoiceDocuments`.
   - `docs/decisions/0016-budgets-context.md`: ghi chú `budgets` sở hữu hóa đơn theo phân tầng T5.

## Kiểm chứng

| Lệnh / kiểm tra                                                                           | Kết quả                                       |
| ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| `pnpm prisma:format`                                                                      | PASS                                          |
| `pnpm prisma:validate`                                                                    | PASS, schemas at prisma are valid             |
| `pnpm prisma:generate`                                                                    | PASS, generated Prisma Client 7.9.1           |
| `pnpm test -- src/modules/catalog/contract`                                               | 67/67 pass, 1 suite                           |
| `pnpm test -- src/modules/budgets/invoice`                                                | 18/18 pass, 2 suites                          |
| `pnpm test` (unit tests toàn repo)                                                        | 4039/4039 pass, 279 suites                    |
| `pnpm test:http -- test/http/budgets`                                                     | 44/44 pass, 2 suites                          |
| `pnpm test:integration -- test/integration/budgets/invoice-documents.integration-spec.ts` | 9/9 pass, 1 suite                             |
| `pnpm test:integration -- test/integration/budgets`                                       | 160/160 pass, 10 suites                       |
| `pnpm test:integration -- test/integration/catalog/document`                              | 51/51 pass, 4 suites                          |
| `pnpm typecheck`                                                                          | PASS (tsc --noEmit exit 0)                    |
| `pnpm lint`                                                                               | PASS (eslint exit 0)                          |
| `pnpm test:gates`                                                                         | 317/317 pass, 16 suites                       |
| `pnpm arch:check`                                                                         | PASS (no dependency violations)               |
| `pnpm rules:check`                                                                        | PASS (0 errors)                               |
| `pnpm format:check`                                                                       | PASS (all files use Prettier style)           |
| `pnpm openapi:export`                                                                     | PASS (290 operations)                         |
| `pnpm arch:routes`                                                                        | PASS (docs/generated/routes.md updated)       |
| `pnpm arch:graph`                                                                         | PASS (docs/generated/module-graph.md written) |
| `pnpm build`                                                                              | PASS                                          |
