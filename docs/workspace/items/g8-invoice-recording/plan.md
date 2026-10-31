# Plan: Finance ghi hóa đơn, dòng hóa đơn và dòng thuế đúng chứng từ

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `not-started`. PR: chưa có.

## Before coding

Đọc AGENTS.md, CONTRIBUTING.md, [hướng dẫn dev mới](../../../guides/huong-dan-dev-moi.md), [module structure](../../../rules/module-structure.md),
[API rules](../../../rules/api-contract.md), [database rules](../../../rules/database-business.md), [security rules](../../../rules/security-jobs.md), module
card `budgets`. Có câu trả lời D2. Đọc kỹ `catalog/contract/document.service.ts` để chốt cách gắn tệp; đối chiếu Logical ERD 7.103–7.105 ở Docs `d6d868c`.
Chuẩn bị PostgreSQL riêng theo [test guide](../../../../test/README.md). [Demo dataset](../../../guides/demo-dataset.md) không có hóa đơn: test tự dựng dữ liệu.

## Tasks

### Task 1: migration ba bảng hóa đơn

- Files: `prisma/models/budgets.prisma`, `prisma/migrations/<timestamp>_invoices/migration.sql`, `PRISMA_MODEL_OWNER` ở
  `test/gates/architecture-boundaries.gate-spec.ts`.
- Depends on: none.
- Acceptance: bảng, enum, CHECK và chỉ mục khớp Logical ERD; role runtime có quyền theo H7.
- Verify: `pnpm test:gates`; `pnpm test:integration -- test/integration/budgets` với ca CHECK đỏ-trước; migrate deploy trên CSDL mới, `migrate diff` không
  lệch.

### Task 2: policy chi phí thực chịu

- Files: `src/modules/budgets/invoice/invoice-cost.policy.ts` và spec.
- Depends on: none.
- Acceptance: `US-12-10` AC-4, AC-6; không làm tròn ở phép cộng minor units.
- Verify: `pnpm test -- src/modules/budgets/invoice` → đỏ trước, xanh sau.

### Task 3: ghi hóa đơn

- Files: `src/modules/budgets/invoice/{invoice.service,invoice.repo,invoice.dto,invoice.errors,invoice.http-errors,invoices.controller}.ts`,
  `src/modules/budgets/budgets.module.ts`, `test/support/api-coverage-manifest.ts`.
- Depends on: Task 1, Task 2.
- Acceptance: `US-12-10` AC-1, AC-7, AC-10, AC-11; `US-12-02` AC-9; trùng hóa đơn; hoàn tác.
- Verify: `pnpm test:http -- test/http/budgets`; `pnpm test:integration -- test/integration/budgets`; `pnpm arch:routes`.

### Task 4: sửa dòng thuế và cờ mặc định

- Files: `src/modules/budgets/invoice/invoice-tax-line.service.ts`, controller; route `tax-defaults` đặt ở `invoices.controller.ts` hoặc cạnh
  `/vendors/{id}/tax-profile` trong `catalog/vendor/`, chốt theo route gần nhất.
- Depends on: Task 3.
- Acceptance: `US-12-10` AC-2, AC-3; đổi hồ sơ thuế sau đó không chạm hóa đơn đã ghi.
- Verify: `pnpm test:integration -- test/integration/budgets` → audit có trước/sau.

### Task 5: đọc hóa đơn

- Files: `src/modules/budgets/invoice/invoice-query.service.ts`, `invoice.mapper.ts`, controller, `test/support/api-coverage-manifest.ts`.
- Depends on: Task 3.
- Acceptance: list/detail/subresource theo `API-LIST-DETAIL.1`, trang và tổng cùng snapshot; IT Admin đọc được, các vai khác bị từ chối.
- Verify: `pnpm test:http`, gate list/detail, `pnpm arch:routes`, `pnpm openapi:export`.

### Task 6: gắn tệp gốc và chứng từ thuế

- Files: `src/modules/catalog/contract/*` (chủ sở hữu tệp), `prisma/migrations/*` (khóa ngoại), `src/modules/budgets/invoice/*`.
- Depends on: Task 3.
- Acceptance: `US-12-10` AC-5; `US-04-04` AC-4, AC-7.
- Verify: `pnpm test:integration -- test/integration/catalog test/integration/budgets`.

### Task 7: cập nhật tài liệu module

- Files: `src/modules/budgets/README.md`, `docs/decisions/0016-budgets-context.md`, `docs/generated/routes.md`.
- Depends on: Task 5, Task 6.
- Acceptance: module card ghi capability và bảng mới; ADR-0016 có chú thích: `budgets` sở hữu hóa đơn và đang import `catalog`, khác câu cũ ở mục 2.
- Verify: `pnpm arch:docs:check`, `pnpm rules:check`, `pnpm rules:format`.

### Checkpoint

Sau Task 3 và Task 6: `pnpm check`, `pnpm test:http`, `pnpm openapi:export`, integration module `budgets`, `catalog`; tự review diff theo AC.

## Verification and handoff

Lệnh theo CONTRIBUTING và [test guide](../../../../test/README.md), chạy từ gốc BE: `pnpm check`, `pnpm test:http`, `pnpm openapi:export`,
`pnpm test:integration`, `pnpm test:integration:serial`, `pnpm test:e2e` trên CSDL riêng.

| Lệnh / kiểm tra AC                                  | Revision / môi trường          | Kết quả thực chạy      | Giới hạn / việc còn lại    |
| --------------------------------------------------- | ------------------------------ | ---------------------- | -------------------------- |
| `node scripts/check-rules.mjs`, `pnpm rules:format` | Cây làm việc trên BE `d6c2112` | ghi ở bàn giao bước 01 | chỉ kiểm cấu trúc tài liệu |

- [ ] AC trong scope có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [ ] Spec/plan/test design phản ánh đúng implementation cuối; peer review nếu có đã xử lý hoặc ghi disposition.
- [ ] Diff cuối đã tự review; tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể; cập nhật roadmap/PR. Chỉ ghi `merged-dev`, `accepted`, `released` sau
      đúng sự kiện thật.
