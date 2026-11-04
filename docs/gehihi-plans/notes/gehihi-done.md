# Bộ plan B: đã xong và chưa xong

Cập nhật 04/11/2026, đối chiếu `plan.md` của từng hạng mục với git. Đây là ảnh chụp để Dev B theo dõi, không thay roadmap hay
`plan.md`. Chưa có plan nào được Owner review hay `accepted`.

**Tóm lại:** 32 plan. Xong local 13, đang làm 2 (B07-10 đạt mức unit; B07-9 đạt mức unit Task 6, dừng hỏi Task 5), chưa làm 17.

Git: B07-10 đã commit ở `1a579bb` và đã có trên `origin/hien-dev`; chỉ code B07-9 còn chưa commit. Chưa merge `origin/dev`.

## Đã xong local

| Plan                | Hạng mục                              | Tình trạng          | Cần lưu ý                                                                                                                                   |
| ------------------- | ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| P00                 | Dựng môi trường và chốt mốc           | Đã chạy 31/10       | Không có mục riêng như plan yêu cầu, kết quả gộp vào bảng B05. Bảng ghi Node 22, máy chạy Node 24.13                                        |
| P01                 | Áp sửa thiết kế vào spec              | Xong 31/10          | Spec đã áp F-04, F-07, F-12→F-15, F-17, F-19, F-23. Người phụ trách chưa duyệt                                                              |
| B05-1, B05-2        | `g4-request-and-transfer-integration` | Xong 31/10 (Gemini) | Dòng Triển khai vẫn ghi `not-started`. Test `provisioning-quota-after-spend` vẫn ghi chờ PostgreSQL, dù đã pass trong 1.132 test `requests` |
| B10-1               | `g10-approval-api-gaps`               | Xong 31/10          | Vế hàng đợi `US-16-03` AC-4 chặn ở Q-11. `dev` đã có B-01→B-04, merge xong thì mở lại                                                       |
| B07-1 → B07-5       | `g8-invoice-recording`                | Xong, có bằng chứng | B07-4 chưa đánh dấu ô tự review diff. Bằng chứng B07-5 chỉ ở note 02. `plan.md:139` vẫn ghi chưa báo Dev A (Q-10)                           |
| B07-6, B07-7, B07-8 | `g8-commitment-realization`           | Xong 02–03/11       | Thiếu test F-06 và ca tổng hợp B07-7. Nhãn model DeepSeek-V3 cần xác nhận                                                                   |

## Đang làm

| Plan   | Hạng mục                    | Tình trạng                                                                                                                                                                                                                                                                                                                                           |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B07-10 | `g8-internal-cost-entry`    | Thiết kế và audit xong (`review-02.md`, F-01→F-06). Code có, **đạt mức unit**: typecheck xanh, unit 533/533 pass (budgets + catalog), ESLint 0 lỗi. Lỗi còn lại thuộc đợt test cuối                                                                                                                                                                  |
| B07-9  | `g8-commitment-realization` | AC-11 (Credit note) xong ở mức unit (DTO refine, policy kế thừa Cost Center, policy kiểm tra hóa đơn gốc, chi phí âm, audit). Task 6 xong mức unit. Task 5 dừng ở vế nhóm (`EXCEEDS_HELD`) và vế Finance được báo. Typecheck xanh, unit 233/233 pass, ESLint 0 lỗi trên `src/modules/budgets/invoice`; toàn budgets còn lỗi của B07-10 (mục Lỗi đỏ). |

## Cách test từ 03/11/2026

Dev B quyết định: mỗi plan chỉ cần `pnpm typecheck` và unit test của module. Lint, Prettier, gate, HTTP, integration,
tuần tự, E2E chạy **một lần ở đợt test cuối**, khi đã xong hết feature, trước khi xin Owner merge vào `dev`. Luật ở
[00-agent-rules.md](../00-agent-rules.md#verify-chung), prompt ở [promtingByHien.md](promtingByHien.md#đợt-test-cuối).

## Lỗi đỏ đã biết

Kiểm ngày 03/11 và rà soát lại 04/11/2026 (HEAD `ad437aa`, commit `1a579bb` của B07-10 đã trên `origin/hien-dev`; Node 24.13.0, npm).
Tất cả lỗi dưới đây đều ở code B07-10; phần code mới B07-9 (`src/modules/budgets/invoice`) không có lỗi.

**Đã chạy và xanh ngày 04/11:** `typecheck` (exit 0), unit test `src/modules/budgets` (17 suites, 233/233 pass).

**Chưa chạy lại ngày 04/11:** `pnpm test:http` toàn bộ, `test:integration` toàn bộ, `test:integration:serial`, `test:e2e`.

### 1. Prettier

33 lỗi thiếu CRLF trước đây đã hết sau khi chuẩn hóa LF và format lại (chạy `prettier --check` xanh exit 0 trên toàn bộ `src/modules/budgets`).

### 2. ESLint

10 lỗi ESLint của B07-10 (complexity, import thừa, type any) đã được xử lý xong ngày 04/11; chạy ESLint trên toàn bộ `src/modules/budgets` và test integration `internal-cost` đạt 0 lỗi.

### 3. HTTP `test/http/platform`: 5 test đỏ

Cả 5 đều do 4 route mới `POST /internal-costs`, `GET /internal-costs`, `GET /internal-costs/{id}`,
`POST /internal-costs/{id}/cancel`:

| Suite                       | Test                              | Thiếu                                                                  |
| --------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| `api-inventory`             | operations khớp coverage manifest | 4 route chưa có trong `api-coverage-manifest`                          |
| `openapi-presentation`      | khai `422 VALIDATION_ERROR`       | `internalCostGet`, `internalCostList` có input nhưng chưa khai 422     |
| `openapi-presentation`      | khai `429 HTTP_TOO_MANY_REQUESTS` | cả 4 route                                                             |
| `openapi-response-examples` | message thành công khớp decorator | 4 message `INTERNAL_COST.*` chưa có trong `SUCCESS_MESSAGES`           |
| `openapi-response-examples` | mã lỗi ví dụ khớp mã reachable    | 7 cặp route/status chưa có trong `openapi-example-route-codes-budgets` |

Chưa chạy lại ngày 04/11. Bảy cặp ở dòng cuối: `internalCostRecord` 404, 409, 422; `internalCostGet` 404; `internalCostCancel` 404, 409, 422.

### 4. Integration `internal-cost.integration-spec.ts`: 11/11 đỏ

Chưa chạy lại ngày 04/11. Cả 11 ca hỏng ở `beforeAll`, dòng 27 `h.start()`, trước khi tới code B07-10. Chuỗi bằng chứng:

1. Lỗi là `AggregateError` từ `pg-pool` khi mở transaction đầu tiên của harness. Chạy lại vẫn vậy.
2. Nạp file chẩn đoán ngoài repo để in lỗi con: app kết nối `localhost:5432`, DB `software_license_management_test`,
   user `app`, bị `ECONNREFUSED`. Đó là DB mặc định, không phải DB riêng của suite trên cổng 55432.
3. `test/support/http-test-app.ts:65-67` ghi rõ `AppModule` phải import động sau khi đặt `TEST_DATABASE_URL`, vì
   `ConfigModule.forRoot` đọc `process.env` lúc import lần đầu.
4. Dòng 3 của spec import `principal` từ `test/support/http-contract-app`, file này import tĩnh `AppModule` ở dòng 4. Đây là
   suite integration duy nhất import file đó.
5. Đối chứng: `commitment-totals.integration-spec.ts` dùng cùng `BudgetHarness`, cùng DB, xanh 7/7.

Chưa thử bỏ import để xác nhận vì lượt kiểm không sửa code. Sửa xong thì 11 ca mới thật sự chạy, có thể lộ thêm lỗi.

### 5. Thiếu test so với matrix spec B07-10

Integration chưa có ca khóa đồng thời và rollback (F-06 trong `review-02.md`), audit `INTERNAL_COST.RECORDED` (AC-8b), báo
cáo đã phát hành (AC-10).

### 6. Việc phối hợp, không phải lỗi test

- Note 03 chưa ghi đã gửi Dev A (Q-10).
- Note 04 ghi nhận bổ sung `kind: 'INVOICE'` cho 4 fixture integration trong `test/integration/budgets/` để thỏa mãn kiểu nghiêm ngặt `z.infer`.
- `CatalogApi.lockApplicationShared` gọi `ApplicationLookupService`; `origin/dev` đã đổi tên các service `-lookup`, nên sẽ lỗi
  compile khi merge.

## Chưa làm

16 plan thiết kế còn là khung `plan.md` 39 dòng:

| Gói  | Plan                                                                           |
| ---- | ------------------------------------------------------------------------------ |
| B-07 | B07-11 (cơ sở thực chi khi lỗi), B07-12 (khớp hóa đơn với thuê bao)            |
| B-08 | B08-1, B08-2, B08-3, B08-4, B08-5, B08-6, B08-7, B08-9                         |
| B-09 | B09-0 (chọn nơi đặt module G9, chưa có ADR), B09-1, B09-2, B09-3, B09-4, B09-5 |

B08-8 (tiết kiệm và hiệu quả sử dụng): `GATED`, chờ G7 và A-06.

Cổng còn chờ người khác:

| Plan          | Đang chờ                                                                                                                                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B07-11, B09-1 | Dev A trả lời Q-10                                                                                                                                                                                                                                                                |
| B08-5, B08-9  | A-06, A-10                                                                                                                                                                                                                                                                        |
| B08-7         | Vế usage chờ G7                                                                                                                                                                                                                                                                   |
| B08-6         | Owner xác nhận pin Docs mới có `QĐ-93`; bản đó bỏ chỉ số "số bước giao người thay thế"                                                                                                                                                                                            |
| B09-5         | Ca `OOS-24` phải hỏi Owner trước khi code                                                                                                                                                                                                                                         |
| B07-9         | 1. Kẹp `takeMinor` về `min(named, heldOf)` và bỏ qua khoản đã `EXPENSED` cho nhóm<br>2. Phê duyệt bổ sung `BudgetsApi.requestHasSpent` và thông báo Finance khi thất bại sau khi chi<br>3. Xác nhận quy tắc Cost Center null cho credit note khi hóa đơn gốc có nhiều Cost Center |

## Thứ tự tiếp theo

1. Dev B commit B07-9 sau khi đọc diff (Task 6 xong mức unit; Task 5 còn lại chờ Owner trả lời Q-14, Q-15).
2. Merge `origin/dev`: 9 file conflict, đổi import `budget-support.service` và các service `-lookup` theo tên mới, gồm cả
   `CatalogApi.lockApplicationShared`.
3. B09-0, B08-1 → B08-2 và các plan còn lại (sau khi B07-9 Task 5 có câu trả lời), mỗi plan chỉ unit test.
4. Đợt test cuối: sửa hết mục [Lỗi đỏ đã biết](#lỗi-đỏ-đã-biết) và lỗi mới, rồi xin Owner merge.
