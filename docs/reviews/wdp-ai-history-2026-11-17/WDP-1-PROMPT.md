# WDP-1 — đưa lịch sử AI (MongoDB) vào BE WDP, CI xanh (chat điều phối giao, 17/11/2026)

Bạn là chat code **WDP-1** (Sonnet, effort high). Trả lời tiếng Việt; giữ tiếng Anh cho code, đường dẫn, lệnh.
Subagent code (nếu dùng): **model sonnet**, mỗi gói một subagent, chạy tuần tự.

**Hạn:** hội đồng WDP sau 2 ngày. Ưu tiên chạy được và CI xanh; không mở rộng phạm vi.

## 0. Đọc trước
1. Skill Preflight theo `D:\FPT\FALL2026\CLAUDE.md`: chọn một process skill, các skill debug/test cần dùng và
   verification-before-completion; đọc từng `SKILL.md` và liệt kê ở đầu báo cáo.
2. `D:\FPT\FALL2026\Code\BE-WDP\AGENTS.md` và các rules BE nó dẫn tới (`test/README.md` cho DB test).
3. `D:\FPT\FALL2026\Code\verify-logs\ai-review\WDP.md`: review nhánh AI. Đọc kỹ mục lỗi chặn B1, B2, B3, B5.

## 1. Phạm vi và trạng thái đã kiểm
- Repo `D:\FPT\FALL2026\Code\BE-WDP` (remote `WDP301-FA26-GR8/BE`).
- `origin/dev` @ `f2131ec2`: `src/`, `prisma/`, `test/` **giống hệt** BE đồ án `dev` @ `94a8ee84` (điều phối đã kiểm bằng
  `diff -rq`). Không cần chép thêm gì từ BE đồ án.
- Nhánh AI `origin/feat/AI-services` hơn merge-base `44b2c3f1` 44 commit (98 file).
- Thử `git merge-tree` cho thấy **3 conflict**:
  - `src/generated/prisma/internal/class.ts`
  - `src/generated/prisma/internal/prismaNamespace.ts`
  - `test/gates/architecture-boundaries.gate-spec.ts`
- Migration của nhánh AI là `20261116100000_ai_history_mongodb`, đứng sau migration cuối của `dev`
  (`20261113102700_pl2_group_need_return`), nên thứ tự đúng.
- **Quyết định Owner 17/11:** MongoDB production là **service trong `docker-compose.prod.yml`** trên VPS WDP, không dùng
  Atlas. Quyết định này **chỉ cho WDP**. Không sửa Docs, không sửa QĐ-102h/QĐ-79c của đồ án.
- Được làm:
  - Commit vào nhánh mới `feat/wdp-ai-history` (danh tính git repo "Chill", **không** dòng đồng tác giả AI, không `--no-verify`).
  - Push **chỉ nhánh này** lên `origin` để chạy CI.
  - Chạy Docker local (Postgres, Mongo) cho test.
- **Cấm:**
  - push/merge `dev`/`main`, deploy, sửa repo BE đồ án hoặc Docs;
  - đổi hành vi sản phẩm ngoài phần AI/Mongo;
  - đổi tên migration đã có.

## 2. Việc (tuần tự)
| # | Việc | Ghi chú |
| - | ---- | ------- |
| W1 | `git fetch`; `git switch -c feat/wdp-ai-history origin/dev`; `git merge --no-ff origin/feat/AI-services` | — |
| W2 | Giải 3 conflict | 2 file `src/generated/prisma/**`: **không** merge tay — lấy một bên rồi chạy `pnpm prisma:generate` để sinh lại từ `prisma/schema*`, kiểm `git diff` chỉ còn phần sinh ra. `architecture-boundaries.gate-spec.ts`: giữ luật của **cả hai** phía (luật mới của `dev` + luật Mongo/`invocation-history` của nhánh AI), đọc kỹ từng khối. Commit merge. |
| W3 | Kiểm sau merge | Xem các file **cả hai bên cùng đổi** từ merge-base: `git diff --name-only 44b2c3f1 origin/dev` ∩ `git diff --name-only 44b2c3f1 origin/feat/AI-services`. Đọc kết quả merge của từng file, chú ý `ai-assist`, `openapi.json`, `compose.yaml`, `package.json`, `ARCHITECTURE.md`, `.env.example`. `pnpm openapi:export` rồi so `openapi.json`. Trên DB Postgres trống: `prisma migrate deploy` + `prisma migrate diff --from-config-datasource --to-schema prisma --exit-code`. |
| W4 | **B1 — CI có MongoDB** | `.github/workflows/ci.yml`: mọi job có service `postgres` và chạy suite cần harness AI (tối thiểu `integration`, `integration-inband`; kiểm thêm `e2e-smoke` và `quality`) phải có thêm service `mongo:8.0` với health-cmd (`mongosh --quiet --eval "db.adminCommand({ping:1}).ok"`) và `TEST_MONGODB_URI` ở env của bước test. Đọc `test/support/disposable-history-store.ts` để biết dạng URI/quyền cần (tạo DB tạm, validator). |
| W5 | **B2 — production có MongoDB** | `docker-compose.prod.yml`: thêm service `mongodb` (`mongo:8.0`), chỉ trong `slm-network`, **không publish port**; root user/password lấy từ env file (không hard-code); volume `mongodb-data`; healthcheck; `restart: unless-stopped`. Thêm `depends_on: mongodb: condition: service_healthy` cho `api`, `worker` và mọi service khởi tạo Mongo (`migrate`/`db-admin` nếu chúng mount module AI — kiểm code). `.env.example` (phần production) liệt kê `MONGODB_URI=mongodb://<user>:<pass>@mongodb:27017/?authSource=admin`, `MONGODB_DATABASE` và các biến `MONGODB_*` khác mà `mongodb.config.ts` đòi. Bước kiểm compose prod trong job `quality` của CI phải pass (biến bắt buộc có giá trị CI giả). |
| W5b | **Deploy script phải an toàn** | VPS **production hiện deploy từ repo WDP nhánh `main`** (job `deploy` trong `ci.yml` → `deploy.yml` → `scripts/ops/deploy-release.sh` của chính release). Nhánh này sẽ đi đường: push nhánh → Owner merge `dev` → `main` ⟹ tự deploy. Đọc kỹ `scripts/ops/deploy-release.sh` (kiểm compose, sao lưu, preflight, migrate, reconcile, promote, recreate, readiness, rollback) rồi sửa sao cho: (1) **trước `migrate`**, preflight dừng sớm (exit ≠ 0, chưa đổi gì) nếu env file trên host thiếu `MONGODB_URI` hoặc biến root user/password của service `mongodb`, hoặc `mongodb` không healthy được; (2) service `mongodb` được khởi động và chờ healthy **trước** `migrate`/api/worker; (3) rollback không bao giờ dừng hay xóa volume `mongodb-data`. Có test cho script thì cập nhật; không có thì kiểm bằng `bash -n` + chạy thử phần preflight với env giả. Lý do: migration xóa `ai_invocation_contents`; nếu migrate chạy mà API không lên vì thiếu Mongo, rollback về release cũ sẽ hỏng vì bảng đã mất. |
| W6 | Backup và triển khai | Migration `20261116100000` **xóa** `ai_invocation_contents` và không quay lại được. Viết `docs/operations/wdp-mongodb-deploy.md` (ngắn): bước VPS (thêm biến vào env file, `pg_dump` trước `migrate deploy`, khởi động `mongodb` trước api/worker, kiểm `GET` lịch sử AI); cách backup volume Mongo (`mongodump`). Nếu service `backup` hiện có dễ mở rộng thì thêm `mongodump`, không thì chỉ ghi lệnh tay. |
| W7 | B3, B5 | ADR `docs/decisions/0020-mongodb-for-ai-invocation-history.md`: đổi *Proposed* → *Accepted (WDP, Owner 17/11/2026: Mongo prod trong compose)*. README vận hành/ADR ghi rõ: Atlas chỉ cho dev với dữ liệu giả lập; prod dùng service compose với user riêng. |
| W8 | Kiểm local | `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), `pnpm test:http --maxWorkers=2`, `pnpm test:integration test/integration/ai-assist --maxWorkers=1` (Mongo local `docker run -d --name wdp-mongo -p 127.0.0.1:37017:27017 mongo:8.0`, `TEST_MONGODB_URI` trỏ vào đó), `pnpm check`, `docker compose -f docker-compose.prod.yml config --quiet` (đặt env giả như CI). DB test: dựng Postgres bằng `bash C:/Users/Asus/AppData/Local/Temp/claude/cb9d99d994b36370/7eb159d2-d9bb-4061-8261-d8e89677a8a4/scratchpad/make-test-db.sh wdp-test-db 36432` (đọc script trước; dùng port riêng, không đụng container của BE đồ án). |
| W9 | CI GitHub | `git push -u origin feat/wdp-ai-history`; `gh workflow run ci.yml --repo WDP301-FA26-GR8/BE --ref feat/wdp-ai-history`; theo dõi `gh run watch`; đỏ thì sửa từ log rồi chạy lại. **Xong = mọi job xanh trên commit cuối.** |

Gặp quyết định đổi phạm vi, hành vi hoặc quyền: ghi `D-n` vào báo cáo kèm phương án và khuyến nghị, rồi chọn phương án an toàn
nhất, không trái QĐ, và làm tiếp. Chỉ dừng nếu bị chặn thật.

## 3. Báo cáo
Ghi vào `D:\FPT\FALL2026\Code\verify-logs\WDP-1-DONE.md`:
- skill đã dùng;
- bảng việc → commit → lệnh → kết quả thật;
- cách giải từng conflict;
- danh sách file cả hai bên cùng đổi và kết luận;
- link run CI và trạng thái từng job;
- các `D-n`;
- mục "Chưa làm".

Xong thì báo Owner câu `WDP-1 XONG` và DỪNG, chờ chat điều phối review/verify. Sau review, Owner merge nhánh vào `dev` rồi `main`; push vào `main` sẽ tự deploy lên VPS. Vì vậy `docs/operations/wdp-mongodb-deploy.md` phải ghi rõ việc Owner làm trên VPS **trước khi merge `main`**: thêm biến Mongo vào env file và kiểm dung lượng đĩa.
