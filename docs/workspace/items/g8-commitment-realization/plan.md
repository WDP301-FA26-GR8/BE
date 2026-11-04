# Plan: Hóa đơn khớp chuyển khoản cam kết thành chi phí, một phần hoặc toàn bộ

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `in-progress` (B07-6 và B07-7 verified local 02/11/2026 trên cây chưa commit nhánh `hien-dev`; B07-8 verified local 03/11/2026; B07-9 in-progress 04/11/2026). PR: chưa có.

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
- Acceptance: `US-06-06` AC-9 (vế nhả tiền khi thất bại: công thức heldOf và release đơn đã đúng; vế nhóm gặp EXCEEDS_HELD dừng báo; vế Finance được báo dừng hỏi theo luật).
- Verify: `pnpm test:integration -- test/integration/requests`.

### Task 6: credit note

- Files: `src/modules/budgets/invoice/*`.
- Depends on: Task 4.
- Acceptance: `US-06-06` AC-11 (xong ở mức unit: DTO refine, Cost Center inheritance policy, negative cost allocation, audit kind).
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

### B07-8 tiếp tục ngày 03/11/2026

Agent: **Codex**. Model: **GPT-6**, theo định danh của phiên này. Không dùng sub-agent. Bằng chứng DeepSeek-V3 ở bảng trên thuộc lượt B07-6/B07-7 trước đó.

Môi trường: Windows PowerShell, Node **24.13.0**, pnpm **11.1.3**, PostgreSQL 17 trong container test riêng `slm-test-db`, port localhost 55432. Mỗi suite integration sao và xóa database riêng theo `test/README.md`. Không dùng dữ liệu hoặc database dùng chung. Nhánh `hien-dev`, HEAD đầu lượt `160950302329ad76cdeb2fee806d225907222a32`; cây có thay đổi chưa commit từ các lượt trước.

Fingerprint source/test/generated của lượt này: **105 file**, SHA-256 `28ab72580e99739d760c63d97bad03466bc935662c1aee8acde86fe227d73220`. Tính bằng cách sắp đường dẫn POSIX tăng dần, băm lần lượt `path + NUL + bytes + NUL`. Phạm vi gồm mọi `*.ts` trong `src/modules/budgets`, `test/http/budgets`, `test/integration/budgets`; thêm `src/modules/requests/spend/commitment-vendor.listener.ts`, `test/support/invoice-match-harness.ts`, `test/support/openapi-example-route-codes-budgets.ts`, `openapi.json`, `docs/generated/module-graph.md`, `docs/generated/routes.md`. Không gồm spec/plan để việc ghi bằng chứng không đổi fingerprint.

Phạm vi đã sửa theo giao việc:

- Sửa hai lỗi typecheck: dùng `CommitmentRow` cho trạng thái khoản; fixture dòng subscription khai `outOfCatalog: false`.
- Tách `heldKey` sang `budget/commitment-key.policy.ts`, cập nhật mọi caller, không giữ re-export trong repo và không thêm cạnh module.
- Response khớp trả `matched`, `held`; danh sách trả `amount`; PUT thuế trả `amount`, `amountReporting`. Mọi trường dùng `moneyView`; audit vẫn ghi minor units. Đồng bộ DTO, service, controller, test và ví dụ trong spec.
- Khai 404 `BUDGET.COMMITMENT_NOT_FOUND` và năm lỗi 409 `INVOICE_MATCH.*` cho `POST /invoices` trong controller và manifest; HTTP có ca ánh xạ từng lỗi.
- Xóa `commitment-lock-concurrency.spec.ts`. Bỏ ép kiểu thừa trong `invoice-match.service.spec.ts`, không thêm `eslint-disable` hoặc suppression.
- Giữ 16 ca integration đã có, bổ sung dòng chi phí bằng 0 và hai ca rollback khi ghi nhiều dòng. Tách SQL fixture sang `test/support/invoice-match-harness.ts` để spec còn 769 dòng. Mỗi ca dùng Cost Center/ngân sách riêng. Các ca khớp kiểm `spent` và `remaining` qua `BudgetViewService.table`; các ca từ chối kiểm số dư/audit giữ nguyên. Ca F-11 dùng `Barrier` và `pg_blocking_pids` để thấy `release` đợi luồng khớp thật giữ khóa năm và hàng khoản.

| Lệnh                                                                                                            | Kết quả thực chạy                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                                                | Đỏ với đúng 2 lỗi được giao; xanh sau sửa                                                                                                                       |
| `pnpm arch:check`                                                                                               | Đỏ 1 vòng `commitment.repo → invoice-spend.repo → commitment.repo`; xanh sau tách key                                                                           |
| `pnpm exec eslint src/modules/budgets/invoice/invoice-match.service.spec.ts`                                    | Xanh sau bỏ ép kiểu thừa                                                                                                                                        |
| `pnpm test -- src/modules/budgets/invoice/invoice-match.service.spec.ts`                                        | 1 suite, 12/12 pass                                                                                                                                             |
| `pnpm test:integration -- test/integration/budgets/invoice-commitment-match.integration-spec.ts --maxWorkers=1` | 1 suite, 19/19 pass                                                                                                                                             |
| `pnpm arch:graph`                                                                                               | Exit 0, sinh lại module graph                                                                                                                                   |
| `pnpm openapi:export`                                                                                           | Exit 0, sinh lại OpenAPI; tự kiểm schema tiền và 404/409 của POST invoices                                                                                      |
| `pnpm arch:routes`                                                                                              | Exit 0, 297 operations                                                                                                                                          |
| `pnpm check`                                                                                                    | Exit 0 sau sửa lint; rules 38 pass, unit 282 suites/4086 pass, gates 16 suites/317 pass; scripts 252 pass/2 skip Windows; architecture, discovery và build xanh |
| `pnpm test:http`                                                                                                | 57 suites, 1402/1402 pass                                                                                                                                       |
| `pnpm test:integration -- test/integration/budgets`                                                             | 15 suites, 215/215 pass, gồm 19 ca B07-8, 20 ca ràng buộc và 7 ca totals                                                                                        |
| `pnpm test:integration -- test/integration/requests --maxWorkers=4`                                             | 84 suites, 1132/1132 pass                                                                                                                                       |
| `pnpm test:integration:serial`                                                                                  | 11 suites, 92/92 pass, theo mục Verify của B07-8                                                                                                                |

Các lỗi trong lúc dựng fixture đã sửa trước lượt xanh: một lần thiếu biến môi trường test ở tiến trình shell mới; một fixture thử bỏ `plan_id` bị CHECK của Request từ chối nên đã bỏ thay đổi đó. Không nới assert hoặc ràng buộc để làm xanh. Bộ 16 ca cũ đã xanh trước khi bổ sung; lượt này không tuyên bố có bằng chứng đỏ-trước cho hành vi đã triển khai ở lượt trước.

AC có bằng chứng B07-8: `US-06-06` AC-1 và AC-5; `US-12-02` AC-4 và AC-8, qua các ca cùng tên trong `invoice-commitment-match.integration-spec.ts`. Có thêm bằng chứng `US-12-09` AC-9, F-07, F-21, F-24, refusal và khóa F-11. Bảng test của B07-8 không thiếu tình huống; những ca trước chỉ kiểm trạng thái đã được bổ sung số tiền từ bảng ngân sách thật.

Giới hạn: `US-06-06` AC-9/AC-11 thuộc B07-9, chưa làm trong lượt này. F-06 và ca tổng hợp B07-7 chưa có đủ bằng chứng như mô tả trong matrix, nên không đánh dấu hoàn tất. Chưa chạy toàn bộ integration ngoài hai module, E2E hoặc CI. Hai script test skip có sẵn ở `bootstrap-installation.test.mjs` do Windows không hỗ trợ kiểm symlink/POSIX mode như Linux; lượt này không thêm hoặc sửa skip. Log integration có cảnh báo deprecated từ `pg` và lỗi cố ý ở các ca rollback; kết quả pass/fail lấy từ tổng kết Jest. Chưa Owner review, chưa commit/push/deploy và không chuyển hạng mục sang `accepted`.

Kiểm tra chỉ đọc sau integration: cluster test còn 2 database tên `slm_*_test`, đều không có kết nối. Không có số đếm đầu lượt để quy chúng cho lượt này; không xóa database không rõ lượt sở hữu và không tuyên bố cluster đã sạch.

File thay đổi trong lượt này: `src/modules/budgets/budget/{commitment-key.policy.ts,commitment.repo.ts,invoice-spend.repo.ts,budget-facts.repo.ts}`, `budget-view/budget-view.service.ts`, `invoice/{invoice-match.service.ts,invoice-match.service.spec.ts,invoice-tax-line.service.ts,invoice.dto.ts,invoices.controller.ts}`; xóa `budget/commitment-lock-concurrency.spec.ts`; `test/support/{invoice-match-harness.ts,openapi-example-route-codes-budgets.ts}`; `test/http/budgets/{invoices.http-spec.ts,invoice-commitment-match.http-spec.ts,invoice-tax-lines.http-spec.ts}`; `test/integration/budgets/{invoice-commitment-match.integration-spec.ts,commitment-totals.integration-spec.ts,commitment-realization-constraints.integration-spec.ts}`; `openapi.json`, `docs/generated/{module-graph.md,routes.md}` và spec/plan hạng mục này. Không đổi migration trong lượt này.

Tự review cuối B07-8: đối chiếu đủ 7 việc được giao với source, DTO, manifest, OpenAPI và bảng Test của plan; không thêm nghiệp vụ, cạnh module, migration hay suppression. `git diff --check` xanh, index không có file stage. `pnpm rules:check` và `pnpm rules:format` kiểm lại tài liệu sau cập nhật bằng chứng. Fingerprint source/test/generated cuối trùng giá trị ở trên. B07-8 đã verified local; hạng mục tổng thể còn B07-9 và các giới hạn trong matrix, chưa nghiệm thu. Dừng tại đây, không chuyển sang plan kế tiếp.

### B07-9 tiếp tục ngày 04/11/2026

Agent: **AG/GEMINI-3.8-FLASH-HIGH**.

Môi trường: Linux (`linux 7.0.0-42-generic`), Node **24.13.0**, npm. Nhánh `hien-dev`, revision gốc `ad437aaad4887a4bc0d89d665fdf4ca48ea4c9d0`. Lệnh chạy theo quy tắc Verify chung: unit test và typecheck qua Node directly.

| Lệnh                                                                                                    | Kết quả thực chạy                                              |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`                                        | Exit 0, sạch toàn repo                                         |
| `node node_modules/eslint/bin/eslint.js "src/modules/budgets/invoice/*.ts"`                             | Exit 0, 0 lỗi                                                  |
| `node node_modules/jest/bin/jest.js src/modules/budgets/invoice/invoice.dto.spec.ts --runInBand`        | 1 suite, 5/5 pass (refine `kind` và `creditedInvoiceId`)       |
| `node node_modules/jest/bin/jest.js src/modules/budgets/invoice/credit-note-cost-center.policy.spec.ts` | 1 suite, 5/5 pass (kế thừa Cost Center)                        |
| `node node_modules/jest/bin/jest.js src/modules/budgets/invoice/credit-note.policy.spec.ts`             | 1 suite, 3/3 pass (kiểm tra hóa đơn gốc khác vendor/sai kind)  |
| `node node_modules/jest/bin/jest.js src/modules/budgets/invoice/invoice-cost.policy.spec.ts`            | 1 suite, 21/21 pass (chi phí âm credit note)                   |
| `node node_modules/jest/bin/jest.js src/modules/budgets/invoice/invoice.http-errors.spec.ts`            | 1 suite, 19/19 pass (ánh xạ lỗi domain/validation)             |
| `node node_modules/jest/bin/jest.js src/modules/budgets/budget/commitment-release.policy.spec.ts`       | 1 suite, 19/19 pass (gồm ca chứng minh `EXCEEDS_HELD` vế nhóm) |
| `node node_modules/jest/bin/jest.js src/modules/budgets --runInBand`                                    | 17 suites, 233/233 pass                                        |
| `node scripts/arch/routes.mjs`                                                                          | Exit 0, 301 operations                                         |
| `node scripts/arch/graph.mjs`                                                                           | Exit 0, sinh lại `module-graph.md`                             |
| `node node_modules/ts-node/dist/bin.js scripts/dev/export-openapi.ts`                                   | Exit 0, sinh lại `openapi.json`                                |
| `node scripts/check-rules.mjs`                                                                          | Exit 0, 374 files, 3051 links, 0 errors                        |

Bằng chứng chi tiết:

- **Đỏ trước, xanh sau thực sự ở unit test:**
  - `invoice.dto.spec.ts`: kiểm tra validation refine bắt buộc/cấm `creditedInvoiceId` theo `kind`.
  - `credit-note-cost-center.policy.spec.ts`: kiểm tra quy tắc thuần kế thừa Cost Center (cùng/khác/null/rỗng).
  - `credit-note.policy.spec.ts`: kiểm tra hàm thuần `assertCreditedInvoiceValid` (từ chối hóa đơn gốc khác vendor hoặc không phải `INVOICE`).
- **Unit test bổ sung hành vi/ánh xạ:**
  - `invoice-cost.policy.spec.ts`: phân bổ số âm cho credit note.
  - `invoice.http-errors.spec.ts`: ánh xạ `InvoiceReferenceInvalidError` sang 422 `VALIDATION_ERROR`.
  - `commitment-release.policy.spec.ts`: ca test mô tả hành vi hiện tại từ chối `EXCEEDS_HELD` khi số tiền nhả vượt phần còn giữ sau khi realization trên dữ liệu giả (chưa kiểm chứng luồng nhóm thật trên CSDL).
- **Phần chờ đợt test cuối (hoãn integration theo luật):** Hóa đơn gốc không tồn tại (404), kiểm tra hóa đơn gốc qua DB transaction, truyền `kind` và `creditedInvoiceId` qua persistence/audit, Cost Center kế thừa áp vào dòng thật, `K1` `EXPENSED` không đổi, khớp credit note bị từ chối `INVOICE_NOT_MATCHABLE`, credit note giảm `spent`.
- **Giới hạn hiện hành:** Chưa kiểm tra ràng buộc ngày credit note so với hóa đơn gốc hay tổng tiền credit note so với hóa đơn gốc (AC không yêu cầu).
- **Lưu ý nghiệp vụ:** Khi hóa đơn gốc có nhiều Cost Center hoặc có dòng null, credit note có dòng không thuê bao sẽ mang `costCenterId = null` và không làm giảm `spent` của phòng ban cụ thể nào (khớp với hướng xử lý dòng chi phí chưa phân bổ của B08-3).
- **Sửa ngoài plan:** Bổ sung `kind: 'INVOICE'` cho 4 file test integration trong `test/integration/budgets/` để thỏa mãn kiểu nghiêm ngặt `z.infer`, ghi nhận tại `docs/gehihi-plans/notes/04-integration-fixture-invoice-kind.md`.

Task 6 hoàn thành ở mức unit. Task 5 dừng ở vế nhóm và vế thông báo Finance theo luật `00-agent-rules.md`.
