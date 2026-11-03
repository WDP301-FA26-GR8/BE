# Luật chung cho mọi lượt

Áp dụng cho agent thực thi. Plan đơn lẻ chỉ ghi phần riêng; phần chung nằm ở đây.

## Trước khi làm

1. Đọc `AGENTS.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, rồi file plan được giao.
2. Đọc mục `Đọc trước` của plan. Không nạp cả BRD, roadmap hay toàn bộ ADR.
3. Kiểm: `git branch --show-current` phải là `hien-dev`; `git status --short` để biết thay đổi có sẵn.
4. Kiểm `Cổng vào`. Thiếu một điều kiện là dừng, không tự giả định câu trả lời.

## Được và không được

- Mỗi lượt đúng **một** plan. Xong thì dừng, kể cả khi còn sức.
- Không commit, push, tạo PR, merge, deploy nếu người giao không nói rõ trong lượt đó. Được phép thì chỉ commit/push
  nhánh `hien-dev`, không force-push, không `git add .`.
- `.vscode/settings.json`, `.github/workflows/ci.yml` có thay đổi sẵn, không thuộc phạm vi. Không stage, không sửa.
- Không đọc `.env`, không chạm VPS hay database dùng chung, không dùng dữ liệu cá nhân thật.
- Chỉ sửa file của plan. Riêng khi code của plan làm hỏng service hoặc test ngoài plan, kể cả ở module khác, thì sửa luôn đúng phần bị ảnh
  hưởng (Owner cho phép 01/11/2026). Việc khác ngoài plan thì không làm, kể cả lỗi tiện thấy.
- Mỗi lần sửa ngoài plan phải ghi note ở `docs/gehihi-plans/notes/<số>-<tên>.md`: hỏng gì, vì sao, sửa gì, lệnh kiểm chứng và kết quả. Sửa vào
  `catalog` hay phần của Dev A thì ghi rõ để Dev B báo A. Bàn giao nêu tên note để Owner review.
- Không tự quyết nghiệp vụ. Không ghi `accepted`, `Owner approved`, `Owner duyệt`, `released`, `merged-dev`.
- Mã đã có nhãn `Owner trả lời` hoặc `Tạm theo khuyến nghị` trong `02-owner-decisions.md` thì làm đúng phương án đó, tính là cổng đã thỏa.
  Câu hỏi mới chưa có nhãn thì vẫn dừng và báo.
- Không suy diễn từ tên biến khi AC nói khác. Nguồn AC: `../docs/BE-UserStory/src/EP-xx.md`, tìm theo mã `US-xx-yy`.

## Dừng và báo khi

- Plan, spec, AC và code nói khác nhau, và khác biệt đó đổi hành vi.
- Test đỏ mà không do code của plan gây ra.
- Phải nới assert, tắt test hoặc đổi kỳ vọng nghiệp vụ của test cũ mới xanh được. Test cũ, fixture chỉ cần đổi theo thay đổi kỹ thuật thì sửa và
  ghi note. Gate chỉ sửa khi plan cho phép đúng file đó và nói lý do.
- Sửa phần ngoài plan mà phải đổi nghiệp vụ, quyền truy cập hoặc API công khai của service đó.
- Phải thêm mục vào danh sách ngoại lệ, gồm `REQUESTS_CONTROLLER_IMPORTED`, `CORE_PRIMITIVES_OF_ONE_AREA`,
  `RUNTIME_TABLE_EXCEPTIONS`, `RUNTIME_SEQUENCE_EXCEPTIONS`, hoặc thêm `eslint-disable`.
- Phải thêm cạnh module không có trong plan, hoặc import ngược tầng.

Báo theo mẫu: đã làm gì, dừng ở đâu, bằng chứng (lệnh, kết quả), câu hỏi cụ thể, phương án kèm khuyến nghị. Không đoán rồi làm tiếp.

## Kiến trúc

- Tầng: T1 `audit`, `notifications`; T2 `organization`, `identity-access`; T3 `finance`, `operating-parameters`;
  T4 `catalog`, `licensing`; T5 `budgets`, `requests`, `data-import`; T6 `personnel`, `onboarding`, `installation`.
  Chỉ import xuống dưới, cùng tầng chỉ `requests → budgets`, `licensing → catalog`, `identity-access → organization`,
  `operating-parameters → finance`. **`budgets` không import được `requests`.**
- Module khác chỉ đi qua `public/` hoặc `*.module.ts`. Không query bảng module khác.
- Capability không được tạo vòng: `a → b → a` làm gate `capability-graph` đỏ. Trong `budgets`, lõi `budget/` không
  import capability nào; capability import lõi.
- Hậu tố quyết định vai trò: `.controller` HTTP, `.service` một use case, `.policy` hàm thuần, `.repo` toàn bộ SQL,
  `.mapper`, `.dto`, `.errors`, `.http-errors`, `.listener`, `.job`.
- Tối đa 2 cấp thư mục dưới module, 25 file mỗi thư mục. Không thư mục `dto/`, `services/`, `utils/`, `common/`.
- Test file trong `test/http`, `test/integration`, `test/e2e` tối đa 800 dòng.
- Tiền chỉ đọc và quy đổi qua `FinanceApi` (`parseMoney`, `snapshotMoney`). Không tự nhân tỷ giá. Thiếu tỷ giá đúng ngày
  thì từ chối, không lấy tỷ giá gần nhất.
- Năm ngân sách là **năm tài chính**, không phải năm dương lịch: dùng `fiscalYearOf` ở `src/core/fiscal-year.ts`.
- Comment trong code viết tiếng Anh theo giọng file lân cận, dẫn mã AC khi cần. Bắt chước file gần nhất, không tự đặt phong cách.

## Database

- Migration mới: thư mục `prisma/migrations/YYYYMMDDHHMMSS_snake_case/migration.sql`, timestamp hợp lệ và lớn hơn mọi
  migration đang có. Mốc lớn nhất lúc lập plan: `20261029101100`. Không sửa migration đã có.
- Không `GRANT`, `REVOKE`, `OWNER TO` trong migration. Không `SECURITY DEFINER`.
- Bảng mới thêm vào `PRISMA_MODEL_OWNER` ở `test/gates/architecture-boundaries.gate-spec.ts`.
- Không thêm dòng vào `scripts/verify/merged-migrations.txt`; danh sách đó cập nhật khi merge bản phát hành.
- Không `Promise.all` trên `tx`. Ghi audit cùng transaction với thay đổi. Gọi mạng sau commit.
- Sau khi đổi schema: `pnpm prisma:format`, `pnpm prisma:validate`, `pnpm prisma:generate`, rồi kiểm không lệch bằng
  `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma --exit-code` trên database test riêng.

## API

- Mỗi route có `RequireRoles`, DTO Zod, OpenAPI đủ mã lỗi và ví dụ, theo `docs/rules/api-contract.md`.
- Thêm operation vào `test/support/api-coverage-manifest.ts`; thêm ví dụ vào `test/support/openapi-example-manifest.ts`
  nếu gate yêu cầu.
- Collection trả tóm tắt, có phân trang và thứ tự ổn định; trang và tổng đọc cùng snapshot (`API-LIST-DETAIL.1`).
- File sinh tự động chỉ đổi qua generator: `pnpm openapi:export`, `pnpm arch:routes`, `pnpm arch:graph`.

## Test

| Tầng        | Vị trí                                            | Dùng cho                          | Lệnh                              |
| ----------- | ------------------------------------------------- | --------------------------------- | --------------------------------- |
| Unit        | cạnh source, `*.spec.ts`                          | policy, mapper, schema DTO        | `pnpm test -- <path>`             |
| Gate        | `test/gates/`                                     | kiến trúc, migration              | `pnpm test:gates`                 |
| HTTP        | `test/http/<module>/*.http-spec.ts`               | quyền, validate, mã lỗi; không DB | `pnpm test:http -- <path>`        |
| Integration | `test/integration/<module>/*.integration-spec.ts` | SQL, CHECK, trigger, transaction  | `pnpm test:integration -- <path>` |
| Tuần tự     | `test/integration/_serial/`                       | khóa, role cluster                | `pnpm test:integration:serial`    |
| E2E         | `test/e2e/`                                       | hành trình chính                  | `pnpm test:e2e`                   |

- Viết test đỏ trước khi sửa, thấy nó đỏ đúng lý do, rồi mới sửa. Đáp án lấy từ AC, không chép từ output code.
- Test đồng thời dùng khóa tất định ở `test/support/concurrency-harness.ts`, không sleep, không đua một lần.
- Database test theo `test/README.md`. Không đặt secret vào file.
- Không tắt test, không `.skip`, không nới assert.

## Verify chung

**Dev B quyết định ngày 03/11/2026:** trong lúc làm từng plan chỉ cần unit test. Các tầng test khác dồn vào **đợt test
cuối**, chạy một lần khi đã xong hết feature. Luật này ghi đè mục `Verify` và bảng `Test` trong từng file plan.

Cuối mỗi plan có code, chỉ chạy:

```powershell
pnpm typecheck
pnpm test -- <thư mục module đã sửa>
```

- Viết unit test đỏ trước cho policy, mapper, service, rồi mới sửa code.
- Không bắt buộc viết hay chạy test HTTP, integration, tuần tự, E2E. Plan có các dòng đó trong bảng `Test` thì giữ nguyên
  làm danh sách cho đợt test cuối. File test đã có thì giữ, không xóa, không `.skip`.
- Vẫn chạy generator khi đổi route hoặc module: `pnpm openapi:export`, `pnpm arch:routes`, `pnpm arch:graph`.
- Plan chỉ sửa tài liệu: `pnpm rules:check`, `pnpm rules:format`.

**Đợt test cuối**, chạy trước khi xin Owner merge vào `dev`:

```powershell
pnpm check
pnpm test:http
pnpm test:integration
pnpm test:integration:serial
pnpm test:e2e
```

Lỗi gặp ở đợt này sửa theo từng plan gây ra, ghi vào `plan.md` của hạng mục đó.

## Ghi lại và bàn giao

- Bằng chứng ghi vào `docs/workspace/items/<hạng-mục>/plan.md`, mục `Verification and handoff`: lệnh, revision hoặc
  fingerprint cây làm việc, môi trường, số test, AC đã chứng minh, giới hạn.
- Ghi đúng mức đã kiểm: `unit pass; HTTP, integration hoãn tới đợt test cuối`. Không ghi `verified` khi chưa qua đợt test
  cuối. AC chỉ có bằng chứng HTTP hoặc integration thì ghi là chưa chứng minh.
- Ghi đúng agent và model thực dùng của lượt đó, ví dụ Codex hoặc `gemini-3.8 flash -high`; không ghi là Opus hay Sonnet nếu không dùng.
- Đổi hành vi so với spec thì cập nhật spec cùng lượt, kèm lý do. Đổi nghiệp vụ thì dừng hỏi.
- Không chép log dài, không lưu token, password, connection string.

Tin bàn giao cuối lượt:

```text
Plan: <id>
Đã xong: <task>
AC có bằng chứng: <mã AC → test>
AC chưa chứng minh: <mã + lý do>
File đổi: <danh sách>
Migration/API đổi: <có/không, tên>
Lệnh đã chạy và kết quả: <lệnh → số pass/fail>
Câu hỏi còn mở: <mã>
Plan kế tiếp đề xuất: <id>
```
