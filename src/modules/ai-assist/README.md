# ai-assist

Mục đích: tóm tắt bằng AI hàng đợi bước duyệt (bước nhu cầu và bước duyệt chi) đang chờ chính người gọi, theo yêu cầu, qua dịch
vụ AI ngoài tiến trình. Mô hình không viết con số: số tiền do BE chèn từ dữ liệu nguồn, mọi chữ số khác phải xuất hiện nguyên văn
ở trường nguồn của đúng dòng đó; dòng không qua kiểm tra bị loại. Dịch vụ AI chậm hoặc chết không đổi hàng đợi thủ công. Story
chính: `US-15-05`, hạng mục
[ai-assist-queue-summary-be](../../../docs/workspace/items/ai-assist-queue-summary-be/spec.md); chế độ giả lập và chọn nguồn trả
lời (`US-15-05` AC-16, AC-17): [ai-provider-mode](../../../docs/workspace/items/ai-provider-mode/spec.md) (`US-15-06` phía BE
chưa làm: chặn bởi `US-12-14`).

Tầng: T6 ([tiers.cjs](../../../scripts/arch/tiers.cjs)). Phụ thuộc: audit, operating-parameters, organization, requests
([module-graph](../../../docs/generated/module-graph.md)). Được dùng bởi: không module nào; `app/app.module.ts` mount
`AiAssistHttpModule`, `worker/worker.module.ts` mount `AiAssistHistoryFacadeModule`. Lịch sử thô của mỗi lần gọi nằm ở MongoDB
([ADR-0020](../../../docs/decisions/0020-mongodb-for-ai-invocation-history.md)).

## Public API (`public/`)

- `AiPurgeApi` (`public/ai-purge.api.ts`, kiểu `ai-purge.types.ts`, lỗi `ai-purge.errors.ts`): chỉ lệnh `ops:ai-purge` dùng, qua
  `AiAssistPurgeCliModule` (`purge/`, không với tới được từ API hay worker); không module nào khác gọi ai-assist.
- `AiHistoryDeliveryApi` (`public/ai-history-delivery.api.ts`, kiểu `ai-history-delivery.types.ts`): chỉ vòng
  `AiHistoryDeliveryLoop` của worker (`src/worker/ai-history-delivery.job.ts`) gọi, qua `AiAssistHistoryFacadeModule`: một lượt
  giao outbox lịch sử sang MongoDB. `AiAssistModule`
  export `QueueSummaryService` và `InvocationContentQueryService` cho `AiAssistHttpModule` cùng thư mục (ngoài `public/`, R10).

## Bảng sở hữu

- `ai_invocations` (một lần gọi: người, trạng thái, `source_revision`, `provider_mode`, siêu dữ liệu mô hình, và trạng thái lịch sử
  `history_state`/`history_version`/`history_stored_version`/`history_generation`; không nội dung), `ai_invocation_results`
  (kết quả đã kiểm mà `GET` tóm tắt của chủ lần gọi dựng lại hàng chờ từ đó) và `ai_history_deliveries` (transactional outbox
  của lịch sử thô) ([prisma/models/ai-assist.prisma](../../../prisma/models/ai-assist.prisma)). Mỗi (tổ chức, người, tính năng,
  `source_revision`, `provider_mode`) có tối đa một lần gọi đang chạy hoặc đang giữ làm kết quả (unique index một phần
  `ai_invocations_active_per_revision`): đổi chế độ rồi hỏi lại cùng revision tạo lần gọi mới. `provider_mode` (`MODEL` |
  `SIMULATED`) ghi lúc tạo, không có default; lần gọi có trước migration `20261117120000_ai_provider_mode` là `MODEL`.
- MongoDB (ADR-0020): collection `ai_invocation_histories`, một document mỗi lần gọi (`_id` = id lần gọi): `context`,
  `promptText`, `rawResponse`, `parsed`, `validation` (các dòng bị loại và mã lỗi), cùng `organizationId`, `generation`,
  `version`, `payloadHash`, `purged`. PostgreSQL là nguồn có thẩm quyền; MongoDB chỉ giữ nội dung thô. Port lưu lịch sử
  `AiInvocationHistoryStore` được cài bởi `MongoInvocationHistoryRepo` (ghi qua outbox trong transaction của người gọi; đọc MongoDB).

## Extension point

- Mở: không có. Đăng ký vào: không có.

### Port lưu lịch sử AI (`AiInvocationHistoryStore`)

Mọi đọc/ghi `ai_invocation_contents` (câu gửi, câu trả lời thô, kết quả đã parse, ngữ cảnh) đi qua port
`invocation/invocation-history-store.types.ts` (QĐ-102g); bản hiện có là PostgreSQL (`AiInvocationContentRepo`, nối bằng
`useExisting` ở `ai-assist.module.ts` và `purge/ai-assist-purge-cli.module.ts`). Port không phải extension point giữa module (không
export ra ngoài `ai-assist`), chỉ là chỗ thay kho.

| Điểm cắm                                               | Method                                                                                                 | Gọi từ (cùng transaction với)                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Nhận lần gọi (kể cả `SOURCE_UNREADABLE`, context rỗng) | `recordAdmitted(tx, call)`                                                                             | `queue-summary.service.ts` (audit `REQUESTED`)               |
| Lần gọi kết thúc có câu trả lời                        | `recordAnswered(tx, call)` — chỉ khi run là bên kết thúc lần gọi                                       | `queue-summary-run.service.ts` (audit `COMPLETED`/`FAILED`)  |
| Super Admin đọc nội dung                               | `find(tx, invocationId)` → bản ghi hoặc `null`                                                         | `invocation-content-query.service.ts` (audit `CONTENT_READ`) |
| Purge: đếm / xóa                                       | `countPurgeable(before)` / `purge(tx, before)` (lần gọi `COMPLETED` có nội dung bị xóa chuyển `STALE`) | `public/ai-purge.api.ts` (audit `PURGED`)                    |

**Ranh giới đọc/ghi (đọc ngoài port, ghi trong port).** `AiInvocationRepo.findOwned` (chủ lần gọi đọc `result`, QĐ-79a) nằm
ngoài port và đọc PostgreSQL: nó lấy **sự tồn tại của hàng `ai_invocation_contents`** làm dấu "chưa purge" (`content: { isNot: null }`)
và đọc cột `result` của hàng đó. Hai thứ này do bản PostgreSQL của port ghi trong cùng transaction: hàng do `recordAdmitted`, cột
`result` do `recordAnswered`. Hệ quả cho adapter khác: chỉ đổi `provide` thì **không đủ** — không ai tạo hàng PG ⇒ mọi
`GET /ai/access-request-summaries/{invocationId}` trả 404 `AI.NOT_FOUND`, kể cả lần gọi `COMPLETED`. Adapter khác phải **hoặc** vẫn
ghi vào PostgreSQL phần `findOwned` cần (ít nhất `invocation_id`, `created_at`, `result`), **hoặc** sửa `findOwned` và `purge` sang
dấu của kho đó (WDP: bảng `ai_invocation_results`). Mọi lần gọi vẫn đọc `organizationId` và `providerMode` của lần gọi qua `find` từ
`ai_invocations` (PostgreSQL), nên adapter cũng đọc hai trường đó từ PostgreSQL bằng `tx`.

Thêm kho khác (ví dụ MongoDB ở repo WDP): viết một class `extends`/`implements AiInvocationHistoryStore`, đổi `provide: AiInvocationHistoryStore`
trong hai `*.module.ts` (chọn theo env), **không sửa** `queue-summary.service.ts`, `queue-summary-run.service.ts`,
`invocation-content-query.service.ts`. `find` trả `null` khi không có; trạng thái riêng của kho (đang ghi, kho lỗi) là lỗi do adapter
ném và map ở `invocation-content.http-errors.ts` của nhánh đó — không thêm mã lỗi vào API đồ án.

Mọi method chạy trong transaction PostgreSQL của nơi gọi, và transaction đó có thể rollback sau khi method đã trả về (ví dụ ghi audit
lỗi). Vì vậy adapter **không ghi thẳng vào kho ngoài** trong method: ghi một bản ghi chờ (outbox) vào PostgreSQL bằng `tx`, rồi một
worker đẩy sang kho ngoài sau khi commit (cách WDP đang làm) — nếu không, rollback để lại tài liệu mồ côi ở kho ngoài.

## Cấu hình

- Hai công tắc tham số vận hành `AI_ENABLED`, `AI_ACCESS_REQUEST_SUMMARY_ENABLED` (mặc định `OFF`; cả hai phải `ON`).
- Dịch vụ AI: `AI_SERVICE_BASE_URL`, `AI_SERVICE_TOKEN` (bearer cấp dịch vụ), `AI_SERVICE_TIMEOUT_MS`
  (`ai-service/ai-service-environment.policy.ts`). Không cấu hình: ở chế độ `MODEL` tính năng trả `AI.PROVIDER_UNAVAILABLE`
  (chế độ `SIMULATED` không cần dịch vụ AI); có địa chỉ mà thiếu token: chặn khởi động.
- Nối dịch vụ AI trên Modal (repo AI service bản WDP `WDP301-FA26-GR8/AI-service`, `modal_app.py` và README của repo đó): `.env` của VPS BE đặt (không commit giá trị thật)

  ```dotenv
  AI_SERVICE_BASE_URL=https://<workspace>--saas-sentry-ai-web.modal.run
  AI_SERVICE_TOKEN=<cùng giá trị Secret saas-sentry-ai>
  AI_SERVICE_TIMEOUT_MS=120000
  ```

  Vì sao `120000`: mặc định 90 000 ms thấp hơn hạn 105 s của dịch vụ và khởi động lạnh GPU ~110 s, nên lần gọi lúc GPU đang tắt
  hết giờ ở BE trong khi GPU vẫn chạy. Sau đó Super Admin bật hai công tắc và chọn `AI_PROVIDER_MODE`.

  Dịch vụ AI phải chạy model thật: deploy có GPU (`AI_DEPLOY_GPU` khác `0`) và `/healthz` có `modelId` khác `stub`. Câu của runner
  `stub` (câu mẫu, không qua model) bị BE từ chối ngay ở `ai-service-client.service.ts` — lần gọi `FAILED` với `AI.PROVIDER_UNAVAILABLE`,
  không lưu kết quả — để không bao giờ có câu mẫu ghi là `MODEL`, hiện không nhãn _Giả lập_ (QĐ-102f).

- Tham số vận hành `AI_PROVIDER_MODE` (nhóm `AI`, enum `SIMULATED` mặc định | `MODEL`; Super Admin đổi qua
  `PUT /operating-parameters/AI_PROVIDER_MODE`, có Audit Trail; chỉ có hiệu lực khi hai công tắc `ON`):
  `QueueSummaryService.create` đọc lúc tạo lần gọi (giá trị lạ ⇒ `SIMULATED` + log WARN, không nêu giá trị), lần gọi giữ chế độ đó
  tới khi xong; `AiServiceClients.forMode` (`ai-service/ai-service-clients.service.ts`) chọn client HTTP (token `AiServiceClient`)
  hay `SimulatedAiServiceClient` (câu mẫu dựng từ dữ liệu nguồn, không gọi mạng, chờ 1,5 s, qua cùng bước kiểm đầu ra). Model lỗi
  không bao giờ chuyển sang giả lập.
- Log vận hành: mỗi lần gọi xong ghi `invocation`, `feature`, `status`, `latencyMs` (khi dịch vụ đã trả lời), `errorCode`; lần
  gọi `FAILED` ghi thêm `httpStatus` và `serviceCode` (mã HTTP và mã hợp đồng mà dịch vụ AI trả, `none` khi không có) để phân biệt
  token sai (401) với model lỗi (500). Không bao giờ log nội dung, thân trả về hay token.
- MongoDB: `MONGODB_*` (`src/infrastructure/mongodb`), kiểm khi API, worker và `ops:ai-purge` khởi động; production đòi URI có
  thông tin xác thực. MongoDB tắt sau khi khởi động hợp lệ: hàng chờ vẫn chạy, lịch sử chờ ở outbox, nội dung trả 503/409.

## Hướng phụ thuộc giữa capability (R6)

`ai-service` (L0) ← `invocation`, `invocation-history` (L1) ← `history-delivery` (L2, chỉ `invocation-history`) ;
`queue-summary` và `invocation-content` (L3, có controller) import các capability L0–L1; `purge/` chỉ có Nest module. Không có
vòng.

## Capability → file chính

- `ai-service/` — client của dịch vụ AI (`ai-service-client.service.ts`, hợp đồng và kiểu ở `ai-service.types.ts`, lỗi
  `ai-service.errors.ts`, cấu hình `ai-service-environment.policy.ts`), client giả lập (`ai-service-simulated-client.service.ts`,
  câu mẫu ở `ai-service-simulated.policy.ts`) và chọn client theo chế độ (`ai-service-clients.service.ts`).
- `invocation/` — bản ghi mỗi lần gọi: `invocation.repo.ts` (SQL của `ai_invocations` và `ai_invocation_results`),
  `invocation-history-store.types.ts` (port lưu lịch sử `AiInvocationHistoryStore`), `invocation-result.json.ts` (codec cột `result`),
  `invocation-audit-event.mapper.ts` (`AI_INVOCATION.CONTENT_READ`, `AI_INVOCATION.PURGED`), `invocation.types.ts`.
- `invocation-history/` — lịch sử thô (ADR-0020): `invocation-history-outbox.repo.ts` (SQL của outbox và cột `history_*`:
  ghi intent, claim `FOR UPDATE SKIP LOCKED` có lease, ACK, retry, park, purge logic), `invocation-history-store.repo.ts`
  (collection MongoDB: ghi snapshot/tombstone có điều kiện theo generation và version, đọc có kiểm schema; hai lần giao của
  một lần gọi đụng nhau ở `insert` thì ghi lại ngay, tối đa 3 lần, rồi mới trả `RETRY`; chỉ đường ghi tạo collection và
  validator, đường đọc của API không bao giờ ghi hay tạo gì),
  `invocation-history-mongo.repo.ts` (cài port `AiInvocationHistoryStore`: ghi snapshot vào outbox trong transaction của người gọi, đọc MongoDB, purge logic), `invocation-history-write.policy.ts`
  (phán khi trùng `_id`), `invocation-history-hash.policy.ts` (SHA-256 của JSON canonical), `invocation-history-payload.json.ts`
  (codec `payload`), `invocation-history.types.ts`, `invocation-history.errors.ts`.
- `history-delivery/` — giao outbox sang MongoDB ít nhất một lần: `history-delivery.service.ts` (lượt 20 dòng, lease 60 s, 2 ghi
  đồng thời; một đợt chỉ bắt đầu khi lease còn ≥ 15 s, dòng mất lease đếm `leaseLost`, không đếm là đã giao; `drainPurges` cho
  lệnh purge chỉ lấy tombstone đến hạn trước lúc bắt đầu và dừng sau một vòng MongoDB không nhận gì), `history-delivery-retry.policy.ts` (1 s, 5 s, 30 s, 60 s rồi 300 s, jitter, không
  giới hạn số lần cho lỗi tạm).
- `invocation-content/` — đọc nội dung (chỉ Super Admin): `invocation-content-query.service.ts`, `.controller.ts`, `.dto.ts`,
  `invocation-content.errors.ts`, `invocation-content.http-errors.ts`.
- `queue-summary/` — tính năng: `queue-summary.service.ts` (`create`, `get`, `readSource`), `queue-summary-run.service.ts`
  (chạy nền: gọi dịch vụ AI, kiểm đầu ra, ghi kết quả), `queue-summary-context.policy.ts` (ngữ cảnh mờ `R001…`/`C001…`,
  `queueRevisionOf`), `queue-summary-output.policy.ts` (kiểm đầu ra), `queue-summary-view.policy.ts` (đọc lại nguồn khi `GET`),
  `queue-summary-audit-event.mapper.ts`, `queue-summary.errors.ts`; HTTP: `queue-summary.controller.ts`,
  `queue-summary.dto.ts`, `queue-summary.http-errors.ts`.
- Route (`@AuthenticatedOnly()`, phạm vi theo bước được giao): `GET /ai/access-request-summaries/source` (revision và số bước,
  không gọi AI), `POST /ai/access-request-summaries` (202), `GET /ai/access-request-summaries/{invocationId}` (200; `simulated`
  `true` khi lần gọi ở chế độ `SIMULATED`, ở mọi trạng thái — FE luôn hiện nhãn _Giả lập — không phải AI_).
- Route (`@RequireRoles('SUPER_ADMIN')`): `GET /ai/invocations/{invocationId}/content` (`aiInvocationContentGet`) trả `providerMode`
  (`MODEL` | `SIMULATED`), `context`, `promptText`, `rawResponse`, `parsed` (từ MongoDB) và `result` (từ PostgreSQL); ba trường JSON là
  object tự do, như `before`/`after` của Audit Trail; trường chưa có là `null`. `MongoInvocationHistoryRepo.find`: PostgreSQL quyết
  định đọc được không, đọc MongoDB, rồi khóa `FOR SHARE` lần gọi, kiểm lại generation/version và đọc `result`; mọi bước trong
  transaction của lần đọc, cùng transaction ghi `AI_INVOCATION.CONTENT_READ` (payload chỉ `invocationId`); chỉ trả sau commit. Không
  có (chưa từng có hoặc đã purge, kể cả khi MongoDB chưa nhận tombstone) ⇒ 404 `AI.NOT_FOUND`; snapshot cuối chưa được worker giao ⇒
  409 `AI.HISTORY_PENDING`; MongoDB không trả lời, từ chối hoặc document sai schema ⇒ 503 `AI.HISTORY_UNAVAILABLE`; chủ lần gọi không
  phải Super Admin ⇒ 403.
- Lệnh `pnpm ops:ai-purge --through YYYY-MM-DD [--apply --operator <tham chiếu>]` (`src/cli/ai-purge/`, `purge/`,
  `public/ai-purge.api.ts`): mặc định chạy khô (đếm). `--apply` cho các lần gọi có `created_at` ≤ hết ngày `--through` (UTC), không
  bao giờ lần gọi còn `PENDING`/`RUNNING`: một transaction PostgreSQL tăng generation, đặt `PURGING`, xóa `ai_invocation_results`
  (lần gọi `COMPLETED` chuyển `STALE`, ra khỏi unique index), vô hiệu snapshot chưa giao, xếp một tombstone mỗi lần gọi và ghi
  `AI_INVOCATION.PURGED` (`OPERATOR`; số lượng và mốc cắt). Sau commit lệnh ghi tombstone vào MongoDB; ACK đặt `PURGED`. Báo `pending` (tombstone
  chờ giao: chạy lại để hoàn tất, không tạo event thứ hai) tách khỏi `parked` (MongoDB từ chối hẳn: chạy lại không giải quyết,
  người vận hành xem dòng PURGE bị park của `ai_history_deliveries`). Exit 0 xong (hoặc chạy khô có việc cho `--apply`, kể cả chỉ
  còn tombstone của lần trước), 2 không có gì để làm, 1 lỗi, đối số sai hoặc còn tombstone `pending`/`parked`.
- Nest: `ai-assist.module.ts` (lõi, không HTTP; mount MongoDB để đọc), `ai-assist-http.module.ts` (controller, chỉ API mount),
  `ai-assist-history-facade.module.ts` (giao outbox, chỉ worker mount), `purge/ai-assist-purge-cli.module.ts` (đồ thị của lệnh
  purge, chỉ lệnh).

## Bất biến quan trọng

- Người không có bước nào được giao gọi `POST` ⇒ 403 `AI.NO_ASSIGNED_STEPS`, dịch vụ AI không bị gọi; công tắc tắt ⇒ 403
  `AI.DISABLED` trước khi đọc bước.
- Context chỉ có mã mờ (`R001…`, `C001…`), trường cho phép và tối đa 20 dòng; ID thật, người khác, hạn, SLA, ngân sách không rời BE.
- `GET` luôn đọc lại nguồn: bỏ dòng mà bước không còn mở hoặc không còn giao người gọi, tính `omittedCount`, báo `sourceStale`;
  bản `COMPLETED` không bị sửa. Bản của người khác ⇒ 404 `AI.NOT_FOUND`.
- Lỗi của một lần gọi (`AI.PROVIDER_UNAVAILABLE`, `AI.PROVIDER_TIMEOUT`, `AI.OUTPUT_INVALID`, `AI.NO_VALID_OUTPUT`,
  `AI.SOURCE_UNREADABLE`, `AI.INTERNAL_ERROR`) là `errorCode` trong thân `GET` 200, không phải HTTP status. `POST` khi không đọc
  được nguồn vẫn 202 với `status` `FAILED`. Mã HTTP: `AI.DISABLED`, `AI.NO_ASSIGNED_STEPS` 403, `AI.SOURCE_STALE` 409,
  `AI.NOT_FOUND` 404, `AI.PROVIDER_UNAVAILABLE` 503 (chỉ ở chế độ `MODEL` khi chưa cấu hình dịch vụ AI; `SIMULATED` không cần dịch
  vụ AI).
- Lần gọi `RUNNING` quá 150 s chuyển `FAILED` (`AI.PROVIDER_TIMEOUT`) khi `GET` hoặc `POST` của chính chủ chạm tới.
- Không log prompt hay phản hồi thô; audit chỉ siêu dữ liệu và tham chiếu tới bản ghi nội dung, không khóa giống bí mật. Payload
  `AI_INVOCATION.REQUESTED|COMPLETED|FAILED` có `providerMode` của chính lần gọi (cả `FAILED` do kẹt: lấy chế độ của lần gọi kẹt,
  không phải của request chạm tới nó).
- Production: `AI_SERVICE_BASE_URL` phải là `https://` hoặc `http://` tới chính máy (`localhost`, `127.0.0.0/8`, `::1`), sai
  thì module không mount được (thông báo nêu tên biến, không nêu giá trị).
- Bộ kiểm đầu ra giữ cùng luật với `eval/validators.py` của repo AI service WDP (phiên bản `OUTPUT_CHECK_VERSION`); sửa một bên thì sửa cả bên kia.
- Lịch sử thô chỉ Super Admin đọc, mỗi lần đọc có audit; chỉ `ops:ai-purge` xóa nó (tombstone ở MongoDB, `ai_invocations` được giữ).
- Lần gọi và intent lịch sử commit cùng transaction (outbox); MongoDB được ghi sau commit, bởi worker. Mọi ghi MongoDB có điều kiện
  theo generation và version: giao lặp không đổi gì, bản cũ không hạ version, tombstone không bao giờ bị snapshot thay; cùng
  version khác hash ⇒ `CONTENT_CONFLICT` (park, lịch sử `ERROR`), không ghi đè.
- Payload trong outbox được bảo vệ như lịch sử: không log, không HTTP; xóa khi MongoDB xác nhận.

## Test

- Unit: `src/modules/ai-assist/**/*.spec.ts`; HTTP: `test/http/ai-assist/`; integration: `test/integration/ai-assist/` (cần thêm
  `TEST_MONGODB_URI` tới một MongoDB trên máy này, ví dụ `docker compose --profile history up -d --wait mongodb` rồi
  `TEST_MONGODB_URI=mongodb://127.0.0.1:27017`; mỗi suite một database `slm_it_*`, xóa khi xong).
- Smoke gateway: `scripts/ai-gateway-smoke.sh` (kiểm đầu-cuối BE ↔ AI-service; `--direct` kiểm trực tiếp AI-service). Một lần
  `COMPLETED` được dùng lại cho cùng revision hàng chờ: muốn một lần gọi mới thì dùng tài khoản trưởng phòng khác, đừng
  `ops:ai-purge` (purge xóa nội dung lịch sử của mọi lần gọi trước đó).
- Chất lượng model và prompt được đánh giá ở AI-service (`eval/`, bộ `queue_v1` và kịch bản `queue_scenarios_v1`), không ở BE.
