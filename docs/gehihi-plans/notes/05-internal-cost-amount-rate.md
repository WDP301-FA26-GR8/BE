# Note 05: Định dạng chuỗi thập phân cho amountRate trong chi phí nội bộ

- **Agent / model:** AG/GEMINI-3.8-FLASH-HIGH.
- **Người thực hiện:** Dev B (nhánh `hien-dev`).
- **Hạng mục nguồn:** B07-10 (`g8-internal-cost-entry`).
- **Module tác động:** `budgets` (`src/modules/budgets/internal-cost/internal-cost.service.ts`, `internal-cost.repo.ts`, `internal-cost.service.spec.ts`).

## 1. Hỏng gì và vì sao sửa

Tại `internal-cost.service.ts:86`, trường `amountRate` trước đây dùng `snapshot.snapshot.rate as any`. Việc ép kiểu `as any` đã che giấu sự sai lệch kiểu dữ liệu: `snapshot.snapshot.rate` là một `ScaledRate` (`bigint`, biểu diễn tỷ giá nhân với $10^{10}$, ví dụ tỷ giá 25.000 được lưu dưới dạng `25_000_0000000000n`).

Trong schema cơ sở dữ liệu (`prisma/migrations/20261102100000_internal_cost_entries/migration.sql`), cột `amount_rate` có kiểu `DECIMAL(20, 10)`. Nếu để giá trị `bigint` `25000000000000n` đi thẳng vào cột Decimal của Prisma/PostgreSQL, nó sẽ bị ghi nhận thành số $25.000.000.000.000$ thay vì tỷ giá $25.000$, làm sai lệch toàn bộ dữ liệu tỷ giá quy đổi của bản ghi chi phí nội bộ.

## 2. Phần đã sửa

1. `src/modules/budgets/internal-cost/internal-cost.service.ts`:
   - Dùng `formatRate(snapshot.snapshot.rate)` từ `src/core/money/rate` (đồng nhất với cách `invoice.repo.ts` đang làm) để chuyển đổi `ScaledRate` thành chuỗi số thập phân chuẩn (ví dụ `25_000_0000000000n` thành `'25000'`, tỷ giá `SAME_CURRENCY` thành `'1'`).
2. `src/modules/budgets/internal-cost/internal-cost.repo.ts`:
   - Nới kiểu `amountRate` trong interface `CreateInternalCostRecord` thành `Prisma.Decimal | string`.
3. `src/modules/budgets/internal-cost/internal-cost.service.spec.ts`:
   - Bổ sung unit test kiểm chứng giá trị `amountRate` truyền vào `repo.insert` luôn là chuỗi thập phân đúng.

**Lưu ý:** Đây là sửa đổi hành vi logic (bug fix) phát hiện trong lúc dọn lỗi ESLint `no-explicit-any`. Thay đổi này mới được kiểm chứng ở cấp unit test với mock repo, **chưa kiểm chứng trên PostgreSQL thật** (do suite integration `internal-cost.integration-spec.ts` hoãn tới đợt test cuối).

## 3. Lệnh kiểm chứng và kết quả

- `node node_modules/jest/bin/jest.js src/modules/budgets/internal-cost/internal-cost.service.spec.ts --runInBand` → PASS (2/2 tests passed).
- `node node_modules/eslint/bin/eslint.js src/modules/budgets/internal-cost/*.ts` → PASS (exit code 0, 0 errors).
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → PASS (exit code 0).
