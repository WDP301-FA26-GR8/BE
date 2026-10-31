# Plan: Hóa đơn khớp chuyển khoản cam kết thành chi phí, một phần hoặc toàn bộ

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `not-started`. PR: chưa có.

## Before coding

`g8-invoice-recording` đã có ở nhánh đang làm; D5, D6 có câu trả lời. Đọc `budgets/README.md`, `budget/commitment.repo.ts`,
`budget/commitment-release.policy.ts`, `requests/spend/budget-check.policy.ts`, `requests/grant/access-request-grant.listener.ts` và test
`test/integration/budgets/` để biết hành vi đang giữ.

## Tasks

### Task 1: migration realization

- Files: `prisma/models/budgets.prisma`, `prisma/migrations/<timestamp>_commitment_realizations/migration.sql`, `PRISMA_MODEL_OWNER` ở
  `test/gates/architecture-boundaries.gate-spec.ts`.
- Depends on: `g8-invoice-recording` Task 1.
- Acceptance: cột, bảng, CHECK, trigger năm đúng Logical; hàng cũ giữ nguyên.
- Verify: integration ràng buộc đỏ-trước; migrate deploy trên CSDL mới, `migrate diff` không lệch.

### Task 2: công thức đang giữ

- Files: `src/modules/budgets/budget/commitment-release.policy.ts`, `commitment.repo.ts`, `commitment.dto.ts`, spec của chúng.
- Depends on: Task 1.
- Acceptance: `heldMinor = amount − released − realized`; hành vi cũ không đổi khi `realized = 0`.
- Verify: `pnpm test -- src/modules/budgets`; `pnpm test:integration -- test/integration/budgets`.

### Task 3: nguồn thực chi

- Files: `src/modules/budgets/budget/budget-facts.repo.ts`, `budget/commitment.repo.ts`, `src/modules/budgets/invoice/invoice.repo.ts`.
- Depends on: Task 2.
- Acceptance: `spentMinor` một nguồn; hồi quy G5 giữ nguyên khi chưa có hóa đơn; không đếm hai lần.
- Verify: `pnpm test:integration -- test/integration/requests test/integration/budgets`.

### Task 4: thao tác khớp

- Files: `src/modules/budgets/invoice/invoice-match.service.ts`, `commitment/commitment.service.ts`, controller, dto, errors,
  `test/support/api-coverage-manifest.ts`.
- Depends on: Task 3.
- Acceptance: `US-06-06` AC-1, AC-5; `US-12-02` AC-4, AC-8; từ chối; quyền.
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

Lệnh theo CONTRIBUTING và [test guide](../../../../test/README.md), chạy từ gốc BE trên CSDL riêng.

| Lệnh / kiểm tra AC | Revision / môi trường | Kết quả thực chạy | Giới hạn / việc còn lại  |
| ------------------ | --------------------- | ----------------- | ------------------------ |
| —                  | —                     | chưa chạy         | hạng mục chưa triển khai |

- [ ] AC trong scope có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [ ] Spec/plan/test design phản ánh đúng implementation cuối; peer review nếu có đã xử lý hoặc ghi disposition.
- [ ] Diff cuối đã tự review; tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể; cập nhật roadmap/PR. Chỉ ghi `merged-dev`, `accepted`, `released` sau
      đúng sự kiện thật.
