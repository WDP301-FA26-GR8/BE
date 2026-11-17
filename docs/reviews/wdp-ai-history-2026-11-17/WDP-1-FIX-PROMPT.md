# WDP-1 FIX — sau audit (chat điều phối 123, 17/11 ~04:00)

Chat 84 làm tiếp trên `feat/wdp-ai-history` (worktree `Code/be-wdp-1`, HEAD `96006b17`). Luật vẫn như `WDP-1-PROMPT.md`:
chế độ đêm, kiểm nhanh ở local, CI GitHub repo WDP, mỗi FIX một commit, không push/merge `dev`/`main`.

Đọc trước `D:\FPT\FALL2026\Code\verify-logs\p5\AUDIT-WDP-1-review.md`: mục R-1..R-3 có đủ file:dòng và kịch bản lỗi.

## Bắt buộc (chặn merge `main`)

| # | Việc | Kiểm |
| - | ---- | ---- |
| **FIX-R1** | Recovery của deploy phải từ chối (`REFUSED`) dựng lại image cũ khi CSDL đã chạy migration `20261116100000`. Áp **phương án A**. | Xem chi tiết bên dưới. |
| **FIX-R2** | Test integration cho backfill của migration `20261116100000` trên dữ liệu kiểu cũ. | Xem chi tiết bên dưới. |
| **FIX-R3** | Test integration trên PostgreSQL thật cho raw SQL của outbox (`invocation-history-outbox.repo.ts`), theo `docs/rules/security-jobs.md:257`. | Xem chi tiết bên dưới. |

### FIX-R1 — chi tiết
- **Sửa:**
  - Thêm representation `ai-history-outbox` vào `DATA_REPRESENTATIONS` (`src/modules/installation/public/recovery-target.policy.ts`).
  - Đếm representation này theo **sự tồn tại của bảng**, không theo số dòng: `to_regclass('public.ai_history_deliveries') IS NOT NULL` ⟹ 1. Lý do: image cũ
    lỗi vì bảng `ai_invocation_contents` đã mất, kể cả khi chưa có lần gọi AI nào.
  - Thêm tên representation vào label `data-reads` của `Dockerfile`.
- **Test:**
  - `recovery-target.policy.spec.ts` phải đối chiếu label với policy.
  - Thêm test cho `judge_way_back`/`deploy-release.test.mjs`: image cũ không có label mới ⟹ `REFUSED`.
  - Trước migrate (bảng chưa có) ⟹ image cũ vẫn là đường lui hợp lệ.

### FIX-R2 — chi tiết
- **Dựng dữ liệu:** dựng DB tới migration ngay trước (mẫu `transfer-grace-backfill.integration-spec.ts`), chèn 3 lần gọi:
  1. lần gọi xong, có content + `result` có `rejections`;
  2. lần gọi thất bại, có content, không có `result`;
  3. lần gọi không có content (đã bị purge cũ).
- **Chạy migration rồi kiểm:**
  - `ai_invocation_results` có đúng 1 dòng;
  - `ai_history_deliveries` có 2 SNAPSHOT v1 với payload đúng hình dạng codec (`validation` null khi chưa kiểm);
  - lần gọi 3 ở trạng thái `PURGED` và có `history_purged_at`;
  - bảng cũ đã mất;
  - chạy xong thì drift bằng 0.

### FIX-R3 — chi tiết
- **Các ca cần test:**
  - claim `FOR UPDATE SKIP LOCKED`: hai claim đồng thời không lấy cùng dòng;
  - lease hết hạn thì claim lại được;
  - ACK sai `lease_token` ⟹ `false`;
  - retry tăng `attempts` và `available_at`;
  - park;
  - purge đóng snapshot đang được lease ⟹ ACK muộn `false`.
- **Cách viết:** dùng harness DB thật có sẵn, không mock repo.

## Nên làm nếu nhanh (≤ 20 phút mỗi mục, không thì ghi D-n để 4b)
- **O-5:** lỗi Mongo không tạm thời (validator 121, BSON quá lớn) ⟹ park, không retry vô hạn.
- **O-7:** thứ tự khóa giữa ACK và purge có thể deadlock (40P01). Thống nhất thứ tự khóa (ví dụ khóa `ai_invocations` trước `ai_history_deliveries` ở cả hai đường) hoặc retry `40P01` một lần.

## Xong
- Push nhánh, chạy `gh workflow run ci.yml --repo WDP301-FA26-GR8/BE --ref feat/wdp-ai-history`, chờ xanh **mọi job** trên commit cuối.
- Thêm mục "FIX sau audit" vào `WDP-1-DONE.md`.
- Nhắn `WDP-1 FIX XONG` cho điều phối 123 rồi DỪNG.
