# Plan: Finance ghi chi phí phần mềm nội bộ vào đúng một Cost Center

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- [Audit thiết kế (Bước 02)](review-02.md).
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026); hoàn thiện kế hoạch B07-10 ngày 03/11/2026.
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `in-progress`. Đã có code B07-10 trên cây chưa commit, **chưa verified**: ESLint, Prettier và 3 suite HTTP
  `platform` còn đỏ, integration chưa chạy (xem mục kiểm lại 03/11/2026). PR: chưa có.

## Before coding

Đọc `AGENTS.md`, `CONTRIBUTING.md`, [hướng dẫn dev mới](../../../guides/huong-dan-dev-moi.md), [module structure](../../../rules/module-structure.md),
[API rules](../../../rules/api-contract.md), [database rules](../../../rules/database-business.md), [security rules](../../../rules/security-jobs.md), và
module card `budgets`. Đối chiếu Logical ERD 7.106 ở Docs `d6d868c`. Cổng vào B07-7 đã hoàn tất (thực chi tính từ hóa đơn đã được hợp nhất trong `CommitmentRepo.totals`).
Đọc kỹ các findings trong [review-02.md](review-02.md). Chuẩn bị database test riêng theo hướng dẫn kiểm thử. Chưa có dữ liệu chi phí nội bộ: test tự sinh dữ liệu kiểm thử độc lập.

## Tasks

### Task 1: Migration bảng internal_cost_entries

- Files: `prisma/models/budgets.prisma`, `prisma/migrations/<timestamp>_internal_cost_entries/migration.sql`, `test/gates/architecture-boundaries.gate-spec.ts`.
- Depends on: Cổng vào B07-7 (đã thỏa).
- Acceptance: Bảng `internal_cost_entries` khớp Logical ERD 7.106; các ràng buộc CHECK `internal_cost_entries_period_order` (period_end >= period_start),
  `internal_cost_entries_cancel_whole` (cancelled_at và cancel_reason cùng null hoặc cùng có giá trị), `internal_cost_entries_amount_positive` (amount_minor > 0),
  và `internal_cost_entries_amount_reporting_positive` (amount_reporting_minor > 0, F-03); chỉ mục trên `(application_id, period_start)` và `(cost_center_id, period_start)`;
  đăng ký `InternalCostEntry: 'budgets'` trong `PRISMA_MODEL_OWNER`.
- Verify: `pnpm prisma:format`, `pnpm prisma:validate`, `pnpm test:gates`.

### Task 2: Core Spend Aggregation & Split Policy (budgets/budget)

- Files: `src/modules/budgets/budget/internal-cost-spend.repo.ts`, `src/modules/budgets/budget/internal-cost-spend.policy.ts`,
  `src/modules/budgets/budget/internal-cost-spend.policy.spec.ts`, `src/modules/budgets/budget/commitment.repo.ts`,
  `src/modules/budgets/budget/internal-cost-split.policy.ts`, `src/modules/budgets/budget/internal-cost-split.policy.spec.ts`, `src/modules/budgets/budgets.module.ts`.
- Depends on: Task 1.
- Acceptance: Pure policy `internal-cost-spend.policy.ts` (F-01) tính toán tỷ lệ ngày giao cắt $D_{intersect}/D_{total}$ và chia dư tất định cho năm tài chính; repo `InternalCostSpendRepo` tính tổng chi phí nội bộ chưa hủy (`cancelled_at IS NULL`) theo Cost Center và năm tài chính qua policy;
  `CommitmentRepo.totals` cộng dồn thực chi từ cả hóa đơn và chi phí nội bộ; `internal-cost-split.policy.ts` chia đều theo thời gian cho các kỳ báo cáo (AC-11).
- Verify: `pnpm test -- src/modules/budgets/budget/`.

### Task 3: Bổ sung tra cứu loại ứng dụng trong CatalogApi

- Files: `src/modules/catalog/public/catalog.api.ts`, `src/modules/catalog/public/catalog.types.ts`.
- Depends on: Task 1.
- Acceptance: `src/modules/catalog/public/catalog.types.ts` re-export `ApplicationKind` (F-02); mở hàm `lockApplicationShared(tx: DbTx, applicationId: string)` trên `CatalogApi` để `budgets` kiểm tra ứng dụng là phần mềm nội bộ `kind === 'INTERNAL'` (AC-5).
  Tạo note `docs/gehihi-plans/notes/03-catalog-application-kind.md` ghi rõ thay đổi public API này để báo Dev A.
- Verify: `pnpm test -- src/modules/catalog/`.

### Task 4: Capability budgets/internal-cost

- Files:
  - `src/modules/budgets/internal-cost/internal-costs.controller.ts`
  - `src/modules/budgets/internal-cost/internal-cost.service.ts`
  - `src/modules/budgets/internal-cost/internal-cost-query.service.ts`
  - `src/modules/budgets/internal-cost/internal-cost.repo.ts`
  - `src/modules/budgets/internal-cost/internal-cost.dto.ts`
  - `src/modules/budgets/internal-cost/internal-cost.errors.ts`
  - `src/modules/budgets/internal-cost/internal-cost.http-errors.ts`
  - `src/modules/budgets/budgets.module.ts`
- Depends on: Task 2, Task 3.
- Acceptance: Thực hiện toàn bộ use case ghi nhận chi phí nội bộ (AC-1→AC-8), hủy khoản có lý do (OQ-F-10 / LD-11), xử lý ngày bằng `toDateColumn`/`fromDateColumn` (F-05);
  truy vấn giới hạn phạm vi Cost Center cho Trưởng phòng (AC-9, F-04); ghi Audit Trail `INTERNAL_COST.RECORDED` và `INTERNAL_COST.CANCELLED`; schema OpenAPI đầy đủ mã lỗi và ví dụ.
- Verify: `pnpm test -- src/modules/budgets/internal-cost/`.

### Task 5: Kiểm thử HTTP và Integration

- Files:
  - `test/http/budgets/internal-costs.http-spec.ts`
  - `test/integration/budgets/internal-cost.integration-spec.ts`
  - `test/support/api-coverage-manifest.ts`
  - `test/support/openapi-example-manifest.ts`
- Depends on: Task 4.
- Acceptance: Toàn bộ ma trận test AC-1→AC-11 trong spec chạy xanh; test HTTP validate roles (chỉ Finance ghi/hủy, Trưởng phòng chỉ xem trong phạm vi phòng - F-04) và mã lỗi chuẩn;
  test integration kiểm tra ràng buộc DB, CHECK constraint, concurrency lock với `ConcurrencyHarness` (F-06), rollback tính nguyên tử (F-06), và ảnh hưởng trực tiếp tới `spent` của Cost Center.
- Verify: `pnpm test:http`, `pnpm test:integration -- test/integration/budgets/internal-cost.integration-spec.ts`, `pnpm openapi:export`.

## Verification and handoff

| Lệnh / kiểm tra AC  | Revision / môi trường | Kết quả thực chạy                    | Giới hạn / việc còn lại                                             |
| ------------------- | --------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| `pnpm rules:check`  | `hien-dev`            | pass (0 errors)                      | Tài liệu tuân thủ chuẩn liên kết và cú pháp                         |
| `pnpm rules:format` | `hien-dev`            | pass                                 | Tài liệu định dạng chuẩn Markdown                                   |
| US-12-11 AC-1→AC-11 | `hien-dev`            | thiết kế hoàn tất (đã audit bước 02) | Lượt B07-10 chỉ viết và audit thiết kế, sẵn sàng cho bước 03 coding |

- [x] Đã hoàn thiện thiết kế chi tiết (spec) và kế hoạch triển khai (plan) cho B07-10.
- [x] Đã audit thiết kế theo prompt 02, đóng 6 findings F-01→F-06 và tạo review-02.md.
- [x] Ma trận test bao phủ đầy đủ AC-1 đến AC-11 với dữ liệu, kiểm tra quyền, concurrency và rollback.
- [x] Không có file source nào bị thay đổi trong lượt thiết kế.
- [ ] AC trong scope có bằng chứng test đỏ/xanh. Unit policy và HTTP `internal-costs` xanh, nhưng integration chưa chạy và
      gate HTTP `platform` còn đỏ, xem mục dưới.
- [ ] Giao Owner review trên revision cụ thể; chỉ ghi `merged-dev`, `accepted`, `released` sau sự kiện thật.

### Kiểm lại code B07-10 ngày 03/11/2026

Người kiểm: Claude (Opus 5.5), theo yêu cầu Dev B; không sửa source. Nhánh `hien-dev`, HEAD `1f91c5a` (đã có trên
`origin/hien-dev`), code B07-10 chưa commit. Node 24.13.0, pnpm 11.1.3, Windows. Docker tắt nên không chạy integration.

| Lệnh                                                                                  | Kết quả                                                                                                                          |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm arch:check`, `pnpm arch:docs:check`                           | Xanh                                                                                                                             |
| `pnpm test -- src/modules/budgets src/modules/catalog`                                | 29 suites, 513/513 pass                                                                                                          |
| `pnpm test:gates`                                                                     | 16 suites, 317/317 pass                                                                                                          |
| `pnpm test:http -- test/http/budgets/internal-costs.http-spec.ts`                     | 27/27 pass                                                                                                                       |
| `pnpm test:http -- test/http/budgets test/http/platform`                              | **Đỏ**: 5 fail ở `api-inventory`, `openapi-response-examples`, `openapi-presentation`                                            |
| `pnpm exec eslint` trên 14 file `.ts` đổi                                             | **Đỏ**: 43 lỗi; 33 lỗi Prettier (thiếu `CRLF`), 10 lỗi khác                                                                      |
| `pnpm exec prettier --check`                                                          | **Đỏ** ở `commitment.repo.ts`, `budgets.module.ts`, `catalog.api.ts`, `catalog.types.ts`, `architecture-boundaries.gate-spec.ts` |
| `pnpm test:integration -- test/integration/budgets/internal-cost.integration-spec.ts` | Chưa chạy, Docker tắt                                                                                                            |

Việc phải sửa trước khi coi là verified:

1. HTTP `platform`: 4 route `internalCostRecord`, `internalCostCancel`, `internalCostGet`, `internalCostList` chưa có trong
   `api-coverage-manifest`, `SUCCESS_MESSAGES` và `openapi-example-route-codes-budgets`; thiếu khai `422 VALIDATION_ERROR` và
   `429 HTTP_TOO_MANY_REQUESTS`.
2. ESLint: `complexity` 13 ở `prorateInternalCostForYears` và `splitInternalCostAcrossPeriods`; `any` ở
   `internal-cost.service.ts:86`; import thừa `fromDateColumn` ở `internal-cost.repo.ts`; import thừa và truy cập `any` ở
   `internal-cost.integration-spec.ts`.
3. Integration chưa có ca khóa đồng thời và rollback (F-06 trong [review-02](review-02.md)), audit (AC-8b) và báo cáo đã phát
   hành (AC-10), dù matrix ở spec có.
4. Note [03](../../../gehihi-plans/notes/03-catalog-application-kind.md) mới ghi sẵn nội dung, chưa ghi đã gửi Dev A (Q-10).
   `CatalogApi.lockApplicationShared` gọi `ApplicationLookupService`, mà `origin/dev` đã đổi tên các service `-lookup`, nên
   khi merge phải sửa theo.
