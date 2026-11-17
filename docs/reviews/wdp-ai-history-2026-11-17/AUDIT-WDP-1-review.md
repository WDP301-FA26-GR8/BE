# AUDIT WDP-1: review chỉ đọc nhánh `feat/wdp-ai-history` @ `96006b17`

Ngày 17/11/2026. Repo `D:\FPT\FALL2026\Code\be-wdp-1`. Nền `origin/dev` `f2131ec2`, merge `067f6724` (merge-base `44b2c3f1`), cộng 5 commit
`81aafe08..96006b17`. Chỉ đọc qua `git diff/show/log` và đọc file. Không sửa code, không checkout, không chạy pnpm/jest/docker.

## Skill đã dùng

| Skill | Vai trò | Mục đích |
| --- | --- | --- |
| `agent-skills:code-review-and-quality` | process + review | review năm trục, phân mức Critical/Required/Optional/Nit |
| `superpowers:verification-before-completion` | verification | mọi kết luận có trích file:dòng đã đọc; chỗ chưa kiểm được thì ghi rõ |

Không chạy test: mọi nhận định "CI xanh" lấy từ báo cáo `WDP-1-DONE.md` (run `43949254639`), reviewer không kiểm lại.

## Kết luận

- **Critical: 0.** Không thấy đường mất dữ liệu, rò nội dung hay trả nội dung đã purge.
- **Required: 3** (R-1 recovery của deploy, R-2 test backfill migration, R-3 test thật cho retry/lease/park của worker).
- **Optional: 9**, **Nit: 6**.
- **Có chặn merge `main`.** Lý do chính là R-1: push `main` tự deploy. Nếu release fail sau migration, recovery tự động dựng lại image cũ
  và báo "ready", trong khi image đó không đọc được CSDL đã migrate. R-2 là điều kiện của migration không đảo ngược, chạy trên dữ liệu thật.
  R-3 do rule repo đòi. Cả ba đều sửa nhỏ, không đổi thiết kế.

## Đã kiểm và thấy đúng (không phải finding)

- **Backfill migration** (`prisma/migrations/20261116100000_ai_history_mongodb/migration.sql`):
  - Bản `dev` cũ luôn tạo dòng content khi tạo lần gọi: `git show f2131ec2:src/modules/ai-assist/invocation/invocation.repo.ts`, dòng 75
    (`content: { create: … }`). Purge cũ chỉ xóa content của lần gọi không live (`invocation-content.repo.ts` bản cũ, dòng 8). Vì vậy
    "không có content" ⇔ "đã purge", và dòng 98–100 gán `PURGED` là đúng.
  - Snapshot (dòng 81–95) có đủ mọi lần gọi có content, kể cả lần gọi live: không mất dòng.
  - `context` cũ là `NOT NULL` (`20261104100000_ai_assist_invocations/migration.sql:43`), nên `payload` luôn khác null. CHECK dòng 115–121
    qua được.
  - CHECK dòng 106–112 qua được: dòng `PENDING` có `purged_at` NULL và v=1/s=0; dòng `PURGED` có `purged_at = COALESCE(finished_at, created_at)`
    khác null.
  - Hình dạng `validation` khớp codec mới: `rejections` cũ là `strictObject({sourceRef, code})` (bản cũ `invocation-content.json.ts`),
    trùng với `historyValidationSchema` (`invocation-history.types.ts:16-20`).
  - Script chạy trong một transaction ngầm của Prisma/PG: fail thì không để lại nửa chừng. Bảng nhỏ, lock ngắn.
- **Grant (H7):** migration không nêu vai, đúng `docs/rules/database-business.md:59-60`. Hai bảng mới chỉ cần DML thường, có default privileges
  phủ, nên không cần `RUNTIME_TABLE_EXCEPTIONS`.
- **Thứ tự migration:** `20261116100000` đứng sau migration cuối của `dev` là `20261113102700_pl2_group_need_return`.
- **Kết quả merge:**
  - Có 16 file cả hai phía cùng đổi. Với mọi file, `git diff origin/dev 96006b17` trùng đúng `git diff 44b2c3f1 origin/feat/AI-services` (so
    md5 các dòng ±). Riêng `openapi.json` khác thêm đúng một mô tả 503 do `96006b17` sửa có chủ ý.
  - Không mất luật hay test của `dev`. `PRISMA_MODEL_OWNER` giữ `AvatarPurge`, `Policy*`, `DecisionChecklist`. `module-graph` chỉ thêm một
    dòng.
  - `dev` (`44b2c3f1..f2131ec2`) không đụng `src/modules/ai-assist`, nên code AI không dùng API nào đã bị đổi.
- **Worker và store:**
  - Mọi ghi MongoDB đều có điều kiện theo `generation`/`version`/`purged` (`invocation-history-store.repo.ts:142-150, 197-200`). Policy hội tụ
    (`invocation-history-write.policy.ts:28-49`).
  - Snapshot đến muộn sau tombstone thì thành `OBSOLETE`. ACK phải khớp lease (`invocation-history-outbox.repo.ts:272-285`).
  - Purge đóng snapshot đang được lease (dòng 252–255), nên ACK muộn trả `false`.
- **Đọc nội dung:**
  - PostgreSQL quyết trước (`invocation-content-query.service.ts:77-79`). Sau đó khóa `FOR SHARE` và kiểm lại `generation`/`version`, ghi
    audit trong transaction, rồi mới trả (dòng 81–105).
  - Lỗi Mongo hoặc document sai hình dạng thành 503 `AI.HISTORY_UNAVAILABLE` (dòng 108–117), không thành 500.
- **Log:** chỉ có id, mã lỗi và `describeForOperator`, không có message, nội dung hay URI (`history-delivery.service.ts:136,142`,
  `operator-error.ts:73-78`).
- **Kiến trúc:**
  - Worker chỉ import `public/ai-history-delivery.api.ts` và `*.module.ts`.
  - `infrastructure/mongodb` không import module nào.
  - Đọc chéo capability trong cùng module được phép (`docs/rules/module-structure.md:69`).
- **Deploy (phần đúng):**
  - Biến Mongo được kiểm trước mọi lệnh docker (`deploy-release.sh:164-167`).
  - `mongodb` được khởi động, chờ healthy và probe bằng URI của API trước backup và migrate (`deploy-release.sh:213-220` so với `:318`).
  - Không chỗ nào dừng hay xóa `mongodb`/`mongodb-data`.
  - Probe không in credential: script không chứa giá trị, stdout/stderr bị bỏ.
- **Test:** test AI được viết lại theo bảng mới, không nới assertion (ví dụ thêm `not.toContain('the prompt')`). Không bỏ test nào của `dev`.

---

## Required

### R-1 (Required): recovery tự động coi image cũ là "đường lui" dù nó không đọc được CSDL đã chạy migration này

**Vị trí:**

- `scripts/ops/deploy-release.sh:28-31`, `:557-574`, `:318-320`
- `src/modules/installation/public/recovery-target.policy.ts:26-41` (`DATA_REPRESENTATIONS`)
- `Dockerfile:36` (label `data-reads` không đổi)
- `prisma/migrations/20261116100000_ai_history_mongodb/migration.sql:103`

**Kịch bản lỗi:**

1. Merge `main`, deploy chạy `migrate deploy`. `ai_invocation_contents` bị DROP.
2. Release mới fail sau khi promote, ví dụ readiness timeout, hoặc `mongodb` unhealthy đúng lúc `up api` (xem O-3).
3. `way_back_open` gọi `judge_way_back`. Hàm này chỉ đếm dòng của 3 representation đã khai báo, không có representation nào cho bảng bị xóa,
   nên trả `0`. Image `dev` cũ được dựng lại, và script báo recovery sẵn sàng.
4. Image cũ chạy Prisma client có model `AiInvocationContent`:
   - `POST` tóm tắt hàng chờ: nested `content: { create }` lỗi relation không tồn tại.
   - `GET` tóm tắt (`findOwned` với `content: { isNot: null }`) và `GET …/content` cũng lỗi.
   - Kết quả: tính năng AI trả 500 trong khi deploy báo "recovery ready".

**Căn cứ:**

- Header script cam kết "An image that cannot read rows the failed release wrote is not recreated: the recovery is REFUSED, never a success"
  (`deploy-release.sh:30-31`).
- Runbook tự thừa nhận "Rollback về release cũ **không** khôi phục bảng `ai_invocation_contents`" (`docs/operations/wdp-mongodb-deploy.md`,
  mục *Rollback không đụng Mongo*), nhưng cơ chế P04-CPE-04 không biết điều đó.

**Cách sửa (chọn một):**

- **A (khuyến nghị):**
  - Thêm representation `ai-history-outbox` vào `DATA_REPRESENTATIONS`. Đếm bằng `SELECT CASE WHEN to_regclass('public.ai_history_deliveries')
    IS NULL THEN 0 ELSE 1 END` ở `migration-preflight.repo.ts`. Không đếm theo số dòng `ai_invocations`, vì CSDL không có lần gọi AI nào vẫn
    làm image cũ lỗi ở INSERT.
  - Thêm tên đó vào label `Dockerfile:36`.
  - Trước migrate, bảng chưa có nên đếm 0 và deploy chạy tiếp. Sau migrate thì đếm 1, image cũ không khai báo representation này nên recovery
    thành `REFUSED`.
- **B:** giữ hành vi "image cũ phục vụ phần không phải AI". Khi đó phải in rõ trong recovery (`RECOVERY: DEGRADED — AI routes 500`) và ghi vào
  runbook. Đây là ngoại lệ có chủ ý của P04-CPE-04, cần Owner chốt.

**Test nên thêm:**

- `recovery-target.policy.spec.ts`: label đủ / thiếu `ai-history-outbox`.
- `scripts/verify/deploy-release.test.mjs`: kịch bản readiness fail sau migrate, image cũ không có label, kỳ vọng `RECOVERY: REFUSED` (A) hoặc
  dòng DEGRADED (B).
- **Mutation:** xóa tên khỏi label `Dockerfile` thì spec đồng bộ label phải đỏ.

### R-2 (Required): migration xóa bảng trên dữ liệu thật nhưng không có test backfill trên dữ liệu kiểu cũ

**Vị trí:**

- `prisma/migrations/20261116100000_ai_history_mongodb/migration.sql:67-103`
- `test/integration/ai-assist/ai-invocations-schema.integration-spec.ts:175`: chỉ kiểm bảng cũ không còn. Mọi suite áp migration trên CSDL rỗng.

**Kịch bản lỗi:**

- Backfill viết tay một JSON phải khớp từng chữ với codec mà worker decode (`invocation-history-payload.json.ts`, `historySnapshotSchema`
  `strictObject`). Ví dụ một key sai (`'prompt_text'` thay vì `'promptText'`) hoặc một trường thừa: mọi snapshot backfill bị decode lỗi, worker
  park với `PAYLOAD_INVALID` (`history-delivery.service.ts:151,185`), toàn bộ lịch sử cũ thành `ERROR` hay 503. PG payload còn đó nên không mất,
  nhưng phải viết migration roll-forward.
- Hiện không test nào bắt được lỗi này, vì CI không có dòng `ai_invocation_contents` nào lúc migration chạy.

**Căn cứ:**

- `docs/rules/database-business.md:10-11`: "Review SQL, backfill, constraint và khả năng tương thích trước khi chạy".
- DB-05 (dòng 26–29): migration không đảo ngược.
- Repo đã có mẫu cho loại test này: `test/integration/personnel/transfer-grace-backfill.integration-spec.ts` (đọc file migration, chạy lại trên
  dòng kiểu release cũ, dùng `test/support/migration-history`).

**Cách sửa:** viết test integration `ai-history-backfill.integration-spec.ts`.

1. Áp migration tới `20261113102700`.
2. Chèn dòng kiểu cũ:
   - (a) COMPLETED có `result` với `rejections` không rỗng;
   - (b) NO_VALID_OUTPUT có `parsed` nhưng `result` NULL;
   - (c) FAILED ở admission với context `{generatedAt, requests: []}`;
   - (d) RUNNING chỉ có context;
   - (e) lần gọi không có content (đã purge cũ).
3. Áp `20261116100000`, rồi kiểm:
   - `ai_invocation_results` chỉ có (a);
   - deliveries v1/gen0 cho (a)–(d);
   - (e) là `PURGED` với `purged_at = COALESCE(finished_at, created_at)`;
   - `historyPayloadJson.decode(payload)` thành công cho mọi dòng.
4. Chạy `deliverHistory`: document Mongo khớp nội dung cũ, `history_state = AVAILABLE`.

**Mutation:** đổi `'promptText'` thành `'prompt_text'`, hoặc bỏ `COALESCE(... '[]')`. Test phải đỏ.

### R-3 (Required): retry / lease / park / đua với purge của worker chỉ được chứng minh bằng mock

**Vị trí:**

- `src/modules/ai-assist/history-delivery/history-delivery.service.spec.ts`: toàn bộ outbox và store là mock.
- `test/support/disposable-history-store.ts:59-66`: integration chỉ gọi `deliverDue()` cho tới khi hết, đúng đường happy path.
- Raw SQL chưa có test thật: `invocation-history-outbox.repo.ts:118-129` (claim `FOR UPDATE SKIP LOCKED`), `:148-167` (ACK theo
  generation/version), `:175-180` (`retryLater`), `:187-204` (park), `:244-261` (`beginPurge` đóng snapshot đang lease).

**Kịch bản lỗi:** các tính chất chỉ đúng nhờ SQL, mà mock không kiểm được:

- hai worker claim rời nhau;
- lease hết hạn thì bị claim lại, ACK của lease cũ trả `false`;
- park chỉ đặt `ERROR` cho version mới nhất;
- ACK của gen cũ sau purge không đổi trạng thái.

Một chỉnh sửa sau này, như bỏ `SKIP LOCKED`, bỏ `leaseToken` trong `close()`, hay bỏ `history_generation =` trong `acknowledge`, sẽ không làm đỏ
test nào.

**Căn cứ:** `docs/rules/security-jobs.md:257`: "Mocks do not prove real storage access, revocation or worker retry behavior."

**Cách sửa:** viết integration spec trên PG và Mongo thật (harness có sẵn):

1. Hai `claimDue` chạy song song trong hai transaction trả hai tập rời nhau.
2. Claim với `leaseUntil` đã qua, claim lại bằng token mới, rồi `acknowledge(token cũ)` phải trả `false`.
3. Claim snapshot, gọi `beginPurge`, rồi `acknowledge` trả `false`. Ghi snapshot vào Mongo sau tombstone cho `OBSOLETE`, document vẫn là
   tombstone.
4. Park v1 khi đã có v2 thì trạng thái không thành `ERROR`; park v2 thì thành `ERROR`.
5. `retryLater` đặt `available_at` và xóa lease.

**Mutation:** ba chỉnh sửa nêu trên phải làm đỏ test.

---

## Optional

### O-1 (Optional): khoảng giữa `migrate deploy` và lúc dựng lại API, release cũ vẫn chạy trên schema đã xóa bảng

**Vị trí:** `deploy-release.sh:318-320` (migrate) chạy trước `start_release` (`:737`). `migration.sql:103`.

**Kịch bản:** trong vài chục giây tới vài phút, API cũ trả 500 cho mọi route AI. Một run đang chạy trong API cũ không ghi được `finish`, nên
lần gọi kẹt RUNNING cho tới khi ngưỡng stuck đánh dấu `FAILED AI.PROVIDER_TIMEOUT`. Không mất dữ liệu.

**Cách sửa:** A (khuyến nghị) là thêm vào runbook bước tắt switch AI (operating parameter) trước khi merge `main`, bật lại sau khi kiểm. B là
chấp nhận và ghi vào runbook.

### O-2 (Optional, D-1): API, worker và purge dùng root user của MongoDB

**Vị trí:** `docker-compose.prod.yml` (service `mongodb`), `.env.example` (mục MongoDB), ADR-0020 mục *Còn lại*.

**Căn cứ:** ADR chấp nhận để sau ("user Mongo tách quyền theo process"), nên không trái ADR. Tuy vậy, PostgreSQL có H7 tách vai, còn Mongo thì
một process bị chiếm là có quyền cả cluster.

**Cách sửa:** A (khuyến nghị) là tạo user `readWrite` trên `slm_ai_history`, bằng script `/docker-entrypoint-initdb.d` hoặc một lệnh mongosh
một lần, rồi đặt user đó vào `MONGODB_URI`. Store đã xử lý trường hợp không có quyền `createCollection`
(`invocation-history-store.repo.ts:282-285`), nhưng nên tạo collection có validator lúc init. B là giữ root như hiện tại.

### O-3 (Optional): `depends_on: mongodb: service_healthy` gắn việc khởi động API với sức khỏe Mongo

**Vị trí:** `docker-compose.prod.yml:74-78` (api), `:98-102` (worker).

**Căn cứ:** ADR-0020 §6 ghi "MongoDB lỗi … không làm liveness/readiness của API thất bại". `docs/guides/containers.md` ghi "MongoDB being down
after a valid start does not stop the API". Nhưng mọi lần `up api` (deploy, chạy tay) đều đợi `mongodb` healthy. Nếu healthcheck flake đúng lúc
`start_release`, release fail và rơi vào R-1.

**Cách sửa:** A (khuyến nghị) là đổi sang `condition: service_started`, vì deploy đã `--wait` và probe Mongo ở dòng 213–220. B là giữ nguyên và
sửa câu trong ADR/containers.md cho khớp.

### O-4 (Optional): outbox phình mãi, index claim không partial

**Vị trí:**

- `migration.sql:59`: index `(available_at)` có cả dòng đã đóng.
- `invocation-history-outbox.repo.ts:121-128`: claim lọc `closed_at IS NULL AND parked_at IS NULL`.
- `:264-267`: `countPendingPurges` quét toàn bảng.

**Kịch bản:** dòng đóng không bao giờ bị xóa. Claim chạy mỗi 3 s (`OUTBOX_POLL_INTERVAL_MS`), nên sẽ chậm dần theo tổng số lần gọi AI.

**Cách sửa:** A là thêm migration roll-forward tạo index partial `(available_at, id) WHERE closed_at IS NULL AND parked_at IS NULL`, cộng
retention xóa dòng đã đóng quá N ngày (trong `ops:ai-purge`).

### O-5 (Optional): lỗi Mongo không tạm thời bị retry vô hạn như `MONGODB_UNAVAILABLE`

**Vị trí:** `invocation-history-store.repo.ts:166,213` (`unavailable(error)` cho mọi lỗi khác 11000), `history-delivery.service.ts:141`.

**Kịch bản:** `DocumentValidationFailure` (121), `BSONObjectTooLarge` hay `BSONError` phía client (ADR ghi chưa có ngưỡng 2 MiB) đều bị retry
mãi với backoff 300 s. Dòng không bao giờ park, trạng thái `PENDING` mãi, đọc trả 409.

**Cách sửa:** A là phân loại các mã 121, 2/14 và `BSONError` thành refusal `PAYLOAD_INVALID`, để park. **Test:** store ném
`MongoServerError{code:121}` thì delivery phải park.

### O-6 (Optional): không có công cụ replay dòng parked; `ERROR` thành 503 vĩnh viễn

**Vị trí:** `invocation-history-outbox.repo.ts:182-186` (comment "an operator can … replay it"), `invocation-content-query.service.ts:36`.

**Căn cứ:** không có lệnh hay runbook nào cho replay. Cách duy nhất để thoát là purge.

**Cách sửa:** A là viết vài câu SQL trong runbook: `UPDATE ai_history_deliveries SET parked_at=NULL, available_at=now() WHERE id=…`, kèm cảnh
báo `CONTENT_CONFLICT`. B là viết lệnh `ops:ai-history-replay`.

### O-7 (Optional): thứ tự khóa ngược giữa ACK/park và purge có thể sinh deadlock (40P01)

**Vị trí:**

- `invocation-history-outbox.repo.ts:148-165`: `close()` khóa dòng delivery trước, rồi mới UPDATE `ai_invocations`. Park ở `:187-201` cũng vậy.
- `:230-261`: purge khóa `ai_invocations` trước, rồi mới UPDATE delivery.
- Comment ở `:229` khẳng định "every writer of a call takes it the same way", nhưng không đúng với ACK.

**Kịch bản:** PG tự phá deadlock. Nếu phía bị hủy là purge, `ops:ai-purge` thất bại và phải chạy lại (`TransactionRunner` không tự retry 40P01:
`transaction-runner.ts:29`). Không hỏng dữ liệu.

**Cách sửa:** A là trong `acknowledge`/`park`, `SELECT … FROM ai_invocations WHERE id=$1 FOR UPDATE` trước khi `close()`.

### O-8 (Optional, D-8): Mongo là bản duy nhất sau ACK, nhưng chỉ sao lưu tay; restore bản cũ làm lịch sử "pending" mãi

**Vị trí:** `invocation-history-outbox.repo.ts:272-282` (ACK xóa `payload` ở PG), `docs/operations/wdp-mongodb-deploy.md` (mục *Sao lưu
MongoDB*).

**Kịch bản:** `mongorestore --drop` từ dump cũ hơn PG. Các dòng `AVAILABLE` có `stored_version` lớn hơn version trong document, hoặc không có
document, đều trả 409 `AI.HISTORY_PENDING` ("worker giao ngay") vĩnh viễn, mà payload để giao lại đã bị xóa.

**Cách sửa:** A là lịch `mongodump` (cron hoặc service `backup` riêng image `mongo`) và ghi vào runbook hệ quả của restore. Có thể thêm lệnh đối
soát đặt `ERROR` cho dòng thiếu document.

### O-9 (Optional): purge một transaction không giới hạn

**Vị trí:** `ai-purge.api.ts:54-72`, `invocation-history-outbox.repo.ts:230-261`.

**Kịch bản:** lần purge đầu sau thời gian dài khóa `FOR UPDATE` toàn bộ phạm vi rồi UPDATE/INSERT trong một transaction, có thể chạm
`DB_STATEMENT_TIMEOUT_MS`/`DB_TRANSACTION_TIMEOUT_MS`. Kiểu này đã có từ bản cũ (xóa content một lần).

**Cách sửa:** A là chia lô theo id, ví dụ 1000 lần gọi mỗi transaction, mỗi lô ghi một event; hoặc B là ghi giới hạn vào runbook.

---

## Nit

- **N-1:** `test/gates/deployment-roles.gate-spec.ts:139-141` mở ngoại lệ bằng lookahead `(?! -e "\$MONGO_PROBE")`. Bất kỳ script nào đặt tên
  biến như vậy đều lọt. Nên thêm assertion rằng chuỗi `MONGO_PROBE` (`deploy-release.sh:218`) không chứa `DATABASE`, `prisma` hay `pg`.
- **N-2:** healthcheck `docker-compose.prod.yml:59` và lệnh `mongodump`/`mongorestore` trong runbook đặt mật khẩu root trên argv trong container,
  nên thấy được qua `docker top`/`ps`. Nên dùng `--config` file hoặc biến môi trường của mongosh.
- **N-3:** `history-delivery.service.ts:99-101`: dòng đã claim nhưng chưa bắt đầu vẫn bị `attempts + 1` (`outbox.repo.ts:120`), nên backoff lần
  sau dài hơn cần thiết.
- **N-4:** `migration.sql:68-71` lấy `ai_invocation_results.created_at` từ `content.created_at` (lúc admission), còn code mới ghi lúc kết thúc
  (`invocation.repo.ts`, `finish`, `createdAt: at`). Nghĩa của cột lệch giữa dòng backfill và dòng mới.
- **N-5:** trạng thái `ERROR` (từ chối vĩnh viễn) trả 503 "cannot be opened now" (`invocation-content.http-errors.ts:245-250`), nên client sẽ
  retry vô ích. Đi cùng O-6.
- **N-6:** ADR-0020 mục *Hệ quả* viết "production dùng … với user riêng (root user …)": tự mâu thuẫn. Nên sửa chữ cho khớp D-1.

## Phân loại D-1..D-9 (báo cáo `WDP-1-DONE.md`)

| D | Phân loại | Ghi chú |
| - | --------- | ------- |
| D-1 root user | Optional, khuyến nghị A | O-2. Không trái ADR (ADR để sau), nhưng nên làm trước khi có dữ liệu thật |
| D-2 trùng mật khẩu `.env`/`.env.app` | Optional, B chấp nhận | có lý do (H7 cấm biến DB trong `.env.app`) |
| D-3 healthcheck có xác thực | đúng | N-2 về argv |
| D-4 không ép host `mongodb` | đúng | probe thật là chốt chặn |
| D-5 Mongo chỉ ở job cần | đúng | |
| D-6 bỏ `AiInvocationContent` khỏi gate | đúng | bảng đã xóa |
| D-7 dựng lại worktree | không áp dụng | |
| D-8 không có `mongodump` trong `backup` | Optional, khuyến nghị A | O-8 |
| D-9 mô tả 503 chung | đúng | ví dụ `AI.HISTORY_UNAVAILABLE` vẫn còn (`invocation-content.controller.ts:165-168`) |

Không D-n nào trái QĐ/ADR, nên không có Required nào đến từ D-n. Lệch QĐ-102h/QĐ-79c vì có MongoDB là quyết định của Owner, không tính là lỗi.

## Giới hạn của review

- Không chạy test hay CI. Chưa kiểm thực nghiệm hành vi transaction ngầm của Prisma, mà suy từ tài liệu PG/Prisma.
- Chưa đọc từng dòng `scripts/verify/deploy-release.test.mjs` (chỉ thấy 3 test ADR-0020 ở các dòng 816, 849, 880) và
  `migration-preflight.repo.ts`.

---

## Verify của điều phối 123 (17/11 ~05:30)

**Kết luận: WDP-1 ĐẠT.** Nhánh `feat/wdp-ai-history` @ `1e760cbc` là bản deploy dự phòng, sẵn sàng cho Owner merge `dev` → `main` sau khi
đã thêm biến MongoDB trên VPS.

### Đã sửa
- **R-1** `58f9c50f`: tự đọc diff. Đếm theo `to_regclass('public.ai_history_deliveries')`, label `Dockerfile` có `ai-history-outbox`, có spec policy.
- **R-2** `b1c1ab4b`: test backfill.
- **R-3** `bbaae81b`: 8 test outbox trên PostgreSQL thật.
- **O-5, O-7** `15258510`.
- **Gate `instanceof`** `1e760cbc`.

### Đã kiểm
- **CI:** run 43965990602 (`workflow_dispatch`) trên `1e760cbc` xanh mọi job; `Deploy to VPS` skipped.
- **Mutation R-1:** `aiHistoryOutboxTables` luôn trả 0 ⟹ `recovery-target-facts.integration-spec.ts` đỏ (1/1); bản gốc xanh (1/1), chạy trên DB `wdp-audit` 35447. Đã hoàn nguyên.
- **Backfill:** chạy tay trên dữ liệu kiểu cũ (mục trên) — đúng, không mất dòng.

### Điểm Owner cần biết
- **Deploy lỗi sau khi migrate:** recovery sẽ **REFUSED**, không dựng lại image cũ. API và worker dừng tới khi deploy một bản đã sửa với `--attempt` mới (runbook). Đây là hành vi đúng.
- **Trước khi merge `main`:** thêm vào `.env` hai biến `MONGODB_ROOT_USER`, `MONGODB_ROOT_PASSWORD`, và vào `.env.app` biến
  `MONGODB_URI=mongodb://<user>:<pass>@mongodb:27017/?authSource=admin` (cùng user và mật khẩu). Thiếu thì deploy dừng trước migrate, chưa đổi gì.

### Để sau hội đồng (4b)
Optional O-1…O-4, O-6, O-8, O-9: user MongoDB tách quyền, `mongodump` tự động, outbox phình, replay dòng parked.
