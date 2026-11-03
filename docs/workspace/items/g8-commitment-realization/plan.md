# Plan: Hóa đơn khớp chuyển khoản cam kết thành chi phí, một phần hoặc toàn bộ

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `in-progress` (B07-6 và B07-7 verified local 02/11/2026 trên cây chưa commit nhánh `hien-dev`; B07-8 đang tiếp tục). PR: chưa có.

## Before coding

`g8-invoice-recording` đã có ở nhánh đang làm; D5, D6 có câu trả lời. Đọc `budgets/README.md`, `budget/commitment.repo.ts`,
`budget/commitment-release.policy.ts`, `requests/spend/budget-check.policy.ts`, `requests/grant/access-request-grant.listener.ts` và test
`test/integration/budgets/` để biết hành vi đang giữ.

## Tasks

### Task 1: migration realization

- Files: `prisma/models/budgets.prisma`, `prisma/migrations/<timestamp>_commitment_realizations/migration.sql`, `PRISMA_MODEL_OWNER` ở
  `test/gates/architecture-boundaries.gate-spec.ts`.
- Depends on: `g8-invoice-recording` Task 1.
- Acceptance: cột, bảng, thay CHECK `budget_commitments_release_check`, thay hàm guard `budget_commitments_guard` (chặn giảm `realized_minor`), bảng `commitment_realizations` với `invoice_line_id` unique (F-01, F-21); bỏ trigger năm (F-10); hàng cũ giữ nguyên.
- Verify: integration ràng buộc đỏ-trước; migrate deploy trên CSDL mới, `migrate diff` không lệch.

### Task 2: công thức đang giữ

- Files: `src/modules/budgets/budget/commitment-release.policy.ts`, `commitment.repo.ts`, `commitment.dto.ts`, spec của chúng.
- Depends on: Task 1.
- Acceptance: `heldMinor = amount − released − realized`; `totals()` trừ cả `realizedMinor` cho `BudgetFactsRepo` và `BudgetViewService` (F-03); hành vi cũ không đổi khi `realized = 0`.
- Verify: `pnpm test -- src/modules/budgets`; `pnpm test:integration -- test/integration/budgets`.

### Task 3: nguồn thực chi

- Files: `src/modules/budgets/budget/budget-facts.repo.ts`, `budget/commitment.repo.ts`, lõi `src/modules/budgets/budget/invoice-spend.repo.ts`, `test/support/spend-harness.ts`.
- Depends on: Task 2.
- Acceptance: `spentMinor` một nguồn tính từ `invoice_lines` qua `invoice-spend.repo.ts` (F-04); `CommitmentTotals` thêm `deductibleVat`; `spend-harness.ts` ghi kèm hóa đơn (F-05); hồi quy G5 giữ nguyên khi chưa có hóa đơn; không đếm hai lần (F-06).
- Verify: `pnpm test:integration -- test/integration/requests test/integration/budgets`.

### Task 4: thao tác khớp

- Files: `src/modules/budgets/invoice/invoice-match.service.ts`, `commitment/commitment.service.ts`, `public/budgets.extension-points.ts`, `src/modules/requests/spend/commitment-vendor.listener.ts`, controller, dto, errors,
  `test/support/api-coverage-manifest.ts`.
- Depends on: Task 3.
- Acceptance: `US-06-06` AC-1, AC-5; `US-12-02` AC-4, AC-8; khớp theo dòng không có trường số tiền (F-09); hook tra vendor `CommitmentVendorHook` (F-22); hỗ trợ khớp ngay khi ghi qua `POST /invoices` (F-24); `lockOfRequest` có khóa (F-11); từ chối; quyền.
- Verify: `pnpm test:http -- test/http/budgets`; integration; `pnpm arch:routes`; `pnpm openapi:export`.

### Task 5: thất bại sau khi đã chi một phần

- Files: test ở `test/integration/requests/`; sửa nguồn chỉ nếu test đỏ cho thấy thiếu.
- Depends on: Task 4.
- Acceptance: `US-06-06` AC-9; Finance được báo.
- Verify: `pnpm test:integration -- test/integration/requests`.

### Task 6: credit note

- Files: `src/modules/budgets/invoice/*`.
- Depends on: Task 4.
- Acceptance: `US-06-06` AC-11.
- Verify: integration module `budgets`.

### Checkpoint

Sau Task 3 và Task 6: `pnpm check`, `pnpm test:http`, `pnpm test:integration`, `pnpm test:integration:serial`; tự review diff theo AC, đặc biệt
mọi nơi đọc `spentMinor`.

## Verification and handoff

Lệnh theo CONTRIBUTING và [test guide](../../../../test/README.md), chạy từ gốc BE trên CSDL riêng (slm-test-db PostgreSQL 17 trên port 55432). Agent: DeepSeek-V3.

| Lệnh / kiểm tra AC                                                                                 | Revision / môi trường                       | Kết quả thực chạy                                                                                                         | Giới hạn / việc còn lại      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| B07-6: Ràng buộc DB realization (CHECK, trigger guard, append-only realization)                    | `hien-dev`, PostgreSQL 17 `127.0.0.1:55432` | `pnpm test:integration -- test/integration/budgets/commitment-realization-constraints.integration-spec.ts` → 20/20 passed | Đã xong phần migration B07-6 |
| B07-6: Công thức đang giữ `held = amount - released - realized` (F-03)                             | `hien-dev`, unit                            | `pnpm test -- src/modules/budgets/budget/commitment-release.policy.spec.ts` → 19/19 passed                                | Đã xong Task 2               |
| B07-7: Nguồn thực chi tính từ `invoice_lines` qua `InvoiceSpendRepo` (F-04)                        | `hien-dev`, PostgreSQL 17 `127.0.0.1:55432` | `pnpm test:integration -- test/integration/budgets/commitment-totals.integration-spec.ts` → 7/7 passed                    | Đã xong Task 3               |
| B07-7: `BudgetViewService.table` thêm `deductibleVat` không trừ vào `remaining` (`US-06-09` AC-12) | `hien-dev`, unit + integration              | Đã kiểm chứng qua `commitment-totals.integration-spec.ts` và `openapi:export`                                             | Đã xong Task 3               |
| B07-7: `spend-harness.ts` ghi hóa đơn thật khi `EXPENSED` (F-05)                                   | `hien-dev`, PostgreSQL 17 `127.0.0.1:55432` | `pnpm test:integration -- test/integration/requests --maxWorkers=4` → 84 suites, 1132 passed                              | Đã xong Bước 6 B07-7         |
| Regression toàn bộ integration `budgets`                                                           | `hien-dev`, PostgreSQL 17 `127.0.0.1:55432` | `pnpm test:integration -- test/integration/budgets` → 13 suites, 188 passed                                               | Đã xong                      |
| Regression toàn bộ integration `requests`                                                          | `hien-dev`, PostgreSQL 17 `127.0.0.1:55432` | `pnpm test:integration -- test/integration/requests --maxWorkers=4` → 84 suites, 1132 passed                              | Đã xong                      |
| Kiểm tra kiến trúc và capability graph không vòng                                                  | `hien-dev`                                  | `pnpm arch:capabilities --module budgets` → 7 capabilities, 0 cycles; `pnpm test:gates` → 16 suites, 317 passed           | Đã xong                      |

- [x] AC trong scope (B07-6, B07-7, US-06-09 AC-12) có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [ ] Spec/plan/test design phản ánh đúng implementation cuối; peer review nếu có đã xử lý hoặc ghi disposition (chờ hoàn tất B07-8).
- [ ] Diff cuối đã tự review; tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể; cập nhật roadmap/PR. Chỉ ghi `merged-dev`, `accepted`, `released` sau đúng sự kiện thật.
