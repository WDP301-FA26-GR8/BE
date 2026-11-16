# ADR-0020: MongoDB giữ nội dung lịch sử lần gọi AI, PostgreSQL vẫn là nguồn có thẩm quyền

## Trạng thái

**Proposed** — 15/11/2026, ghi bởi `ai-history-mongodb-infrastructure` theo [đề xuất lịch sử AI dùng
MongoDB](../workspace/proposals/ai-history-mongodb/spec.md) (draft 13/11/2026). Proposed chưa phải Accepted: chưa có sự kiện
Owner review. ADR này **chưa** thay `QĐ-79a`, `QĐ-79c`, `QĐ-102h` của Docs; chỉ khi Owner chấp nhận và nguồn Docs ghi quyết
định thay thế thì dữ liệu AI mới được chuyển sang MongoDB.

## Bối cảnh

- Môn WDP yêu cầu một chức năng dùng MongoDB bên cạnh PostgreSQL; Owner giao soạn phương án cho lịch sử tương tác AI.
- Hôm nay `ai-assist` giữ metadata lần gọi ở `ai_invocations` và nội dung (context, prompt, phản hồi gốc, kết quả đã kiểm) ở
  `ai_invocation_contents`, cùng transaction với audit. `GET` tóm tắt của chủ lần gọi cần `result` để trả hàng chờ.
- `QĐ-102h`: dịch vụ AI không lưu trạng thái; PostgreSQL ở BE là nơi lưu duy nhất. `QĐ-79*`: PostgreSQL là CSDL nghiệp vụ có
  thẩm quyền.
- Dịch vụ AI chạy serverless trên Modal (tự tắt sau 60 s rảnh), không giữ kết nối CSDL lâu dài và không biết người gọi, tổ
  chức hay quyền Super Admin.

## Quyết định (đề xuất)

1. **PostgreSQL giữ nguyên vai trò nguồn có thẩm quyền**: metadata lần gọi, trạng thái nghiệp vụ, kết quả phục vụ hàng chờ,
   audit và outbox. Không chuyển tài khoản, quyền hay dữ liệu nghiệp vụ nào khác sang MongoDB.
2. **MongoDB chỉ giữ nội dung lịch sử thô** của lần gọi AI (context đã giới hạn, prompt, phản hồi gốc, kết quả kiểm) trong
   collection `ai_invocation_histories`, một document cho một lần gọi. BE ghi qua transactional outbox trong PostgreSQL và
   worker giao sang MongoDB; hàng chờ và `GET` tóm tắt không phụ thuộc MongoDB.
3. **Dịch vụ AI vẫn stateless** (`QĐ-102h` giữ nguyên phần này): chỉ BE kết nối MongoDB.
4. **Driver chính thức `mongodb` cho Node.js**, schema ứng dụng bằng Zod như phần còn lại của BE; không thêm ODM (Mongoose)
   và không đổi Prisma.
5. **Hạ tầng đi trước, ở chế độ dự phòng**: `src/infrastructure/mongodb` (cấu hình, vòng đời `MongoClient`, ping) được thêm
   theo đúng mẫu `src/infrastructure/queue` — chưa process nào mount, nên API, worker và lệnh không cần MongoDB và không kiểm
   cấu hình của nó. Module đầu tiên mount nó (hạng mục lưu trữ lịch sử, sau khi ADR này Accepted) mới có validation chặt.
   Thực tế: `ai-assist` mount nó từ 16/11/2026 khi ADR vẫn Proposed, theo yêu cầu người giao việc (xem _Triển khai_).
6. **Mỗi process dùng một pool**, đóng khi shutdown; MongoDB lỗi sau khi cấu hình hợp lệ chỉ làm phần lịch sử ở trạng thái
   degraded, không làm liveness/readiness của API thất bại và không tạo vòng restart.

## Phương án đã cân nhắc

| Phương án                                       | Vì sao không chọn                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Chuyển cả context, raw và `result` sang MongoDB | Mỗi `GET` tóm tắt phụ thuộc MongoDB; phải thiết kế lại admission, completion, purge                                       |
| Dịch vụ AI (Python) tự ghi MongoDB              | Lịch sử rải hai service; dịch vụ phải biết người dùng, tổ chức, quyền; trái `QĐ-102h`; phải mở CSDL ra Internet cho Modal |
| Mongoose                                        | Thêm một lớp schema thứ hai bên cạnh Zod; không cần tính năng ODM cho một collection                                      |
| Không dùng MongoDB                              | Không đáp ứng yêu cầu môn học Owner đã giao                                                                               |

## Hệ quả

- Thêm dependency `mongodb`, service `mongodb` trong `compose.yaml` (profile `history`, chỉ bind `127.0.0.1`), các biến
  `MONGODB_*` trong `.env.example` đánh dấu theo mẫu module chưa mount.
- Giữa hai CSDL không có transaction chung: hạng mục lưu trữ phải có outbox, version/generation, tombstone khi purge và test
  integration với **cả** PostgreSQL và MongoDB thật (đề xuất §5, §8, §11).
- Production: MongoDB trong mạng riêng của Compose, không public cổng 27017, URI có thông tin xác thực; backup và quyền tách
  theo process là task triển khai riêng.
- **Môi trường dev dùng MongoDB Atlas** (15/11/2026, `MONGODB_URI` dạng `mongodb+srv://` trong `.env` của dev). Khác với
  Compose ở ba điểm phải giữ khi dùng Atlas: endpoint công khai nên chỉ allowlist IP cần thiết (không `0.0.0.0/0`), TLS
  và mật khẩu bắt buộc; gói miễn phí không có backup tự động (cần xác nhận trên trang Atlas trước khi dựa vào), nên
  backup/restore phải tự làm nếu lịch sử cần giữ; dữ liệu lịch sử chứa tên và lý do của người dùng nên tới khi chốt
  `OQ-26`/`OQ-G-06` chỉ dùng dữ liệu giả lập trên Atlas. Service `mongodb` của Compose vẫn giữ cho ai không dùng Atlas.
- Driver 7 bỏ hạn thao tác toàn client (`timeoutMS` không còn tác dụng): `MONGODB_OPERATION_TIMEOUT_MS` được áp vào
  `connectTimeoutMS`, `socketTimeoutMS`, `waitQueueTimeoutMS`; truy vấn cần giới hạn phía server tự đặt `maxTimeMS`.
- Driver 7 nạp module `os` bằng `import()` động nếu không được truyền sẵn; Jest (chạy trong `vm`) từ chối, driver gửi metadata
  rỗng và server từ chối bắt tay. Mọi `MongoClient` (adapter và helper test) nhận `runtimeAdapters: { os }`.
- Nếu Owner từ chối ADR này: từ 16/11/2026 lịch sử thô đã ở MongoDB và `ai_invocation_contents` đã bị xóa (mục Triển khai), nên gỡ
  cần một migration roll-forward dựng lại bảng nội dung và một lệnh chép ngược từ MongoDB, hoặc khôi phục bản sao lưu trước
  `migrate deploy` của `20261116100000_ai_history_mongodb`.

## Triển khai (16/11/2026)

Đã triển khai theo yêu cầu của người giao việc ngày 16/11/2026; trạng thái vẫn **Proposed** cho tới khi có sự kiện Owner review.
Lựa chọn của người giao việc: chuyển rồi xóa bảng cũ trong một migration (không giai đoạn hai nguồn đọc), worker giao outbox.

- Migration `20261116100000_ai_history_mongodb`: thêm cột `history_*` vào `ai_invocations`, bảng `ai_invocation_results` và outbox
  `ai_history_deliveries`; chép `result` sang bảng mới, chép context/prompt/phản hồi gốc/parsed thành snapshot v1 trong outbox,
  rồi xóa `ai_invocation_contents`. Lần gọi đã purge trước đó thành `PURGED`. Không quay lại được (DB-05).
- Ghi: admission ghi snapshot v1 (context), kết thúc có câu trả lời ghi v2 đầy đủ, cùng transaction với trạng thái và audit.
- Giao: `AiHistoryDeliveryLoop` của worker, claim 20 dòng `FOR UPDATE SKIP LOCKED` có lease 60 s, ghi MongoDB có điều kiện
  theo generation/version, ACK theo lease; lỗi tạm retry không giới hạn (1 s → 300 s), từ chối vĩnh viễn thì park và `ERROR`.
- Đọc: `GET /ai/invocations/{id}/content` giữ shape cũ; thêm 409 `AI.HISTORY_PENDING` và 503 `AI.HISTORY_UNAVAILABLE`.
- Purge: hai bước như đề xuất §8, với một event `AI_INVOCATION.PURGED` khi purge có hiệu lực ở PostgreSQL (không tách
  `PURGE_REQUESTED`); lệnh trả exit 1 khi còn tombstone chưa vào MongoDB.
- Chưa làm so với đề xuất: API danh sách/chi tiết metadata (§7.1, §7.2), giới hạn backlog `AI.HISTORY_BACKLOG_FULL` (§6.2), ngưỡng
  kích thước 2 MiB và `captureStatus` (§5.2), backfill/cutover nhiều giai đoạn (§9), tách quyền MongoDB theo process.
- `docker-compose.prod.yml` chưa có MongoDB: production phải trỏ `MONGODB_URI` tới một MongoDB có xác thực trước khi deploy bản
  này, nếu không API, worker và `ops:ai-purge` từ chối khởi động.
