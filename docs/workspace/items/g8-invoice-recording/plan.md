# Plan: Finance ghi hóa đơn, dòng hóa đơn và dòng thuế đúng chứng từ

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `in-progress`, đã có code và kiểm chứng B07-2, B07-3, B07-4 và B07-5; chưa có PR.

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
- Acceptance: bảng, enum, CHECK và chỉ mục khớp Logical ERD; thêm bốn cột của `invoice_lines` (`cost_center_id`, `fiscal_year`, `cost_reporting_minor`, `deductible_vat_reporting_minor` theo F-04); dòng thuế có bộ tỷ giá riêng (F-14) và `proof_document_id` (F-15); enum payer `VENDOR_COLLECTS`, `BUYER_REMITS` (F-13); role runtime có quyền theo H7.
- Verify: `pnpm test:gates`; `pnpm test:integration -- test/integration/budgets` với ca CHECK đỏ-trước; migrate deploy trên CSDL mới, `migrate diff` không
  lệch.

### Task 2: policy chi phí thực chịu

- Files: `src/modules/budgets/invoice/invoice-cost.policy.ts` và spec.
- Depends on: none.
- Acceptance: `US-12-10` AC-4, AC-6; thêm `splitAcrossLines` phân bổ giá và thuế từ đầu hóa đơn xuống dòng theo tỷ lệ tất định (F-23); để chỗ cho phí thẻ/chênh lệch tỷ giá sao kê (F-19); không làm tròn ở phép cộng minor units.
- Verify: `pnpm test -- src/modules/budgets/invoice` → đỏ trước, xanh sau.

### Task 3: ghi hóa đơn

- Files: `src/modules/budgets/invoice/{invoice.service,invoice.repo,invoice.dto,invoice.errors,invoice.http-errors,invoices.controller}.ts`,
  `src/modules/budgets/budgets.module.ts`, `test/support/api-coverage-manifest.ts`.
- Depends on: Task 1, Task 2.
- Acceptance: `US-12-10` AC-1, AC-7, AC-10, AC-11; `US-12-02` AC-9; ép tổng dòng bằng đầu hóa đơn (F-23); quy Cost Center cho từng dòng hóa đơn (từ Catalog/Request hoặc chỉ định); trùng hóa đơn; hoàn tác.
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

- Files: `src/modules/catalog/contract/*`, `prisma/migrations/*` (thay hai CHECK của `document_attachments`), `src/modules/budgets/invoice/*`.
- Depends on: Task 3.
- Acceptance: `US-12-10` AC-5; `US-04-04` AC-4, AC-7; thay CHECK `document_attachments_owner_state` và `_purpose_fits_owner` (F-12); hướng gọi `budgets → catalog`; áp dụng luật mục đích + đích gắn (F-17).
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

### 01/11/2026: B07-2, chỉ bước 1 và 2

- Phạm vi người giao chỉ định: policy thuần và lỗi; chưa làm các bước 3–5. Agent: Codex.
- Nhánh `hien-dev`, HEAD `160950302329ad76cdeb2fee806d225907222a32`, cây có thay đổi chưa commit từ các lượt trước.
  Giữ nguyên các thay đổi đó; lượt này chỉ thêm năm file `src/modules/budgets/invoice/*.ts` và cập nhật plan này.
- Fingerprint năm file invoice: SHA-256 `c21cc07840f50b62678c6c26af2f62ad37963fee3bb774f6e054ec2a551930e6`.
  Cách tính: sắp tên file tăng dần; nối đường dẫn tương đối dùng `/`, NUL, nội dung chuẩn hóa LF, NUL cho từng file rồi hash.
- Môi trường: Windows, Node `v24.13.0`, pnpm `11.1.3`; unit không dùng database.
- `invoice-cost.policy.ts`: `invoiceCostOf` tách chi phí thực chịu và GTGT khấu trừ, cộng phí đã đánh dấu, đổi dấu cho credit note.
  `splitAcrossLines(totalMinor, lines)` nhận danh sách không rỗng, trả `{ position, amountMinor }[]` theo thứ tự đầu vào.
  Tất cả phép tính tiền dùng `bigint`; phần dư lớn nhất được ưu tiên, hòa theo `position` tăng dần. Với dòng âm, lấy sàn thương
  để phần dư không âm; với tổng âm, phân bổ trị tuyệt đối rồi đổi dấu kết quả. Tổng trọng số bằng 0 thì dồn vào dòng đầu vào đầu tiên.
- `invoice.errors.ts`, `invoice.http-errors.ts`: sáu lỗi và ánh xạ đúng mã HTTP của bước 2 bằng `instanceof`; lỗi không nhận diện
  và `ApiException` đã ánh xạ được giữ nguyên. Chưa gắn mapper vào route.
- Hai file test mới là `invoice-cost.policy.spec.ts` và `invoice.http-errors.spec.ts`. Test phân bổ có lưới tất định 392 bộ
  tổng/trọng số, kiểm bảo toàn tổng và đối xứng dấu; không sửa test hay fixture cũ.

| Lệnh / kiểm tra                                                                                                                                                                                          | Kết quả thực chạy                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `pnpm test -- src/modules/budgets/invoice --runInBand` trước hiện thực                                                                                                                                   | Đỏ đúng lý do: 22 failed, 4 passed, 2 suites  |
| `pnpm test -- src/modules/budgets --runInBand` sau hiện thực                                                                                                                                             | 154 passed, 8 suites; riêng invoice 29 passed |
| `pnpm typecheck`                                                                                                                                                                                         | PASS, exit 0                                  |
| `pnpm exec eslint src/modules/budgets/invoice`                                                                                                                                                           | PASS, exit 0                                  |
| `pnpm test:gates -- test/gates/module-layout.gate-spec.ts test/gates/capability-graph.gate-spec.ts test/gates/architecture-boundaries.gate-spec.ts test/gates/policy-ownership.gate-spec.ts --runInBand` | 90 passed, 4 suites                           |

Kiểm build: `pnpm exec nest build` PASS, exit 0.
Kiểm tài liệu: `pnpm rules:check` PASS (373 file, 3036 liên kết, 0 lỗi); `pnpm rules:format` PASS.

Bằng chứng AC: `US-12-10` AC-4 và AC-6 được kiểm chứng ở mức phép tính thuần qua `invoice-cost.policy.spec.ts` (20 test,
gồm F-19, F-23 và credit note); bảng sáu mã lỗi được kiểm chứng qua `invoice.http-errors.spec.ts` (9 test).
Chưa chứng minh việc ghi nhận thực chi, persistence, audit, tỷ giá, quyền HTTP hay các AC còn lại của B07-2.
B07-1, D2 và Q-13 vẫn cần kiểm trước khi làm phần ghi hóa đơn. Các bước sau chưa triển khai; migration/API không đổi.
Không chạy `pnpm check`, HTTP hay integration trong lượt chỉ có policy và mapper này. Chưa commit, chưa review hay nghiệm thu.

### 01/11/2026: B07-2, chỉ bước 3

- Phạm vi người giao: chỉ bổ sung hàm đọc từ `catalog` và `organization`, không làm lại bước 1–2, không làm bước 4–5.
  Agent: Codex. Nhánh `hien-dev`, HEAD `160950302329ad76cdeb2fee806d225907222a32`, cây chưa commit có thay đổi từ trước.
- Đã xem diff bước 1–2 và kiểm lại fingerprint năm file invoice vẫn là
  `c21cc07840f50b62678c6c26af2f62ad37963fee3bb774f6e054ec2a551930e6`, không sửa các file này.
- Fingerprint 13 file TypeScript của bước 3: SHA-256
  `e5a1a3d831ba2995c4172ad897b03eba74f79d13b01f8409844002a8d2a8898d`.
  Cách tính như lượt trước: sắp đường dẫn tăng dần, nối đường dẫn dùng `/`, NUL, nội dung chuẩn hóa LF, NUL rồi hash.
- Môi trường: Windows, Node `v24.13.0`, pnpm `11.1.3`, PostgreSQL 17 trong Docker dùng một lần, chỉ mở localhost ở cổng ngẫu nhiên.
  Role test thường có `CREATEDB`, không superuser; mỗi suite sở hữu database riêng theo harness. Sau test không còn database `slm*`;
  đã dọn container và volume test của lượt này. Không dùng `.env` hay database chung.

Hàm mới và thông tin bàn giao Dev A theo Q-10:

- `CatalogApi.getSubscriptionSummaries(ids, tx?)`: trả `{ id, vendorId, ownerDepartmentId }[]` theo id, chỉ đọc các id tồn tại;
  bỏ id trùng, đầu vào rỗng không query, lô có dữ liệu dùng đúng một truy vấn. Không lọc trạng thái thuê bao để không bỏ chứng từ lịch sử.
- `CatalogApi.isVendorUsable(id, tx?)`: `Vendor` không có trạng thái ngừng dùng, nên bản ghi tồn tại thì dùng được.
  Dùng lại `VendorRepo.find` trong transaction hoặc `findPublic` ngoài transaction; không sửa hàm cũ.
- `OrganizationHistoryApi.getCostCenterOfDepartmentOn(departmentId, onDate, tx?)`: trả id Cost Center hoặc `null`;
  `linkedAt` bao gồm ngày liên kết, `deactivatedAt` loại ngày ngừng, đều đổi sang ngày theo múi giờ tổ chức qua `businessDateAt`.
  Đọc cả Cost Center hiện đã ngừng để quy chi phí cho ngày quá khứ; hỗ trợ Cost Center kế tiếp của cùng phòng.
- Đây là nội dung để Dev A đối chiếu phần chỉ-thêm ở `catalog`; chưa có xác nhận phối hợp Q-10 và chưa gửi tin qua kênh ngoài.

File của lượt này:

- `src/modules/catalog/`: `public/catalog.api.ts`, `public/catalog.types.ts`, `subscription/subscription-lookup.service.ts`,
  `subscription/subscription.repo.ts`, `vendor/vendor-lookup.service.ts`, `README.md`.
- `src/modules/organization/`: `public/organization-history.api.ts`, `cost-center/cost-center-catalogue.service.ts`,
  `cost-center/cost-center.repo.ts`, `cost-center/cost-center.types.ts`, `README.md`.
- File mới `src/modules/organization/cost-center/cost-center-link.policy.ts`, `cost-center-link.policy.spec.ts`:
  tách quy tắc ngày thuần để kiểm các biên theo múi giờ, không phụ thuộc SQL hay Nest.
- File mới `test/integration/catalog/invoice-reference-reads.integration-spec.ts` và
  `test/integration/organization/cost-center-on-date.integration-spec.ts`: kiểm qua facade thật, truy vấn theo lô,
  Cost Center lịch sử, dữ liệu chưa commit và rollback. Không sửa test, fixture hay gate cũ.
- Plan này ghi bằng chứng; module card chỉ cập nhật contract mới. Các file thêm ngoài facade là đường đọc riêng trong module sở hữu
  và test cần thiết của bước 3. Không thêm module, cạnh module, migration hay route HTTP.

| Lệnh / kiểm tra                                                                                                                                                                                                                                  | Kết quả thực chạy                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `pnpm test -- src/modules/organization/cost-center/cost-center-link.policy.spec.ts --runInBand` trước hiện thực                                                                                                                                  | 4 failed, 4 passed, đỏ ở quy tắc ngày chưa hiện thực      |
| `pnpm test:integration -- test/integration/catalog/invoice-reference-reads.integration-spec.ts test/integration/organization/cost-center-on-date.integration-spec.ts --runInBand` trước hiện thực                                                | 6 failed, 5 passed, đỏ ở hàm đọc chưa hiện thực           |
| `pnpm test -- src/modules/catalog src/modules/organization src/modules/budgets/invoice --runInBand`                                                                                                                                              | 576 passed, 42 suites; gồm 8 unit mới và 29 test bước 1–2 |
| `pnpm test:integration -- test/integration/catalog/invoice-reference-reads.integration-spec.ts test/integration/organization/cost-center-on-date.integration-spec.ts test/integration/organization/organization.integration-spec.ts --runInBand` | 28 passed, 3 suites; gồm 11 integration test mới          |
| `pnpm typecheck`                                                                                                                                                                                                                                 | PASS, exit 0                                              |
| `pnpm exec eslint <13 file TypeScript của bước 3 ở trên>`                                                                                                                                                                                        | PASS, exit 0                                              |
| `pnpm test:gates -- test/gates/module-layout.gate-spec.ts test/gates/capability-graph.gate-spec.ts test/gates/architecture-boundaries.gate-spec.ts test/gates/policy-ownership.gate-spec.ts test/gates/module-graph.gate-spec.ts --runInBand`    | 127 passed, 5 suites                                      |
| `pnpm exec nest build`                                                                                                                                                                                                                           | PASS, exit 0                                              |

Kiểm tài liệu: `pnpm rules:check` PASS (373 file, 3036 liên kết, 0 lỗi); `pnpm rules:format` PASS.
Tự review diff cuối và `git diff --check` PASS; giữ nguyên các thay đổi có sẵn ngoài bước 3.

Bằng chứng mới chỉ cho contract đọc của bước 3 và điều kiện quy Cost Center tại ngày phát sinh (F-04/Q-04).
Chưa chứng minh toàn bộ AC của `US-12-10` hay `US-12-02`: chưa có service ghi, snapshot tỷ giá, audit hay quyền HTTP của hóa đơn.
B07-1, D2 và Q-13 vẫn cần kiểm trước bước 4–5. Không chạy `pnpm check`, HTTP, OpenAPI export; chưa commit, chưa review hay nghiệm thu.

### 01/11/2026: B07-2, kiểm chứng bước 4 và 5 trên code đã có

**Phạm vi lượt này.** Chỉ chạy Verify và ghi bằng chứng, không viết thêm tính năng, sửa source, test, migration hay spec.
Bước 4 là repo/service và bước 5 là HTTP của [B07-2](../../../gehihi-plans/b07-2-invoice-record.md), tương ứng Task 3
trong plan này. Đây không phải Task 4 sửa thuế hay Task 5 đọc hóa đơn của hạng mục tổng. Agent: Codex.

**Revision và môi trường.** Nhánh `hien-dev`, HEAD `160950302329ad76cdeb2fee806d225907222a32`, cây làm việc chưa commit.
Nguồn yêu cầu vẫn là Docs `d6d868c`; D2, D3 và Q-13 theo `Owner dispositions` trong [spec](spec.md#owner-dispositions).
Windows, Node `v24.13.0`, pnpm `11.1.3`. Các lệnh chạy với `NODE_ENV=test` để không nạp `.env` của developer.
Lần đầu `pnpm check` bị ảnh hưởng bởi `TEST_DATABASE_URL` do agent truyền thừa; lần chạy lại bỏ biến này,
giữ `NODE_ENV=test`. Chi tiết lần đỏ ghi dưới đây; không sửa code/test để xử lý lỗi môi trường.

- Fingerprint 39 file liên quan: SHA-256 `5d6b449f203249342b332737408d91e7c42a53b58821dc9d5cf27315786a0792`.
  Danh sách gồm 11 file `.ts` trong `src/modules/budgets/invoice/`; 13 file TypeScript của bước 3 đã liệt kê ở trên;
  `src/modules/budgets/budgets.module.ts`; hai test ghi hóa đơn HTTP/integration bên dưới; ba manifest
  `test/support/{api-coverage-manifest,openapi-example-manifest,openapi-example-route-codes-budgets}.ts`;
  `prisma/schema.prisma`; bốn model `prisma/models/{budgets,catalog,finance,organization}.prisma`;
  `prisma/migrations/20261101100000_invoices/migration.sql`; `test/gates/architecture-boundaries.gate-spec.ts`;
  `package.json` và `pnpm-lock.yaml`.
- Cách hash: sắp đường dẫn tăng dần, dùng `/`, nối đường dẫn, NUL, nội dung chuẩn hóa LF, NUL cho từng file rồi SHA-256.
  Fingerprint trước/sau các lệnh Verify trùng nhau. Không dùng hash của HEAD để đại diện cho source chưa commit.
- Hash riêng `docs/generated/routes.md` rồi `openapi.json` theo cùng cách:
  `61ca5396ee7866fe289f5fd8196a9413bb401e805ce336648fe96cd34893efc6`.
  Hai generator đã chạy; artifact trước/sau không đổi, routes có 288 operation.
- PostgreSQL `17.11` trong container riêng `slm-b072-evidence`, image `postgres:17-alpine`, chỉ bind localhost ở cổng ngẫu nhiên.
  Role test `LOGIN CREATEDB`, `NOSUPERUSER`, không quyền tạo role; đã đọc lại `rolsuper=false`, `rolcreatedb=true`.
  `TEST_DATABASE_ADMIN_URL` chỉ truyền qua môi trường của tiến trình, không ghi connection string vào tài liệu.
- Harness theo [test guide](../../../../test/README.md#database-cho-integration-và-e2e): migrate một database mẫu dùng một lần,
  mỗi suite clone một database riêng rồi xóa trong teardown. Kết thúc không còn database `slm*`; đã dọn đúng container và volume
  của lượt này, giữ nguyên container test khác. Không dùng database chung hay dữ liệu thật.

Lệnh Verify thực chạy từ gốc backend:

| Lệnh                                                               | Kết quả lượt này                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `pnpm test -- src/modules/budgets/invoice --runInBand`             | 29 pass, 2 suites, exit 0                                                                                 |
| `pnpm test -- src/modules/organization --runInBand`                | 255 pass, 24 suites, exit 0                                                                               |
| `pnpm test:http -- test/http/budgets --runInBand`                  | 16 pass, 1 suite, exit 0                                                                                  |
| `pnpm test:integration -- test/integration/budgets --maxWorkers=2` | 151 pass, 9 suites, 0 fail; riêng invoice recording 18 pass, exit 0                                       |
| `pnpm openapi:export`                                              | PASS, exit 0; artifact không đổi                                                                          |
| `pnpm arch:routes`                                                 | PASS, exit 0; 288 operation, artifact không đổi                                                           |
| `pnpm check` lần đầu, có `TEST_DATABASE_URL` truyền thừa           | Exit 1 ở unit: 4.030 pass, 1 fail; chưa chạy các bước sau unit                                            |
| `pnpm check` chạy lại, bỏ biến truyền thừa                         | PASS, exit 0: 4.031 unit / 279 suites; 317 gates / 16 suites; script 252 pass, 2 skip, 0 fail; build PASS |

**Lần đỏ và nguyên nhân.** Test có sẵn
`src/infrastructure/config/test-environment-isolation.spec.ts`, ca `still reads .env in development`,
chủ động chuyển `NODE_ENV` sang `development`. `database-environment.ts` chỉ cho `TEST_DATABASE_URL` ở test,
và dùng `Joi.forbidden()` ở môi trường khác. Biến do agent thêm vào tiến trình vẫn còn trong ca development,
nên schema từ chối với `EnvironmentValidationError: "TEST_DATABASE_URL" is not allowed`.
Phân loại: môi trường chạy lệnh do agent cấu hình, không phải lỗi logic ghi hóa đơn.
Không sửa source, test hay assert; chỉ bỏ biến truyền thừa rồi chạy lại đúng lệnh Verify.

Lần chạy với môi trường đúng đã qua toàn bộ chuỗi `pnpm check`, gồm rules, format, Prisma, lint, typecheck,
unit, gates, kiến trúc, script, test discovery và build. Hai ca script skip có sẵn do nền tảng Windows;
lượt này không thêm skip hay thay đổi điều kiện chạy test. Kiểm tài liệu sau khi cập nhật bằng chứng:
`pnpm rules:check` PASS (373 file, 3.043 liên kết, 0 lỗi); `pnpm rules:format` PASS sau format riêng plan này.

Integration in cảnh báo deprecation của `pg` về query chồng trên một client; lượt này chưa điều tra hay sửa cảnh báo.
Log lỗi audit `the audit of this edit is refused by the test` thuộc ca cố tình gây lỗi để kiểm rollback trong suite hiện có;
runner kết thúc 151 pass, 0 fail. Không coi log ERROR hoặc warning riêng lẻ là kết quả test đỏ.

Các ca integration đọc số tiền/ngày đã lưu bằng SQL trên PostgreSQL thật. Test snapshot dùng ngày hóa đơn `2026-10-05`,
ghi đầu hóa đơn USD và thuế VND độc lập, thêm tỷ giá ở ngày sau rồi đọc lại các giá trị đã lưu.
Test đồng thời dùng `Barrier` trong `concurrency-harness.ts`, không sleep. Test lỗi dòng thuế bị CHECK từ chối giữa transaction;
test lỗi audit gọi ghi audit thật rồi chèn lỗi để chứng minh toàn bộ giao dịch rollback.

**AC đã có bằng chứng, đúng giới hạn bước 4–5:**

| Story / AC                | Bằng chứng hiện có và đã chạy                                                                                                                                                                                            | Giới hạn                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `US-12-10` AC-1           | `invoice-recording.integration-spec.ts`: `stores each documented tax field and records one audit with actor and resource (AC-1)`; lưu GTGT 100 USD, TNDN 50 USD của hóa đơn 1.000 USD, loại, tỷ lệ, bên nộp, cờ và audit | Chưa gồm tệp chứng từ thuế                                                                             |
| `US-12-10` AC-4           | `invoice-cost.policy.spec.ts`: ví dụ 20tr + thuế 2tr khấu trừ + 1tr không khấu trừ ra chi phí 21tr và GTGT 2tr; integration kiểm cột chi phí/GTGT đã lưu và tổng phân bổ qua hai phòng có dòng giảm giá                  | Mới chứng minh tính và lưu chi phí; chưa chứng minh tăng `spent` hay hiển thị cột báo cáo, thuộc B07-7 |
| `US-12-10` AC-6           | Unit không thuế trả giá gốc, GTGT 0; integration `does not generate tax lines from the T2 profile; no-tax cost equals price` xác nhận dữ liệu lưu                                                                        | Chưa có API đọc/report của hóa đơn                                                                     |
| `US-12-10` AC-7 và D2     | Integration `freezes independent USD and VND conversions on invoiceDate, despite later rates`; hai ca thiếu tỷ giá đầu hóa đơn/dòng thuế từ chối, không hóa đơn hay audit                                                | Chứng minh snapshot đã lưu bằng SQL, chưa đi qua API đọc hoặc báo cáo                                  |
| `US-12-10` AC-10          | Integration khai hồ sơ T2 nhưng gửi `taxLines: []` thì không tự tạo thuế; chi phí bằng giá                                                                                                                               | Chứng minh vế không tự sinh thuế ở đường ghi                                                           |
| `US-12-10` AC-11, vế ghi  | `invoices.http-spec.ts`: bốn vai `IT_ADMIN`, `MANAGER`, `SPENDING_APPROVER`, `SUPER_ADMIN` nhận 403 và writer không được gọi; integration gọi service với bốn vai bị từ chối, không có hóa đơn hay audit                 | Chưa chứng minh vế sửa và IT Admin đọc dòng thuế                                                       |
| `US-12-02` AC-9, nhập tay | Cùng ca HTTP/service từ chối ghi; integration `records through the real HTTP pipeline with Finance` kiểm 201, số tiền đã lưu và audit từ DB                                                                              | Không chứng minh import file; import ngoài phạm vi và còn OQ-F-03                                      |

Các file test được nhắc ở bảng là
[`invoice-cost.policy.spec.ts`](../../../../src/modules/budgets/invoice/invoice-cost.policy.spec.ts),
[`invoices.http-spec.ts`](../../../../test/http/budgets/invoices.http-spec.ts),
[`invoice-recording.integration-spec.ts`](../../../../test/integration/budgets/invoice-recording.integration-spec.ts).

Bằng chứng kỹ thuật bổ sung trong 18 test integration: Cost Center của phòng sở hữu tại ngày hóa đơn;
null trước ngày liên kết và cho dòng ngoài danh mục; năm tài chính bắt đầu tháng 4 với hóa đơn 15/02/2027 thuộc năm 2026;
tổng dòng lệch đầu hóa đơn; thuê bao khác vendor hoặc không tồn tại; vendor không tồn tại; contract không tồn tại trả 422;
rollback khi lỗi thuế/audit; hai request trùng số chỉ một thành công và một audit. HTTP kiểm body thiếu trường,
đầu hóa đơn âm, dòng thiếu/có cả hai subject, mảng rỗng/quá giới hạn và ngày không hợp lệ.

**AC và phần chưa chứng minh:**

- `US-12-10` AC-2, AC-3: cờ mặc định và sửa dòng thuế, thuộc B07-3.
- `US-12-10` AC-5 và `US-04-04` AC-4, AC-7: gắn/mở tệp, chứng từ thuế và quyền tải tệp, thuộc B07-5.
- `US-12-10` AC-11: vế sửa thuộc B07-3, vế IT Admin đọc thuộc B07-4. AC-4 còn vế `spent`/báo cáo ở B07-7.
- `US-12-10` AC-8, AC-9, AC-12: phân loại chênh lệch, sửa sau báo cáo phát hành và phí khi đối soát không thuộc B07-2.
- Ca đổi hồ sơ thuế sau khi đã ghi hóa đơn (`US-12-09` AC-5) trong test matrix của spec chưa được chạy/chứng minh bởi các test ghi hiện có.
- Không dùng lượt này để chứng minh list/detail/phân trang, ghép cam kết, credit note qua HTTP hoặc toàn bộ `US-12-02`.
  Không chạy integration toàn repo, `_serial`, E2E hay production/H7 runtime; chỉ integration `budgets` đúng Verify của B07-2.
- Không dựng lại bằng chứng đỏ-trước cho implementation đã có. Bằng chứng đỏ-trước của policy/errors và bước 3 giữ ở các mục lịch sử;
  lượt này ghi kiểm chứng code hiện hành, không tự nhận đã làm TDD cho bước 4–5.

Các sửa lỗi regression ngoài B07-2 ở lượt trước có nguồn riêng:
[note sửa lỗi](../../../gehihi-plans/notes/01-fixB07.md). Lượt này không sửa lại các file đó.
Không đổi spec, không mở thêm nghiệp vụ, không tự ghi nhận review hay nghiệm thu. Chưa commit, push hay deploy.

### Bổ sung B07-3 (02/11/2026, sửa dòng thuế và cờ mặc định)

Lệnh kiểm chứng chạy trên CSDL riêng (slm-test-db PostgreSQL 17, `127.0.0.1:55432`), agent DeepSeek-V3:

| Lệnh / kiểm tra AC                                                                                                            | Môi trường    | Kết quả thực chạy                                                                                | Giới hạn                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `US-12-10` AC-2: Đọc cờ mặc định theo hồ sơ thuế không tạo dòng                                                               | PostgreSQL 17 | `pnpm test:integration -- test/integration/budgets/invoice-tax-lines.integration-spec.ts` → pass | Dùng route `GET /vendors/:id/tax-profile` đã có đủ cờ |
| `US-12-10` AC-3: `PUT /invoices/:id/tax-lines/:position` sửa dòng thuế, đổi cờ làm tăng chi phí thực chịu, audit có trước/sau | PostgreSQL 17 | `pnpm test:integration -- test/integration/budgets/invoice-tax-lines.integration-spec.ts` → pass | Tỷ giá dòng dùng ngày hóa đơn (D2)                    |
| `US-12-10` AC-11 (vế sửa): Bốn vai không phải Finance gọi PUT bị 403                                                          | HTTP          | `pnpm test:http -- test/http/budgets/invoice-tax-lines.http-spec.ts` → pass                      | Vế đọc của IT Admin thuộc B07-4                       |
| `US-12-09` AC-5: Đổi hồ sơ thuế sau khi ghi không đổi dòng thuế đã lưu                                                        | PostgreSQL 17 | `pnpm test:integration -- test/integration/budgets/invoice-tax-lines.integration-spec.ts` → pass | Đã chứng minh                                         |
| Phân bổ lại chi phí dòng: Tổng chi phí các dòng bằng chi phí thực chịu mới                                                    | PostgreSQL 17 | `pnpm test:integration -- test/integration/budgets/invoice-tax-lines.integration-spec.ts` → pass | Đã chứng minh                                         |
| Verify HTTP platform & budgets                                                                                                | HTTP contract | `pnpm test:http -- test/http/platform test/http/budgets` → 16 suites, 273 passed                 | Đã pass toàn bộ                                       |
| Verify integration budgets                                                                                                    | PostgreSQL 17 | `pnpm test:integration -- test/integration/budgets` → 14 suites, 194 passed                      | Đã pass toàn bộ                                       |
| Gate tĩnh và lint                                                                                                             | Static        | `pnpm test:gates` → 16 suites, 317 passed; `pnpm exec eslint` → 0 errors                         | Đã pass                                               |

### Bổ sung B07-4 (02/11/2026, đọc hóa đơn và dòng thuế)

Lệnh kiểm chứng chạy trên CSDL riêng (slm-test-db PostgreSQL 17, `127.0.0.1:55432`), agent DeepSeek-V3:

| Lệnh / kiểm tra AC                                                                                                        | Môi trường      | Kết quả thực chạy                                                                            | Giới hạn        |
| ------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------- | --------------- |
| `US-12-10` AC-11 (vế đọc danh sách): `GET /invoices` chỉ Finance gọi được, 4 vai khác bị 403                              | HTTP            | `pnpm test:http -- test/http/budgets/invoice-reads.http-spec.ts` → pass                      | Đã chứng minh   |
| `US-12-10` AC-11 (vế đọc chi tiết): `GET /invoices/:id` Finance và IT Admin đọc được, vai khác 403, 404 khi không tồn tại | HTTP            | `pnpm test:http -- test/http/budgets/invoice-reads.http-spec.ts` → pass                      | Đã chứng minh   |
| `US-12-10` AC-11 (vế đọc dòng hóa đơn): `GET /invoices/:id/lines` Finance và IT Admin đọc được                            | HTTP            | `pnpm test:http -- test/http/budgets/invoice-reads.http-spec.ts` → pass                      | Đã chứng minh   |
| `US-12-10` AC-11 (vế đọc dòng thuế): `GET /invoices/:id/tax-lines` IT Admin và Finance đọc được                           | HTTP            | `pnpm test:http -- test/http/budgets/invoice-reads.http-spec.ts` → pass                      | Đã chứng minh   |
| Phân trang ổn định: Hai hóa đơn cùng ngày có thứ tự ổn định qua các trang (`invoice_date DESC, id DESC`)                  | PostgreSQL 17   | `pnpm test:integration -- test/integration/budgets/invoice-reads.integration-spec.ts` → pass | Đã chứng minh   |
| Số câu lệnh query không tăng theo cỡ trang giữa pageSize 10 và 50 (`QueryCounter`)                                        | PostgreSQL 17   | `pnpm test:integration -- test/integration/budgets/invoice-reads.integration-spec.ts` → pass | Đã chứng minh   |
| Đổi tỷ giá sau khi ghi không đổi số tiền quy đổi khi đọc lại (`effectiveCost`, `deductibleVat`, `amountReporting`)        | PostgreSQL 17   | `pnpm test:integration -- test/integration/budgets/invoice-reads.integration-spec.ts` → pass | Đã chứng minh   |
| Tiền trên route đọc: Tất cả trường tiền dùng `moneyView: { amount, currency }`, không trả trường `*Minor` dạng chuỗi      | Static / Schema | `invoice.dto.ts`, `invoice.mapper.ts`                                                        | Đã tuân thủ     |
| Verify HTTP platform & budgets                                                                                            | HTTP contract   | `pnpm test:http -- test/http/platform test/http/budgets` → 17 suites, 294 passed             | Đã pass toàn bộ |
| Verify integration budgets                                                                                                | PostgreSQL 17   | `pnpm test:integration -- test/integration/budgets` → 15 suites, 197 passed                  | Đã pass toàn bộ |
| Gate tĩnh và lint                                                                                                         | Static          | `pnpm test:gates` → 16 suites, 317 passed; `pnpm exec eslint` → 0 errors                     | Đã pass         |

- [x] AC trong scope B07-4 (`US-12-10` AC-11 vế đọc, phân trang ổn định, query count không tăng) có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [ ] Spec/plan/test design phản ánh đúng implementation cuối; peer review nếu có đã xử lý hoặc ghi disposition.
- [ ] Diff cuối đã tự review; tài liệu vận hành/runbook bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể; cập nhật roadmap/PR. Chỉ ghi `merged-dev`, `accepted`, `released` sau
      đúng sự kiện thật.
