# AUDIT WDP-2 — prompt 5 vào BE WDP, adapter MongoDB cho `AiInvocationHistoryStore`

- **Repo:** `D:\FPT\FALL2026\Code\be-wdp-2`, nhánh `feat/wdp-p5`.
  - HEAD `b8d2d9bf`. Đã kiểm lại `git log` sau khi phiên bị ngắt: không có commit mới. Worktree sạch.
  - Phạm vi `1e760cbc..b8d2d9bf`: 2 commit (`3f0b8bce` patch P5 + adapter, `b8d2d9bf` test `stuckOf`).
- **So với:** SEP `D:\FPT\FALL2026\Code\be-p5-int` @ `d3757876` (`feat/p5`).
- **Cách đọc:** chỉ đọc qua `git`, `diff`, file. Không chạy pnpm/jest/docker, không đổi nhánh.
  - Không thấy `WDP-2-DONE.md` trong `verify-logs\p5`. Vì vậy không đối chiếu được bảng lệnh, link CI hay D-n của chat code.
- **Skill đã dùng:**
  - `agent-skills:code-review-and-quality`: review 5 trục, phân mức Critical/Required/Optional/Nit.
  - `superpowers:verification-before-completion`: chỉ kết luận khi có bằng chứng git/file. Không tuyên bố test/CI xanh vì không chạy.

## Kết luận

**Chưa sẵn sàng để Owner merge dev → main.** Không có Critical. Có 3 Required, đều nhỏ (tổng khoảng 2–3 giờ, kèm test):

- **R-1:** đọc MongoDB đang nằm trong transaction PostgreSQL. Điều này trái luật của `TransactionRunner` và đảo thiết kế WDP-1 đã audit. Test ghim thiết kế cũ cũng bị thay.
- **R-2:** WDP bỏ 2 ca integration của SEP ghim hành vi theo `provider_mode` trên PostgreSQL thật.
- **R-3:** README module và JSDoc port vẫn mô tả bản PostgreSQL `ai_invocation_contents`, mâu thuẫn với code WDP.

Kết quả các mục được giao:

- Adapter Mongo cài đúng port:
  - `recordAdmitted`/`recordAnswered` ghi outbox trong tx của người gọi; không ghi MongoDB trong tx.
  - `find` trả `record | null`; `countPurgeable`/`purge` đúng hợp đồng.
  - DI bind đúng một adapter ở 2 module.
  - Không còn query nào tới `ai_invocation_contents` trong `src/` (chỉ còn trong migration cũ, test backfill, recovery và tài liệu).
- Phần AI của C còn đủ: `provider_mode`, `simulated`, chặn stub, unique index theo mode, migration `20261117120000`.
- Không mất gì của WDP-1: recovery, preflight, CI có mongo, compose prod, worker, purge, 409/503.
- Số liệu khớp SEP: 426 operation, 30 tham số vận hành.

## Bảng kiểm theo brief

| # | Mục | Kết quả | Căn cứ |
|---|-----|---------|--------|
| 1a | Adapter cài đúng port | ĐẠT | `src/modules/ai-assist/invocation-history/invocation-history-mongo.repo.ts:58-161` `implements AiInvocationHistoryStore`; `find` trả `InvocationContentRecord \| null` (`:104-130`) |
| 1b | Ghi qua outbox cùng tx với `ai_invocations` | ĐẠT | `recordAdmitted`/`recordAnswered` → `outbox.enqueueSnapshot(tx, …)` (`:67-96`); điểm gọi trong tx: `queue-summary.service.ts:204,308`, `queue-summary-run.service.ts:230` (cùng `runner.run` với `repo.finish` và audit) |
| 1c | DI đúng một adapter | ĐẠT | `ai-assist.module.ts:47-48`, `purge/ai-assist-purge-cli.module.ts:24-25` (`useExisting: MongoInvocationHistoryRepo`); không còn provider nào khác cho token |
| 1d | `findOwned`/purge/`stuckOf`/content không đọc bảng đã xóa | ĐẠT | `invocation.repo.ts:163-185` (`historyState notIn PURGING/PURGED`, `result` từ `ai_invocation_results`); `dropResults` `:207-211`; `stuckOf` `:109-115`; `git grep` `ai_invocation_contents\|aiInvocationContent` trong `src/` chỉ còn comment, codec cũ, recovery, audit `resourceType` |
| 2a | `provider_mode` lưu/đọc, `simulated` | ĐẠT | `invocation.repo.ts:83,173,188-192`; `queue-summary-view.policy.ts`, `queue-summary.dto.ts` giống hệt SEP |
| 2b | Chặn stub | ĐẠT | `ai-service/ai-service-client.service.ts:177` (`answer.data.modelId === STUB_MODEL_ID`) |
| 2c | Unique index theo mode + migration sau `20261116100000` | ĐẠT (tĩnh) | Migration giống hệt SEP; `20261116100000` không đụng `ai_invocations_active_per_revision`; schema test `ai-invocations-schema.integration-spec.ts:187-196`. Chưa chạy `migrate deploy`/`migrate diff` (ngoài phạm vi chỉ đọc) |
| 3 | Giữ WDP-1 | ĐẠT | `git diff --stat 1e760cbc..b8d2d9bf` không đụng `scripts/ops`, `.github`, `docker-compose.prod.yml`, `src/worker`, `src/cli`, `src/modules/installation`, `src/infrastructure/mongodb`; `Dockerfile:36` vẫn khai `ai-history-outbox`; `invocation-content.http-errors.ts` (409/503) không đổi; OpenAPI chỉ khác SEP ở route content (thêm 409, 503 có `AI.HISTORY_UNAVAILABLE`) |
| 4 | Kiến trúc/gates | ĐẠT (gate), có O-1 | Gate `architecture-boundaries`/`module-graph` khác SEP chỉ ở phần WDP-1 (`AiInvocationResult`, `AiHistoryDelivery`, `AiAssistHistoryFacadeModule: AiHistoryDeliveryApi`); `docs/generated/module-graph.md` và `routes.md` giống hệt SEP |
| 5a | Test AI có nới assertion | **CÓ** | R-1 (ca "reads MongoDB outside the transaction" bị thay), R-2 (2 ca SEP bị bỏ) |
| 5b | Test Mongo cần `TEST_MONGODB_URI` | ĐẠT | `test/support/disposable-history-store.ts:27-31` throw nếu thiếu; CI: `integration` (3 shard), `integration-inband`, `e2e-smoke` đều có service `mongo:8.0` và `TEST_MONGODB_URI` |
| 5c | Tham số 30, số operation | ĐẠT | `operating-parameters-http.integration-spec.ts:550` `toBe(30)`; `openapi.json` 426 operation, bằng SEP |

## Findings

### R-1 — Required — Đọc MongoDB trong transaction PostgreSQL: trái luật `TransactionRunner`, đảo thiết kế WDP-1 đã audit

- **Vị trí (`b8d2d9bf`):**
  - `src/modules/ai-assist/invocation-content/invocation-content-query.service.ts:32-33`: `runner.run(async (tx) => { const found = await this.contents.find(tx, invocationId); …`.
  - `src/modules/ai-assist/invocation-history/invocation-history-mongo.repo.ts:104-108`: `find` gọi `this.documentOf(...)` → `this.store.find(...)`, tức gọi mạng MongoDB, trong `tx` của caller.
  - Luật bị vi phạm: `src/infrastructure/database/transaction-runner.ts:117`, "Network calls do not belong in `work`; they run after commit."
  - README ghi lại thiết kế mới như thể đúng: `src/modules/ai-assist/README.md:147-148` ("mọi bước trong transaction của lần đọc").
- **So với WDP-1 (`1e760cbc`):**
  - `invocation-content-query.service.ts` cũ đọc `standingOf` và MongoDB **ngoài** tx, rồi mới mở một tx ngắn để khóa, kiểm lại và ghi audit.
  - Unit test ghim điều đó ("reads MongoDB outside the transaction, then locks the call…") đã bị thay bằng `invocation-history-mongo.repo.spec.ts:190-196`. Ca mới chỉ kiểm thứ tự `standing → mongo → lock`, không kiểm "ngoài tx".
- **Kịch bản lỗi:**
  1. MongoDB chậm hoặc chết. Mỗi lần Super Admin đọc nội dung giữ một connection pool PostgreSQL ở trạng thái mở transaction trong suốt `serverSelectionTimeoutMS` cộng `socketTimeoutMS`: mặc định 2 s + 3 s.
  2. Validator cho phép `MONGODB_SERVER_SELECTION_TIMEOUT_MS` tới 30 000 và `MONGODB_OPERATION_TIMEOUT_MS` tới 60 000 (`src/infrastructure/mongodb/mongodb.config.ts:33-34`). Trong khi đó `DB_TRANSACTION_TIMEOUT_MS` mặc định 10 000 (`src/infrastructure/config/database-environment.ts:47`), và không có kiểm chéo giữa hai bên.
  3. Người vận hành tăng timeout Mongo (ví dụ 15 s cho VPS chậm). Transaction Prisma hết hạn trước khi Mongo trả lời, nên lỗi thành `TransientDatabaseError` (P2028) → 503 `SERVICE_UNAVAILABLE` chung, không còn là `AI.HISTORY_UNAVAILABLE` như hợp đồng route.
- **Căn cứ:**
  - Luật repo ở `transaction-runner.ts:117`.
  - ADR-0020 và thiết kế WDP-1 đã audit ĐẠT (`AUDIT-WDP-1-review.md`).
  - Gốc của lỗi là chữ ký port SEP `find(tx, invocationId)` (`invocation/invocation-history-store.types.ts:42`) buộc đọc trong tx. Chat code đã chọn giữ nguyên query service của SEP mà không ghi D-n.
- **Cách sửa (chọn một, ghi D-n):**
  - **A (gọn, giữ port SEP):**
    - Thêm kiểm chéo khi khởi động: `MONGODB_SERVER_SELECTION_TIMEOUT_MS + MONGODB_OPERATION_TIMEOUT_MS < DB_TRANSACTION_TIMEOUT_MS`, nếu sai thì chặn start, đặt cạnh `mongoSettingsFrom`.
    - Sửa `README.md:147-148` để nói rõ đây là ngoại lệ có chủ đích của luật `transaction-runner.ts:117`, kèm giới hạn trên.
    - Ghi D-n trong `WDP-2-DONE.md`.
    - Test: `mongodb.config.spec.ts` thêm ca 8000 + 3000 với tx 10 000 thì bị từ chối, và ca mặc định được nhận.
  - **B (đúng thiết kế WDP-1):**
    - Tách `find` của port thành `prepare(invocationId)` đọc ngoài tx (standing + Mongo) và `confirm(tx, prepared)` khóa `FOR SHARE`, kiểm lại, trả record.
    - Query service gọi `prepare` trước `runner.run`.
    - Đổi port SEP nên cần Owner quyết; nếu chọn B thì đưa lại vào `feat/p5` cho hai repo giống nhau.
    - Test: khôi phục ca "reads MongoDB outside the transaction" (fake `runner.run` ghi `order`, khẳng định `mongo` trước `tx-open`).

### R-2 — Required — Bỏ 2 ca integration của SEP ghim `provider_mode` trên PostgreSQL thật

- **Vị trí:**
  - SEP `be-p5-int/test/integration/ai-assist/invocation-repo.integration-spec.ts:248-264` ("keeps one call per queue revision and mode…") và `:266-276` ("gives the stuck calls of the person in every mode, each with its mode").
  - Cả hai ca không có trong `be-wdp-2/test/integration/ai-assist/invocation-repo.integration-spec.ts`; file WDP kết thúc ở ca `SOURCE_UNREADABLE`, khoảng `:170-182`.
- **Kịch bản:**
  - Hai ca này chỉ dùng `ai_invocation_contents` ở helper `insertWithContent` và `store.find`. Phần còn lại (`repo.insert`, `findLive`, `findOwned`, `stuckOf`, P2002 trên index) chạy được nguyên trên WDP. Đúng ra phải port, không phải xóa.
  - Mutation sống sót trên WDP: đổi `stuckOf` (`invocation.repo.ts:111`) từ `ownedBy(owner)` sang `whose(owner as InvocationKey)`, tức chỉ lấy cùng mode. Kết quả:
    - Ca integration duy nhất còn lại (`queue-summary-failures.integration-spec.ts:306-334`) chỉ dùng mode `MODEL`, vẫn xanh.
    - Unit dùng fake, không chạy SQL.
    - Lần gọi `SIMULATED` kẹt sẽ không bao giờ bị lấy làm `FAILED` khi Super Admin đã chuyển sang `MODEL`. Đây là đúng điều QĐ-102b/AC-17 cấm.
  - Hành vi index theo mode (hai lần gọi khác mode cùng revision cùng sống, lần thứ ba cùng mode thì P2002) chỉ còn được ghim bằng regex `indexdef`, không bằng hành vi.
- **Căn cứ:** brief mục 5 ("Test AI có nới assertion không"); SEP đã có test, WDP làm giảm phủ.
- **Cách sửa (khoảng 30 phút):** chép 2 ca sang WDP, thay `insertWithContent` bằng `runner.run((tx) => repo.insert(tx, input))`.
  - Thay `store.find(tx, second.id)` bằng `runner.run((tx) => repo.providerModeOf(tx, second.id))` → `'SIMULATED'`.
  - Giữ nguyên các assertion `findLive` theo mode, `isUniqueViolation(…, 'ai_invocations_active_per_revision', 'source_revision')`, `findOwned(...).providerMode`, `stuckOf` trả cả hai mode.
  - Chứng minh test có tác dụng: áp mutation ở trên thì ca thứ hai phải đỏ.

### R-3 — Required — README module và JSDoc port mô tả kho PostgreSQL không còn trên WDP

- **Vị trí:**
  - `src/modules/ai-assist/README.md:45-48`: "Mọi đọc/ghi `ai_invocation_contents` … bản hiện có là PostgreSQL (`AiInvocationContentRepo`…)". Class và bảng này không tồn tại trên WDP.
  - `:57-64`: `findOwned` "lấy sự tồn tại của hàng `ai_invocation_contents`… `content: { isNot: null }`". Code WDP dùng `historyState notIn PURGING/PURGED` (`invocation.repo.ts:165`).
  - `:66-69`: "đổi `provide` … chọn theo env, không sửa…". WDP không chọn theo env, và đã sửa `findOwned`/`purge`.
  - Câu ở `:37` lại nói adapter là `MongoInvocationHistoryRepo`, nên README tự mâu thuẫn.
  - JSDoc port `src/modules/ai-assist/invocation/invocation-history-store.types.ts`:
    - `:6` ("PostgreSQL in this repo");
    - `:12-14` (`findOwned` lấy hàng `ai_invocation_contents`);
    - `:18-19`, `:27-28` ("relies on the row the PostgreSQL store writes here", "reads the `result` column the PostgreSQL store writes here"): sai trên WDP, vì `result` do `AiInvocationRepo.finish` ghi (`invocation.repo.ts:149-154`).
- **Kịch bản:** người tiếp theo (FE hỏi, dev Hiển, agent) đọc README hoặc JSDoc rồi tìm `AiInvocationContentRepo` hoặc nghĩ `recordAnswered` ghi `result`. Ví dụ dời `finish` sang không ghi `result` thì `GET` tóm tắt mất hàng chờ. Cùng loại lỗi với AUDIT-C R-2, khi đó được xếp Required.
- **Cách sửa (khoảng 15 phút, chỉ tài liệu):**
  - README `:45-69` viết lại cho WDP: port cài bởi `MongoInvocationHistoryRepo`; `result` do `AiInvocationRepo.finish` ghi vào `ai_invocation_results`; dấu "chưa purge" là `history_state`; bản PostgreSQL của SEP không có ở repo này.
  - JSDoc port `:5-14`, `:17-19`, `:26-28` sửa tương ứng; giữ đoạn outbox `:8-10`, vì đoạn đó đúng.
  - Test: không cần; `pnpm arch:docs:check` nếu gate có đọc README.

### O-1 — Optional — Đảo hướng capability: `invocation-history` (L1) import lỗi của `invocation-content` (L3)

- **Vị trí:**
  - `src/modules/ai-assist/invocation-history/invocation-history-mongo.repo.ts:4-7` import `InvocationContentPendingError`, `InvocationContentUnavailableError` từ `../invocation-content/invocation-content.errors`.
  - README R6 `README.md:110-112` nói L3 import L0–L1, không có chiều ngược.
- **Vấn đề:** gate `capability-graph` chỉ bắt vòng, và hiện không có vòng vì `invocation-content` đã thôi import `invocation-history`. Vì vậy gate xanh, nhưng tài liệu R6 sai và capability có controller bị capability lớp dưới import.
- **Sửa:**
  - Dời 2 lỗi sang `invocation-history/invocation-history.errors.ts`. `invocation-content.http-errors.ts` import từ đó, vì L3 import L1 là chiều đúng.
  - Hoặc cập nhật R6.
  - Test: `pnpm arch:capabilities` không còn cạnh `invocation-history → invocation-content`.

### N-1 — Nit — Tên và chữ trong `AiPurgeApi` vẫn theo bản PostgreSQL

- `src/modules/ai-assist/public/ai-purge.api.ts:28` đặt tên tham số port là `contents`.
- JSDoc port `countPurgeable` (`invocation-history-store.types.ts:44`) nói "How many contents", trong khi adapter Mongo đếm lần gọi (`invocation-history-mongo.repo.ts:132-135`).
- Đổi `contents` → `history` cho khớp `queue-summary*.service.ts`. Không cần test.

## FYI (không chặn)

- `AI_PROVIDER_MODE` mặc định `SIMULATED`. Sau khi merge lên VPS WDP, FE sẽ thấy nhãn _Giả lập_ cho tới khi Super Admin đổi sang `MODEL`. Nên ghi điều này vào mục env VPS của `WDP-2-DONE.md`, theo đúng brief WDP-2 mục 3.
- 503 `AI.HISTORY_UNAVAILABLE` không có ca HTTP integration nào, chỉ có unit adapter (`invocation-history-mongo.repo.spec.ts:218`). Thiếu này có từ WDP-1, không phải hồi quy của WDP-2.
- Chưa xác minh: `prisma migrate deploy` trên DB trống, `migrate diff --exit-code`, CI GitHub trên `b8d2d9bf`, `test:flows`, seed. Brief cấm chạy, và chưa có `WDP-2-DONE.md` để đối chiếu. Điều phối cần lấy link CI xanh trên commit cuối trước khi merge.

## Việc cần làm trước khi merge

1. R-1: chọn A hoặc B, ghi D-n, kèm test.
2. R-2: port 2 ca SEP, kèm chứng minh bằng mutation.
3. R-3: sửa README và JSDoc port.
4. Chat code nộp `WDP-2-DONE.md` có CI xanh mọi job trên commit cuối.

---

## Verify của điều phối 123 (17/11 ~18:30)

**Kết luận: WDP-2 ĐẠT.** `feat/wdp-p5` @ `44fc9395` sẵn sàng cho Owner merge `dev` → `main` của repo WDP.

### Đã sửa
| Mục | Commit | Ghi chú |
| --- | --- | --- |
| R-1 | `45d9a531` | Điều phối tự đọc diff. Pha 1 `prepareRead` đọc PostgreSQL và MongoDB ngoài transaction; pha 2 `confirmRead` trong một transaction ngắn ghi audit; port SEP không đổi. Chat 84 báo mutation đỏ. |
| R-2 | `0c5fecc3` | Port 2 ca; mutation `stuckOf` theo mode đỏ. |
| R-3 | `079bfb36` | — |
| O-1 | `20cf2015` | — |
| CI đỏ của run 44066549022 | `44fc9395` | Do helper test, không phải sản phẩm: `available_at = now()` của PostgreSQL bị làm tròn lên ms, còn bước claim dùng `new Date()`. Sửa helper (due −1s); không retry, không nới assertion. |

### Đã kiểm
- **CI:** run 44070333458 trên `44fc9395` xanh mọi job (điều phối tự kiểm bằng `gh run view`).
- **Flows và seed** (theo `WDP-2-DONE.md`): `test:flows` 70 pass; seed trên DB trống exit 0, 64 bước.
