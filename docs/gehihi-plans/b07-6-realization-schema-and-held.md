# B07-6 — Schema thực hiện cam kết và công thức đang giữ

| Gói  | Hạng mục                    | AC                     | Loại   | Cổng vào        |
| ---- | --------------------------- | ---------------------- | ------ | --------------- |
| B-07 | `g8-commitment-realization` | nền, Task 1+2 của plan | `CODE` | B07-2, P01 xong |

Đây là thay đổi rủi ro cao vì chạm công thức G5 đang chạy. **Khi `realized = 0` hành vi phải y hệt trước.** Chưa có route.

## Đọc trước

- Spec, plan hạng mục; `01-design-corrections.md` F-01, F-02, F-03, F-05
- `prisma/migrations/20261024010000_budgets_commitment_release/migration.sql`: CHECK và hàm guard
- `src/modules/budgets/budget/commitment-release.policy.ts`, `commitment.repo.ts`
- `src/modules/budgets/commitment/commitment.service.ts`, `commitment.dto.ts`
- `src/modules/budgets/budget-view/budget-view.service.ts`
- `test/support/spend-harness.ts`, hàm `commit`

## Migration

`prisma/migrations/<timestamp>_commitment_realizations/migration.sql`. Chạy theo đúng thứ tự:

1. `ALTER TABLE "budget_commitments" ADD COLUMN "realized_minor" BIGINT NOT NULL DEFAULT 0;`

2. Hàng cũ `EXPENSED` cần giá trị để qua CHECK mới. Trước khi thêm CHECK:

   ```sql
   UPDATE "budget_commitments"
      SET "realized_minor" = "amount_minor" - "released_minor"
    WHERE "state" = 'EXPENSED';
   ```

   Trigger guard hiện từ chối update trên hàng không `HELD`, nên phải tạm tắt đúng trigger đó quanh câu lệnh này:
   `ALTER TABLE ... DISABLE TRIGGER budget_commitments_guard_row;` rồi `ENABLE`. Production không có hàng `EXPENSED` nào vì source
   chưa có đường ghi, nhưng migration vẫn phải an toàn. Ghi lý do trong comment SQL.

3. Thay CHECK:

   ```sql
   ALTER TABLE "budget_commitments" DROP CONSTRAINT "budget_commitments_release_check";
   ALTER TABLE "budget_commitments" ADD CONSTRAINT "budget_commitments_release_check" CHECK (
     "released_minor" >= 0 AND "realized_minor" >= 0
     AND "released_minor" + "realized_minor" <= "amount_minor"
     AND (
       ("state" = 'RELEASED' AND "released_minor" = "amount_minor" AND "realized_minor" = 0 AND "released_at" IS NOT NULL)
       OR ("state" = 'HELD' AND "released_minor" + "realized_minor" < "amount_minor" AND "released_at" IS NULL)
       OR ("state" = 'EXPENSED' AND "realized_minor" > 0
           AND "released_minor" + "realized_minor" = "amount_minor" AND "released_at" IS NULL)
     )
   );
   ```

4. `CREATE OR REPLACE FUNCTION budget_commitments_guard()`: **chép nguyên thân hiện có**, chỉ thêm:

   ```sql
   IF NEW.realized_minor < OLD.realized_minor THEN
     RAISE EXCEPTION 'what became an expense does not go back (UPDATE rejected)'
       USING ERRCODE = 'restrict_violation';
   END IF;
   ```

5. Tạo `commitment_realizations`: `id`, `commitment_id`, `invoice_line_id` NOT NULL **UNIQUE** (F-21), `amount_minor` (> 0),
   `recorded_at`, `recorded_by_employee_id`. Chỉ mục `commitment_id`. Cấm update/delete bằng trigger, theo mẫu
   `budget_commitment_releases_no_update_delete` cùng migration trên.

   Không tạo `purchase_document_id` ở đây; B07-11 thêm và khi đó `invoice_line_id` mới được nullable. Không tạo `cancelled_at`,
   `cancel_reason` vì gợi ý D6 là không có hủy khớp. Không tạo trigger năm (F-10).

Thêm `realizedMinor` và model vào `prisma/models/budgets.prisma`, `CommitmentRealization` vào `PRISMA_MODEL_OWNER`.

## Code

`commitment-release.policy.ts`:

```ts
export interface CommitmentRow {
  id: string;
  year: number;
  amountMinor: bigint;
  releasedMinor: bigint;
  realizedMinor: bigint;
  state: 'HELD' | 'RELEASED' | 'EXPENSED';
}
export const heldOf = (row: CommitmentRow): bigint => row.amountMinor - row.releasedMinor - row.realizedMinor;
```

`commitment.repo.ts`:

- `ofRequest`, `lockById`: trả thêm `realizedMinor`.
- `release()` (F-02):

  ```ts
  const releasedMinor = row.releasedMinor + input.takeMinor;
  const heldMinor = row.amountMinor - releasedMinor - row.realizedMinor;
  const ended = heldMinor === 0n;
  const state = !ended ? 'HELD' : row.realizedMinor > 0n ? 'EXPENSED' : 'RELEASED';
  ```

  `releasedAt` chỉ đặt khi `state === 'RELEASED'`. `where` của `updateMany` thêm `realizedMinor: row.realizedMinor`. Giá trị trả
  về `released` nghĩa là khoản không còn giữ gì; kiểm chỗ dùng `ReleasedCommitment.released` có còn đúng.

- `totals()` (F-03): `_sum` thêm `realizedMinor`; `held` = `amount − released − realized`. Phần `spent` **giữ nguyên ở plan
  này**, B07-7 mới đổi.

`commitment.dto.ts`, phần đọc: thêm `realized`, không bỏ trường cũ.

Tìm mọi chỗ tính `amountMinor - releasedMinor` bằng tìm kiếm toàn `src/modules/budgets`, đưa về `heldOf`.

## Cập nhật fixture có căn cứ (F-05)

Được phép sửa đúng các chỗ sau vì CHECK mới bắt buộc `EXPENSED` có `realized_minor`:

- `test/support/spend-harness.ts`, `commit` khi `state = 'EXPENSED'`: ghi `realized_minor = amount_minor`. Phần ghi dòng hóa đơn để B07-7 làm.
- `test/integration/budgets/spend-commitment-lifecycle.integration-spec.ts`: hai câu `UPDATE ... SET state = 'EXPENSED'`.
- `test/integration/organization/budget-notices.integration-spec.ts`, hàm `hold`.
- `src/modules/budgets/budget/commitment-release.policy.spec.ts`: thêm `realizedMinor: 0n` vào dữ liệu mẫu vì kiểu đã đổi.

Không đổi kỳ vọng của các test đó. Nếu phải đổi kỳ vọng thì dừng.

## Test

| Tình huống                               | Tầng        | Đáp án                         |
| ---------------------------------------- | ----------- | ------------------------------ |
| `heldOf` với 21, released 0, realized 13 | unit        | 8                              |
| `planRelease` không nêu số, realized 13  | unit        | Nhả 8                          |
| `planRelease` nêu 9 khi còn giữ 8        | unit        | `EXCEEDS_HELD`                 |
| `planRemainder` trên `EXPENSED`          | unit        | `NOT_HELD`                     |
| SQL ghi `released + realized > amount`   | integration | CHECK từ chối                  |
| SQL giảm `realized_minor`                | integration | Trigger từ chối                |
| SQL `RELEASED` có `realized_minor > 0`   | integration | CHECK từ chối                  |
| Update, delete `commitment_realizations` | integration | Trigger từ chối                |
| `release()` khi realized 13, còn giữ 8   | integration | `EXPENSED`, `released_at` null |
| `release()` khi realized 0               | integration | `RELEASED`, như cũ             |
| `totals` với HELD 21, realized 13        | integration | `held` = 8                     |

## Verify

```powershell
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm test -- src/modules/budgets
pnpm test:gates
pnpm test:integration -- test/integration/budgets
pnpm test:integration -- test/integration/requests --maxWorkers=4
pnpm test:integration -- test/integration/organization/budget-notices.integration-spec.ts
pnpm check
```

Thêm kiểm `migrate diff` không lệch trên database test mới.

## Xong khi

Toàn bộ test `requests` và `budgets` giữ nguyên kết quả so với mốc P00, ngoại trừ các test mới. `spent` chưa đổi ở plan này.
