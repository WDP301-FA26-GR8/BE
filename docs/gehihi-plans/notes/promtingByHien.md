# Sổ prompt cho bộ plan B

Tập hợp các prompt dùng cho Codex và `gemini-3.8 flash -high` trên bộ plan `docs/gehihi-plans/`. Copy nguyên khối, thay phần `<...>`.

File này chỉ giữ prompt. Tiến độ và bằng chứng ghi ở `plan.md` của hạng mục, không ghi ở đây.

## Cách dùng

1. Mỗi plan, hoặc mỗi phần của plan dài, là **một chat mới**.
2. Mỗi lúc chỉ chạy **một agent**. Các plan sửa chung file, chạy song song sẽ đè nhau.
3. Chạy đúng thứ tự trong [README](../README.md). Không nhảy cóc: B07-8 cần B07-7 xong.
4. Xong mỗi plan: đọc bàn giao, chạy `pnpm typecheck` và unit test của module, audit nếu plan chạm tiền hoặc khóa, rồi
   bạn mới commit. Từ 03/11/2026 chỉ cần unit test, HTTP và integration dồn vào [đợt test cuối](#đợt-test-cuối).
5. Prompt mặc định có `Chưa commit`. Bạn tự commit sau khi đọc diff.
6. Agent dừng vì cổng chưa thỏa là đúng. Đừng bảo agent giả định, mang câu hỏi về xin khuyến nghị rồi ghi vào `02-owner-decisions.md`.

## Chọn prompt nào

| Tình huống                          | Dùng mục                                         |
| ----------------------------------- | ------------------------------------------------ |
| Plan ngắn, có code hoặc chạy kiểm   | [1. Plan ngắn](#1-plan-ngắn)                     |
| Plan dài                            | [2. Plan dài](#2-plan-dài-chia-nhiều-chat)       |
| Plan chỉ viết thiết kế              | [3. Plan thiết kế](#3-plan-thiết-kế)             |
| Chat hết ngữ cảnh, agent dừng ngang | [4. Hết ngữ cảnh](#4-hết-ngữ-cảnh-hoặc-bị-ngắt)  |
| Code đã có nhưng chưa xong          | [5. Plan dở dang](#5-plan-dở-dang)               |
| Test đỏ, thiếu bằng chứng           | [6. Sửa lỗi](#6-sửa-lỗi-và-bổ-sung-bằng-chứng)   |
| Review sau khi code                 | [7. Audit](#7-audit)                             |
| Agent dừng ở cổng Q-10 hay Owner    | [8. Cổng chờ người khác](#8-cổng-chờ-người-khác) |

## Chọn agent

Prompt giống nhau cho cả hai agent. Bộ plan viết đủ chi tiết cho Gemini nên Codex dùng được nguyên.

| Việc                              | Agent gợi ý          | Ghi chú                             |
| --------------------------------- | -------------------- | ----------------------------------- |
| `AUDIT`, `DOCS`, schema, CRUD     | Gemini hoặc Codex    | Gemini đủ dùng                      |
| `DESIGN`                          | Gemini hoặc Codex    | Chạm tiền thì nên dùng Codex        |
| B07-6, B07-7, B07-8, B07-9, B09-4 | Codex                | Chạm công thức tiền hoặc khóa       |
| Audit các plan trên               | Model khác, chat mới | Không để agent tự audit code của nó |

Riêng Gemini, thêm khối này vào cuối mọi prompt:

```text
Chỉ đọc file ở mục Đọc trước, cần thêm thì đọc đúng file đó, không quét cả repo.
Không in lại nội dung file. Trả lời ngắn.
Sắp hết ngữ cảnh thì dừng ở điểm code còn build được và báo phần đã xong, phần còn lại.
```

Với Gemini, nếu một lượt của plan dài vẫn quá tải, tách tiếp theo từng bước (ví dụ `CHỈ làm bước 4`), rồi dùng prompt ở mục 4 để nối.

## 1. Plan ngắn

Dùng cho: P00, B05-1, B05-2, B10-1, B07-1, B07-3, B07-4, B07-7, B07-9.

```text
Đọc docs/gehihi-plans/00-agent-rules.md, rồi làm đúng docs/gehihi-plans/<file-plan>.md.
Chỉ làm plan này. Không sửa plan khác. Nếu Cổng vào chưa thỏa thì dừng và báo, không tự giả định.
Viết unit test đỏ trước, chạy thấy đỏ đúng lý do rồi mới sửa.
Chỉ chạy pnpm typecheck và pnpm test -- <thư mục module đã sửa>, theo mục Verify chung của 00-agent-rules.md.
Không viết hay chạy test HTTP, integration, E2E ở lượt này; dòng đó trong bảng Test để dành cho đợt test cuối.
Ghi bằng chứng vào mục Verification and handoff trong plan.md của hạng mục, ghi rõ HTTP và integration hoãn. Chưa commit.
Làm xong thì dừng và báo cáo theo mẫu bàn giao trong 00-agent-rules.md.
```

| Plan  | File                                       | Thêm vào prompt                                                                  |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| P00   | `p00-setup-baseline.md`                    | `Không chạy phần "Commit tài liệu bước 01".`                                     |
| P01   | `p01-spec-sync.md`                         | Chỉ sửa tài liệu, bỏ dòng test đỏ. Chạy sau khi duyệt `01-design-corrections.md` |
| B05-1 | `b05-1-evidence-rerun.md`                  | Không có                                                                         |
| B05-2 | `b05-2-transfer-read-for-heads.md`         | Không có                                                                         |
| B10-1 | `b10-1-approval-api-gaps.md`               | Không có                                                                         |
| B07-1 | `b07-1-invoice-schema.md`                  | Không có                                                                         |
| B07-3 | `b07-3-invoice-tax-lines.md`               | `Không sửa thêm gì của B07-8.`                                                   |
| B07-4 | `b07-4-invoice-read.md`                    | `Tiền trên route đọc dùng moneyView, không trả trường *Minor dạng chuỗi.`        |
| B07-7 | `b07-7-spent-one-source.md`                | Dùng prompt riêng ở mục 5                                                        |
| B07-9 | `b07-9-partial-failure-and-credit-note.md` | Chạy sau khi B07-8 xong                                                          |

## 2. Plan dài: chia nhiều chat

Mẫu chung:

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/<file-plan>.md.
Phần đã làm ở lượt trước: <chưa có / tên phần>. Xem bằng git diff, không làm lại.
Lần này CHỈ làm: <phần của lượt>. Các phần khác để lượt sau, không làm trước.
Cuối lượt chạy pnpm typecheck và unit test của đúng phần này. Giữ code build được, unit test đang xanh không bị đỏ.
Ghi phần đã xong vào plan.md của hạng mục. Chưa commit.
Dừng và báo cáo ngay sau phần này.
```

Mỗi lượt, kể cả lượt cuối, chỉ chạy typecheck và unit test. Các câu "chạy các lệnh ở mục Verify" trong prompt bên dưới
hiểu theo mục `Verify chung` của `00-agent-rules.md`, không chạy HTTP hay integration. Prompt B07-2 → B07-8 dưới đây là
bản đã dùng trước 03/11/2026, giữ để tra lại.

### B07-2: 3 chat

File `b07-2-invoice-record.md`. D2 và Q-13 đã có trả lời trong spec.

**Chat 1:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-2-invoice-record.md.
Lần này CHỈ làm bước 1 và 2. Không làm các bước sau. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**Chat 2:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-2-invoice-record.md.
Bước 1 và 2 đã xong, xem bằng git diff, không làm lại.
Lần này CHỈ làm bước 3. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**Chat 3:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-2-invoice-record.md.
D2 và Q-13 đã có trả lời, ghi ở mục Owner dispositions trong spec g8-invoice-recording.
Bước 1, 2, 3 đã xong, xem bằng git diff, không làm lại.
Lần này làm bước 4, 5 và phần Test, rồi chạy các lệnh ở mục Verify. Chưa commit.
Làm xong thì dừng và báo cáo.
```

### B07-5: 2 chat

File `b07-5-invoice-documents.md`. Cổng Q-10: phải báo Dev A trước, xem mục 8.

**Chat 1:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-5-invoice-documents.md.
Cổng Q-10 đã thỏa: ngày <dd/mm> tui đã báo Dev A qua <kênh>. Ghi việc này vào plan.md của g8-invoice-recording, thay cho dòng đang ghi chưa gửi tin.
Lần này CHỈ làm phần Migration và phần Code catalog. Code budgets, Test và Tài liệu để lượt sau.
Timestamp migration phải lớn hơn migration mới nhất trong prisma/migrations.
Ca US-04-04 AC-9 sẽ đỏ tới lượt sau vì Finance chưa có route gắn hóa đơn. Không sửa ca đó lượt này, chỉ báo lại.
Test khác trong catalog đỏ thì xử lý theo luật sửa ngoài plan trong 00-agent-rules.md.
Chưa commit. Làm xong thì dừng và báo cáo.
```

**Chat 2:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-5-invoice-documents.md.
Migration và Code catalog đã xong, xem bằng git diff, không làm lại.
Lần này làm Code budgets, Test, Tài liệu, rồi chạy các lệnh ở mục Verify, thêm pnpm test:http -- test/http/platform.
Ghi bằng chứng vào plan.md của g8-invoice-recording, không chỉ ghi trong note. Chưa commit.
Làm xong thì dừng và báo cáo.
```

### B07-6: 2 chat

File `b07-6-realization-schema-and-held.md`. Không tách "schema trước, fixture sau": CHECK mới làm đỏ harness ngay.

**Chat 1:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-6-realization-schema-and-held.md.
Lần này CHỈ làm phần Migration, phần Cập nhật fixture có căn cứ và các test SQL của ràng buộc.
Phần Code và các test còn lại để lượt sau.
Cuối lượt chạy pnpm typecheck và test ràng buộc. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**Chat 2:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-6-realization-schema-and-held.md.
Migration, fixture và test SQL đã xong, xem bằng git diff, không làm lại.
Lần này làm phần Code và các test còn lại, rồi chạy các lệnh ở mục Verify.
Ghi bằng chứng vào plan.md của g8-commitment-realization và sửa dòng Triển khai. Chưa commit.
Làm xong thì dừng và báo cáo.
```

### B07-8: 3 chat

File `b07-8-commitment-match.md`. Chỉ bắt đầu khi B07-7 xong. Ca F-07 trong bảng Test cần B07-3.

**Chat 1:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-8-commitment-match.md.
Lần này CHỈ làm bước 1, 2, 3. Không làm các bước sau. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**Chat 2:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-8-commitment-match.md.
Bước 1, 2, 3 đã xong, xem bằng git diff, không làm lại.
Lần này CHỈ làm bước 4 và 5. Chưa mở route HTTP. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**Chat 3:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-8-commitment-match.md.
Bước 1 tới 5 đã xong, xem bằng git diff, không làm lại.
Lần này làm bước 6, route HTTP và toàn bộ bảng Test, gồm test khóa, rồi chạy các lệnh ở mục Verify.
Mỗi dòng bảng Test phải có ca kiểm số thật. Tiền trên route dùng moneyView.
Ghi bằng chứng vào plan.md của g8-commitment-realization. Chưa commit.
Làm xong thì dừng và báo cáo.
```

## 3. Plan thiết kế

Dùng cho plan loại `DESIGN`. File ngắn vì chỉ viết spec, nhưng hạng mục vẫn phải code ở lượt sau. Mỗi hạng mục chạy 3 chat.

| Nhóm | Plan                                                                                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-07 | `b07-10-internal-cost-entry`, `b07-11-spend-basis-on-failure`, `b07-12-invoice-subscription-match`                                                                                                                              |
| B-08 | `b08-1-seat-cost-attribution`, `b08-2-spend-summary`, `b08-3-unallocated-cost-line`, `b08-4-period-close-report`, `b08-5-forecast`, `b08-6-process-performance-report`, `b08-7-data-quality-report`, `b08-9-finance-dashboards` |
| B-09 | `b09-0-module-placement`, `b09-1-statement-import`, `b09-2-discovery-findings`, `b09-3-finding-investigation`, `b09-4-charge-reconciliation`, `b09-5-finding-legalization`                                                      |

`b08-8-savings-and-usage-reports` là loại `GATED`, chưa chạy tới khi đủ điều kiện ghi trong plan.

**Chat 1, thiết kế:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md, rồi làm đúng docs/gehihi-plans/<file-plan>.md.
Chỉ làm plan này. Nếu Cổng vào chưa thỏa thì dừng và báo.
Plan này chỉ viết thiết kế, không code. Chưa commit.
Xong thì báo cáo theo mẫu bàn giao trong 00-agent-rules.md.
```

**Chat 2, audit thiết kế:**

```text
Đọc docs/workspace/prompts/02-review-design.md, áp dụng cho hạng mục docs/workspace/items/<hạng-mục>.
Chỉ audit và sửa spec, plan, test matrix. Không code. Chưa commit.
```

**Chat 3, code:** phải có dòng nói rõ đây là lượt code, nếu không agent đọc tới "Dừng, không code" sẽ dừng ngay.

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/<file-plan>.md.
Thiết kế của hạng mục <hạng-mục> đã xong. Lượt này là lượt code, bỏ qua câu "Dừng, không code" trong plan.
Làm theo Tasks trong docs/workspace/items/<hạng-mục>/plan.md, viết unit test đỏ trước.
Chỉ chạy pnpm typecheck và unit test của module. Test HTTP, integration trong plan.md để dành cho đợt test cuối. Chưa commit.
Làm xong thì dừng và báo cáo.
```

`plan.md` của hạng mục dài thì chia tiếp bằng mẫu ở mục 2.

**Sau chat 3, trước khi commit:** chạy [lệnh tự chạy](#lệnh-tự-chạy-sau-mỗi-plan). B07-10 từng ghi "verified" khi mới chạy
unit, trong khi HTTP `platform` và integration còn đỏ. Prompt chat 3 nên thêm dòng:

```text
Ghi "unit pass; HTTP, integration hoãn tới đợt test cuối". Không ghi verified.
```

**Lưu ý với các plan chưa chạy:** `QĐ-93` ở repo Docs đã đổi một phần nguồn. Trước khi chạy B08-6, hỏi Owner về pin Docs mới. Nếu Owner đồng ý, pull `../docs` rồi thêm vào prompt:

```text
Dùng Docs <commit>. US-12-06 AC-5 đã viết lại theo QĐ-93d, bỏ chỉ số số bước giao người thay thế, không làm theo dòng cũ trong plan.
```

## 4. Hết ngữ cảnh hoặc bị ngắt

Mở chat mới và dán:

```text
Đang làm dở docs/gehihi-plans/<file-plan>.md. Đọc 00-agent-rules.md và plan đó.
Chạy git status và git diff để xác định phần nào đã xong.
Liệt kê ngắn phần đã xong và phần còn lại, rồi làm tiếp đúng phần: <phần còn lại>.
Không làm lại phần đã xong. Không sửa test cũ để cho xanh. Chưa commit.
Làm xong thì dừng và báo cáo.
```

Nếu chat cũ còn phần bàn giao, thêm dòng:

```text
Bàn giao của lượt trước: <dán phần Đã xong, File đổi, Lệnh đã chạy, Câu hỏi còn mở>.
```

Agent lặp lại việc cũ hoặc trả lời lan man thì dừng chat đó, mở chat mới với prompt trên, không cố nói tiếp trong chat đã đầy.

## 5. Plan dở dang

**Mẫu chung:** code đã có, chỉ cần hoàn thiện, không thêm tính năng.

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/<file-plan>.md.
Code đã có. Lần này chỉ sửa các việc sau, không thêm tính năng:
1. <việc 1>
2. <việc 2>
Chạy Verify và pnpm check. Ghi bằng chứng vào plan.md của hạng mục. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**B07-7, khi B07-8 đang dở:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-7-spent-one-source.md.
DỪNG B07-8, không sửa thêm gì của B07-8 trong lượt này.
Làm trọn B07-7, kể cả bước 6 sửa spend-harness ghi hóa đơn thật.
Chạy Verify gồm test:integration budgets và requests trên database riêng.
Ghi bằng chứng B07-6 và B07-7 vào plan.md của g8-commitment-realization và sửa dòng Triển khai. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**B07-8, hoàn thiện sau khi có B07-7, B07-3, B07-4:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/b07-8-commitment-match.md.
Code B07-8 đã có. Lần này chỉ sửa các việc sau, không thêm tính năng:
1. Viết đủ các dòng bảng Test vào invoice-commitment-match.integration-spec.ts, kiểm số spent và còn lại thật.
2. Đổi matchedMinor, heldMinor, amountMinor sang moneyView như các route khác, cập nhật test và ví dụ.
3. Khai lỗi 404 và 409 khớp cam kết cho POST /invoices trong controller và manifest.
4. Thêm 4 message còn thiếu để openapi-response-examples xanh.
5. Xóa commitment-lock-concurrency.spec.ts.
6. Chuyển phần khớp lúc ghi từ invoice.service.ts sang InvoiceMatchService.
7. Sửa hết lỗi ESLint và Prettier ở các file B07-8, không thêm eslint-disable hay suppression.
Chạy Verify, pnpm test:http toàn bộ và pnpm check. Ghi bằng chứng vào plan.md. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**B07-10:** typecheck và unit đã xanh (513 pass) nên đủ mức của từng plan, commit được. Các việc đỏ còn lại thuộc đợt
test cuối, prompt ở [mục Đợt test cuối](#đợt-test-cuối).

**Merge `origin/dev` vào `hien-dev`:** chạy sau khi đã commit B07-10. Dùng Codex.

```text
Đọc AGENTS.md và docs/workspace/prompts/README.md, mục tích hợp khi dev đã đổi.
Merge origin/dev vào hien-dev, không rebase, không force-push. Giữ cả phần việc của dev và của hien-dev.
Giải conflict từng file. openapi.json và docs/generated không sửa tay, sinh lại bằng pnpm openapi:export, pnpm arch:graph, pnpm arch:routes.
dev đã đổi BudgetSupportService thành BudgetFactsService và đổi các service -lookup, -directory, -reader, -support
theo docs/rules/module-structure.md. Cập nhật toàn bộ code hóa đơn và chi phí nội bộ theo tên mới, kể cả file git
không báo conflict và CatalogApi.lockApplicationShared.
Không đổi nghiệp vụ, không nới test để cho xanh. Conflict nào phải đổi nghiệp vụ thì dừng và báo.
Chạy pnpm typecheck và pnpm test. HTTP và integration để dành cho đợt test cuối.
Ghi kết quả vào plan.md của g8-commitment-realization, ghi đúng agent và model. Để merge ở trạng thái chưa commit, dừng và báo cáo.
```

**Chạy lại bằng chứng cho plan đã code xong mà chưa ghi:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/<file-plan>.md.
Không viết thêm tính năng. Code đã có nhưng plan.md của <hạng-mục> chưa có bằng chứng phần này.
Chạy pnpm typecheck và unit test của module.
Ghi bằng chứng vào mục Verification and handoff của plan.md, nêu rõ AC đã và chưa chứng minh.
Nếu test đỏ thì báo nguyên nhân, chưa sửa. Chưa commit.
```

## 6. Sửa lỗi và bổ sung bằng chứng

**Test đỏ:**

```text
Lệnh <lệnh> đang đỏ ở <tên test>. Tìm nguyên nhân gốc trước, chưa sửa.
Báo: đỏ do code mới, do test có sẵn, hay do môi trường.
Chỉ sửa nếu lỗi do code của plan <file-plan>.md gây ra.
Không tắt test, không nới assert, không thêm mục ngoại lệ. Không phải do plan thì dừng và báo.
```

**Code làm hỏng service ngoài plan:** Owner cho sửa luôn, nhưng phải ghi note.

```text
Code của <file-plan>.md làm hỏng <service hoặc test>. Sửa đúng phần bị ảnh hưởng theo luật sửa ngoài plan trong 00-agent-rules.md.
Ghi note ở docs/gehihi-plans/notes/<số>-<tên>.md: hỏng gì, vì sao, sửa gì, lệnh kiểm chứng và kết quả.
Không đổi nghiệp vụ, quyền truy cập hay API công khai của service đó, cần đổi thì dừng và báo.
Chưa commit.
```

**Một việc nhỏ ngoài luồng:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md. Chỉ làm đúng việc sau, không làm gì thêm: <việc>.
Chạy lệnh kiểm chứng liên quan rồi báo kết quả. Chưa commit.
```

## 7. Audit

Chạy ở chat mới, nên dùng model khác với model đã code. Bắt buộc với B07-6, B07-7, B07-8, B09-4.

**Audit code:**

```text
Đừng sửa gì. Đọc docs/gehihi-plans/<file-plan>.md và mục liên quan trong 01-design-corrections.md,
rồi review git diff so với AC trong plan. Kiểm: công thức tiền, transaction, thứ tự khóa, quyền âm,
test có chứng minh đúng AC không. Chỉ báo lỗi kèm file, dòng và tình huống gây sai.
Không có lỗi thì nói không có.
```

**Audit thiết kế:** xem chat 2 ở mục 3.

**Kiểm thứ tự plan trước khi chạy tiếp:**

```text
Đừng sửa gì. Đọc docs/gehihi-plans/README.md, rồi chạy git status.
Đối chiếu code với thứ tự plan: plan nào đã có code, plan nào phụ thuộc nhưng chưa xong, plan nào thiếu bằng chứng trong plan.md.
Báo ngắn thành bảng, không đề xuất tính năng mới.
```

## 8. Cổng chờ người khác

Tin gửi Owner nằm ở [02-owner-decisions.md](../02-owner-decisions.md), mục `Tin báo Owner`.

**Owner đã trả lời, chạy tiếp:**

```text
Đọc docs/gehihi-plans/00-agent-rules.md và docs/gehihi-plans/<file-plan>.md.
Owner đã trả lời ngày <dd/mm>, nguyên văn:
- <mã>: "<câu trả lời của Owner>"
Trước khi code, ghi câu trả lời vào bảng Owner dispositions trong spec của hạng mục, không tự thêm ý.
Câu trả lời làm đổi thiết kế thì dừng và báo, chưa code.
Sau đó làm tiếp <phần>. Chưa commit.
Làm xong thì dừng và báo cáo.
```

**Câu mới dùng khuyến nghị:** Owner cho dùng khuyến nghị trước. Ghi nhãn `Tạm theo khuyến nghị`, không ghi là Owner duyệt.

```text
Ghi <mã> vào bảng Owner dispositions của spec: trạng thái "Tạm theo khuyến nghị, Owner ủy quyền 01/11/2026", phương án <phương án>.
Không ghi là Owner duyệt hay accepted. Sau đó làm tiếp <phần>. Chưa commit.
```

**Báo Dev A trước khi sửa `catalog` (Q-10):** gửi xong là qua cổng, không cần chờ trả lời, trừ khi A phản đối.

```text
Chào A, gói B-07 của mình sẽ đụng catalog, mình báo trước. Code ở nhánh hien-dev.

Đã thêm, chưa merge:
- CatalogApi.getSubscriptionSummaries và isVendorUsable, chỉ đọc.

Sắp làm ở B07-5:
- Bảng document_attachments thêm cột invoice_id, có FK tới invoices. Thay 2 CHECK là document_attachments_owner_state và document_attachments_purpose_fits_owner.
- Thêm CatalogApi.attachDocumentToInvoice, document.service attachToInvoice, policy assertMayAttachTo.
- Có một luật siết: Finance không còn gắn PURCHASE_DOCUMENT vào hợp đồng, phải gắn vào hóa đơn, theo bảng mục đích của US-04-04. IT Admin gắn báo giá vào hợp đồng vẫn như cũ. Ca US-04-04 AC-9 trong document-http.integration-spec.ts sẽ đổi theo.

Về sau:
- B09-1 mở COST_STATEMENT, thêm statement_import_id, đổi CHECK lần nữa.
- B07-11 có bảng purchase_documents ở catalog, mình cần chốt ai giữ.

A có đang sửa contract.policy.ts, document.service.ts hay bảng document_attachments không? Có thì báo mình để tránh đụng nhau. Luật siết trên mà ảnh hưởng FE thì cũng báo mình nhé.
```

## Lệnh tự chạy sau mỗi plan

```powershell
pnpm typecheck
pnpm test -- src/modules/<module đã sửa>
```

Plan chỉ sửa tài liệu thì chạy `pnpm rules:check` và `pnpm rules:format`.

## Đợt test cuối

Chạy một lần khi đã xong hết feature, trước khi xin Owner merge vào `dev`. Cần Docker và database riêng theo
[test guide](../../../test/README.md).

```powershell
pnpm check
pnpm test:http
pnpm test:integration
pnpm test:integration:serial
pnpm test:e2e
```

Lỗi đã biết phải sửa ở đợt này, kiểm ngày 03/11/2026 (chi tiết ở [gehihi-done.md](gehihi-done.md#lỗi-đỏ-đã-biết)):

```text
Đọc docs/gehihi-plans/00-agent-rules.md, mục Đợt test cuối, và docs/gehihi-plans/notes/gehihi-done.md, mục Lỗi đỏ đã biết.
Đây là đợt test cuối. Sửa từng lỗi trong danh sách, không thêm tính năng, không đổi nghiệp vụ.
Không thêm eslint-disable, không .skip, không nới assert.
Chạy pnpm check, pnpm test:http, pnpm test:integration, pnpm test:integration:serial, pnpm test:e2e.
Lỗi mới ngoài danh sách thì tìm plan gây ra, sửa và ghi vào plan.md của hạng mục đó. Ghi đúng agent và model. Chưa commit.
Làm xong thì dừng và báo cáo.
```
