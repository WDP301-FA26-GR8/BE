# Bộ plan B: đã xong và chưa xong

Cập nhật 03/11/2026, đối chiếu `plan.md` của từng hạng mục với git. Đây là ảnh chụp để Dev B theo dõi, không thay roadmap hay
`plan.md`. Chưa có plan nào được Owner review hay `accepted`.

**Tóm lại:** 32 plan. Xong local 13, đang làm 1 (B07-10, đạt mức unit), chưa làm 18.

Git: commit `1f91c5a` (P00 → B07-8 và sổ prompt) đã push lên `origin/hien-dev`. Code B07-10 chưa commit. Chưa merge
`origin/dev`.

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

| Plan   | Hạng mục                 | Tình trạng                                                                                                                                        |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| B07-10 | `g8-internal-cost-entry` | Thiết kế và audit xong (`review-02.md`, F-01→F-06). Code có, **đạt mức unit**: typecheck xanh, unit 513/513 pass. Lỗi còn lại thuộc đợt test cuối |

## Cách test từ 03/11/2026

Dev B quyết định: mỗi plan chỉ cần `pnpm typecheck` và unit test của module. Lint, Prettier, gate, HTTP, integration,
tuần tự, E2E chạy **một lần ở đợt test cuối**, khi đã xong hết feature, trước khi xin Owner merge vào `dev`. Luật ở
[00-agent-rules.md](../00-agent-rules.md#verify-chung), prompt ở [promtingByHien.md](promtingByHien.md#đợt-test-cuối).

## Lỗi đỏ đã biết

Kiểm 03/11/2026 trên HEAD `1f91c5a` cộng code B07-10 chưa commit; Node 24.13.0, pnpm 11.1.3, PostgreSQL 17 trong
`slm-test-db`. Tất cả lỗi dưới đây đều ở code B07-10; phần code cũ không đỏ.

**Đã chạy và xanh:** `prisma:validate`, `prisma:generate`, `typecheck`, `test` (285 suites, 4.104 pass), `test:gates`
(317), `arch:check`, `arch:docs:check`, `test:scripts`, `test:discovery`, `build`, integration `budgets` trừ suite mới
(15 suites, 215 pass), integration `requests` (84 suites, 1.132 pass), HTTP `internal-costs` (27 pass).

**Chưa chạy:** `pnpm test:http` toàn bộ (lượt chạy bị dừng giữa chừng), `test:integration` toàn bộ, `test:integration:serial`,
`test:e2e`.

### 1. Prettier, `pnpm format:check` đỏ

`pnpm check` dừng ở bước này. Năm file cũ dùng xuống dòng `CRLF`, các dòng B07-10 thêm vào dùng `LF`, `prettier`
(`endOfLine: auto`) đòi thêm `␍`:

| File                                              | Dòng `LF` lẫn vào |
| ------------------------------------------------- | ----------------- |
| `src/modules/budgets/budget/commitment.repo.ts`   | 2                 |
| `src/modules/budgets/budgets.module.ts`           | 10                |
| `src/modules/catalog/public/catalog.api.ts`       | 10                |
| `src/modules/catalog/public/catalog.types.ts`     | 10                |
| `test/gates/architecture-boundaries.gate-spec.ts` | 1                 |

Tổng 33 dòng, đúng 33 lỗi `prettier/prettier` của ESLint. File mới của B07-10 toàn `LF`, không lỗi.

### 2. ESLint, `pnpm lint` đỏ: 10 lỗi ngoài Prettier

| File                                                              | Dòng             | Lỗi                                                    |
| ----------------------------------------------------------------- | ---------------- | ------------------------------------------------------ |
| `src/modules/budgets/budget/internal-cost-spend.policy.ts`        | 47               | `prorateInternalCostForYears` complexity 13, tối đa 12 |
| `src/modules/budgets/internal-cost/internal-cost-split.policy.ts` | 25               | `splitInternalCostAcrossPeriods` complexity 13         |
| `src/modules/budgets/internal-cost/internal-cost.repo.ts`         | 3                | import thừa `fromDateColumn`                           |
| `src/modules/budgets/internal-cost/internal-cost.service.ts`      | 86               | `any`: `no-explicit-any`, `no-unsafe-assignment`       |
| `test/integration/budgets/internal-cost.integration-spec.ts`      | 10               | import thừa `InternalCostCostCenterInvalidError`       |
| `test/integration/budgets/internal-cost.integration-spec.ts`      | 87, 88, 103, 104 | truy cập thuộc tính trên giá trị `any`                 |

Lint toàn repo chỉ có 43 lỗi này.

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

Bảy cặp ở dòng cuối: `internalCostRecord` 404, 409, 422; `internalCostGet` 404; `internalCostCancel` 404, 409, 422.

### 4. Integration `internal-cost.integration-spec.ts`: 11/11 đỏ

Cả 11 ca hỏng ở `beforeAll`, dòng 27 `h.start()`, trước khi tới code B07-10. Chuỗi bằng chứng:

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
- `CatalogApi.lockApplicationShared` gọi `ApplicationLookupService`; `origin/dev` đã đổi tên các service `-lookup`, nên sẽ lỗi
  compile khi merge.

## Chưa làm

B07-9 (lỗi một phần và credit note): plan code, chưa bắt đầu. Đóng `US-06-06` AC-9, AC-11.

16 plan thiết kế còn là khung `plan.md` 39 dòng:

| Gói  | Plan                                                                           |
| ---- | ------------------------------------------------------------------------------ |
| B-07 | B07-11 (cơ sở thực chi khi lỗi), B07-12 (khớp hóa đơn với thuê bao)            |
| B-08 | B08-1, B08-2, B08-3, B08-4, B08-5, B08-6, B08-7, B08-9                         |
| B-09 | B09-0 (chọn nơi đặt module G9, chưa có ADR), B09-1, B09-2, B09-3, B09-4, B09-5 |

B08-8 (tiết kiệm và hiệu quả sử dụng): `GATED`, chờ G7 và A-06.

Cổng còn chờ người khác:

| Plan          | Đang chờ                                                                               |
| ------------- | -------------------------------------------------------------------------------------- |
| B07-11, B09-1 | Dev A trả lời Q-10                                                                     |
| B08-5, B08-9  | A-06, A-10                                                                             |
| B08-7         | Vế usage chờ G7                                                                        |
| B08-6         | Owner xác nhận pin Docs mới có `QĐ-93`; bản đó bỏ chỉ số "số bước giao người thay thế" |
| B09-5         | Ca `OOS-24` phải hỏi Owner trước khi code                                              |

## Thứ tự tiếp theo

1. Commit B07-10: đã đạt mức unit.
2. Merge `origin/dev`: 9 file conflict, đổi import `budget-support.service` và các service `-lookup` theo tên mới, gồm cả
   `CatalogApi.lockApplicationShared`.
3. B07-9, rồi B09-0, B08-1 → B08-2 và các plan còn lại, mỗi plan chỉ unit test.
4. Đợt test cuối: sửa hết mục [Lỗi đỏ đã biết](#lỗi-đỏ-đã-biết) và lỗi mới, rồi xin Owner merge.
