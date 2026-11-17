# WDP: triển khai MongoDB cho lịch sử AI (ADR-0020)

Chỉ áp cho BE của môn WDP (VPS WDP). Quyết định Owner 17/11/2026: MongoDB production là service `mongodb` trong
`docker-compose.prod.yml`, không dùng Atlas. Atlas chỉ dành cho dev với dữ liệu giả lập ([ADR-0020](../decisions/0020-mongodb-for-ai-invocation-history.md)).

**Vì sao phải làm trước khi merge `main`:** migration `20261116100000_ai_history_mongodb` **xóa** bảng `ai_invocation_contents` và không
quay lại được. Push vào `main` tự deploy (`ci.yml` → `deploy.yml` → `scripts/ops/deploy-release.sh`). Thiếu bước dưới đây thì script
dừng **trước** `migrate deploy` (không đổi gì), nhưng đừng dựa vào đó: làm xong bước 1–3 rồi mới merge.

## Việc của Owner trên VPS — trước khi merge `main`

1. **Kiểm đĩa.** `df -h` thư mục ứng dụng và `docker system df`: cần chỗ cho image `mongo:8.0` (~800 MB), volume `mongodb-data` và bản
   `pg_dump` trước migrate (`<app>/backups/postgres/`).
2. **Thêm biến vào env của host** (không commit, quyền `0600`):
   - `<app>/.env` (chỉ Compose đọc): `MONGODB_ROOT_USER=<tên>` và `MONGODB_ROOT_PASSWORD=<mật khẩu dài, ngẫu nhiên>`;
   - `<app>/.env.app` (API và worker đọc): `MONGODB_URI=mongodb://<tên>:<mật khẩu>@mongodb:27017/?authSource=admin`
     (cùng tên và mật khẩu; mật khẩu có ký tự đặc biệt phải mã hóa phần trăm trong URI). Có thể thêm `MONGODB_DATABASE`
     (mặc định `slm_ai_history`) và các `MONGODB_*` khác nếu cần (xem `.env.example`).
3. **Sao lưu PostgreSQL thêm một bản tay** (script cũng tự `pg_dump` ngay trước `migrate deploy`, đây là bản an toàn thứ hai):
   `docker compose --project-directory <app> -f <app>/docker-compose.prod.yml run --rm --no-deps -T backup pg_dump --format=custom --no-owner --no-privileges > <app>/backups/postgres/slm-manual-$(date -u +%Y%m%dT%H%M%SZ).dump`
4. Merge `dev` → `main`. Script deploy: kiểm biến Mongo (dừng sớm nếu thiếu), khởi động `mongodb` và chờ healthy, thử xác thực bằng
   đúng `MONGODB_URI` của API, rồi mới backup → preflight → `migrate deploy` → tạo lại `api`/`worker`/`caddy`.
5. **Kiểm sau deploy:** `GET /api/v1/health/ready` trả 2xx; đăng nhập Super Admin, gọi một lần tóm tắt hàng đợi (nếu AI bật) rồi
   `GET /api/v1/ai/invocations/{id}/content` — `409 AI.HISTORY_PENDING` ngắn lúc worker chưa giao là bình thường, `503
AI.HISTORY_UNAVAILABLE` kéo dài là Mongo hoặc worker có vấn đề (`docker compose logs worker mongodb`).

## Chế độ AI (`AI_PROVIDER_MODE`, sau WDP-2)

Từ nhánh `feat/wdp-p5`, tóm tắt hàng chờ AI có tham số vận hành `AI_PROVIDER_MODE` (`SIMULATED` mặc định | `MODEL`), **không phải biến
môi trường**: Super Admin đổi qua `PUT /operating-parameters/AI_PROVIDER_MODE` (có Audit Trail), chỉ có hiệu lực khi hai công tắc
`AI_ENABLED` và `AI_ACCESS_REQUEST_SUMMARY_ENABLED` đều `ON`. Mặc định `SIMULATED` trả câu mẫu có nhãn "Giả lập — không phải AI" mà không gọi
dịch vụ AI. Muốn dùng model thật: đặt `AI_SERVICE_BASE_URL`/`AI_SERVICE_TOKEN` trong `.env.app`, kiểm `/healthz` của dịch vụ AI có
`modelId` khác `stub` (câu của runner `stub` bị BE từ chối), rồi Super Admin chuyển sang `MODEL`. Lịch sử thô (MongoDB) ghi cả hai chế độ; nội dung
Super Admin đọc có thêm `providerMode`.

## Rollback không đụng Mongo, và không dựng lại image cũ sau migrate

Deploy và rollback không bao giờ dừng, tạo lại hay xóa `mongodb` và volume `mongodb-data` (không có `down`, `-v`, `--remove-orphans`).

Sau `migrate deploy`, bảng `ai_invocation_contents` đã mất nên image của release trước **không đọc được** CSDL, dù chưa có lần gọi AI nào.
Vì vậy image mới khai báo representation `ai-history-outbox` trong label `io.github.baophipham.slm.data-reads` của Dockerfile, và recovery
của `deploy-release.sh` đếm nó theo việc bảng `ai_history_deliveries` có tồn tại: nếu release mới fail **sau** migrate, recovery in
`RECOVERY: REFUSED` và **không** dựng lại image cũ (API dừng, không có image nào phục vụ). Cách ra: sửa lỗi rồi deploy lại bằng release mới với
`--attempt` mới. Nếu fail **trước** migrate (thiếu biến Mongo, Mongo không healthy…), CSDL chưa đổi và image cũ vẫn phục vụ bình thường.
Dữ liệu cũ của bảng đã xóa nằm trong dump trước `migrate deploy`.

## Sao lưu MongoDB

Service `backup` hiện có chỉ chạy `pg_dump` (image `postgres`), nên Mongo sao lưu bằng lệnh tay (dịch vụ chạy trong mạng compose, không
publish cổng):

```bash
cd <app>
docker compose exec -T mongodb sh -c 'mongodump --uri "mongodb://$MONGO_INITDB_ROOT_USERNAME:$MONGO_INITDB_ROOT_PASSWORD@localhost:27017/?authSource=admin" --db slm_ai_history --archive --gzip' \
  > backups/mongodb-slm_ai_history-$(date -u +%Y%m%dT%H%M%SZ).archive.gz
```

Khôi phục: `docker compose exec -T mongodb sh -c 'mongorestore --uri "mongodb://$MONGO_INITDB_ROOT_USERNAME:$MONGO_INITDB_ROOT_PASSWORD@localhost:27017/?authSource=admin" --archive --gzip --drop' < <file>`.
Đổi `--db` nếu `MONGODB_DATABASE` khác mặc định. `mongodump` có sẵn trong image `mongo:8.0`. Lịch sử AI là bản sao của outbox PostgreSQL chỉ
cho tới khi giao xong, nên dump Mongo là nguồn duy nhất của lịch sử đã giao; sao lưu theo chu kỳ Owner chọn (không có lịch tự động).
