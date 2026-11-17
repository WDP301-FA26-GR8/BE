# WDP-2 — đưa prompt 5 sang BE WDP (chat "SEP-Start 84: WDP-1", điều phối 123 giao)

Trả lời tiếng Việt; giữ tiếng Anh cho code, đường dẫn, lệnh. Model Sonnet effort high; **subagent code: model sonnet**,
mỗi gói một subagent, chạy tuần tự.

**Chỉ bắt đầu khi điều phối nhắn `FEAT/P5 XANH <commit>`.** Trước đó chỉ được đọc để chuẩn bị (mục 0, 1).

## 0. Đọc trước
- Skill Preflight theo `D:\FPT\FALL2026\CLAUDE.md` (process + debug/test + verification-before-completion).
- `D:\FPT\FALL2026\Code\verify-logs\p5\P5-COMMON.md` (luật chung, chế độ đêm, kiểm nhanh local, CI GitHub).
- Spec của C: `D:\FPT\FALL2026\Code\BE-dev-software-license-management\docs\reviews\p5-2026-11-17\SPEC-5C-AI.md` §A2 (port
  `AiInvocationHistoryStore`), `C-DONE.md`, `AUDIT-C-review.md` (R-2: `findOwned` cần gì).
- Nhánh WDP của bạn: `feat/wdp-ai-history` @ `1e760cbc` (đã audit ĐẠT), báo cáo `WDP-1-DONE.md`.

## 1. Phạm vi và cách làm (KHÔNG copy đè thư mục)
- Nhánh mới `feat/wdp-p5` tạo từ `feat/wdp-ai-history`, trong worktree riêng (ví dụ `Code/be-wdp-2`).
- **Patch:**
  - `git -C D:\FPT\FALL2026\Code\BE-dev-software-license-management diff 94a8ee84..<commit feat/p5> --binary > p5.patch`.
  - Trong worktree WDP: `git apply --3way p5.patch`.
  - Đúng ở cả hai repo: `src`/`prisma`/`test` của WDP `dev` giống hệt `94a8ee84`.
- **Giải xung đột:** dự kiến tập trung ở `src/modules/ai-assist`, `test/**/ai-assist`, gates, `openapi.json`, `compose.yaml`, `.env.example`, `ARCHITECTURE.md`.
  - **Code AI của SEP (C)** — đều phải vào:
    - `AI_PROVIDER_MODE` (`MODEL`/`SIMULATED`), migration `20261117120000_ai_provider_mode`;
    - chặn `modelId = 'stub'`;
    - port `AiInvocationHistoryStore`.
  - **Code MongoDB của WDP (dev Hiển)** — giữ nguyên thiết kế:
    - outbox `ai_history_deliveries` + worker;
    - bảng `ai_invocation_results`;
    - migration `20261116100000_ai_history_mongodb` (đã xóa `ai_invocation_contents`);
    - đọc nội dung có audit.
  - **Nối hai bên:** dời phần ghi/đọc lịch sử của WDP thành **adapter Mongo cài port `AiInvocationHistoryStore`**.
    - WDP luôn bind adapter Mongo, vì bảng PostgreSQL của adapter SEP không còn trên WDP. Không cần biến chọn adapter; nếu thấy cần thì ghi D-n.
    - `findOwned`/purge của SEP đọc `ai_invocation_contents.result` thì trên WDP phải đọc `ai_invocation_results` (xem AUDIT-C R-2).
- Migration P5 (A2 `20261117100000…`, A1 `20261117110*`, C `20261117120000`) đều đứng sau `20261116100000`. Kiểm `prisma migrate deploy` trên DB trống + `prisma migrate diff --exit-code`.
- Tính lại số đếm tham số theo nhánh WDP (3 chỗ, xem PLAN §2) và số operation OpenAPI. Sinh lại `openapi.json`, `docs/generated/*` bằng lệnh, không sửa tay.
- Giữ mọi FIX của WDP-1: recovery `ai-history-outbox`, preflight Mongo, CI có mongo.

## 2. Kiểm
- **Local:**
  - Kiểm nhanh: typecheck, lint, gates, `arch:check`, `arch:docs:check`.
  - Integration `test/integration/ai-assist` (Mongo local), `operating-parameters`, `licensing/subscription-renewal*`, `notifications`.
  - DB riêng `make-test-db.sh slm-wdp-2 35445` + `wdp-mongo` 37017.
- **CI GitHub repo WDP:** `gh workflow run ci.yml --repo WDP301-FA26-GR8/BE --ref feat/wdp-p5`, chạy tới khi xanh mọi job trên commit cuối.
- **Flows và seed:**
  - `pnpm test:flows`;
  - seed trên DB trống: `migrate deploy` → bootstrap → `seed:local`, hoặc lệnh seed như trong `README`/`docs/operations`. Ghi exit code và số bước.

## 3. Báo cáo
`D:\FPT\FALL2026\Code\verify-logs\p5\WDP-2-DONE.md`, gồm:
- skill đã dùng;
- cách giải từng file xung đột;
- adapter đã viết, có file:dòng;
- bảng lệnh → kết quả, link CI;
- D-n;
- Breaking FE riêng của WDP (nếu có);
- env mới cho VPS: so với WDP-1, thêm `AI_PROVIDER_MODE` là tham số vận hành do Super Admin bật;
- mục "Chưa làm".

Xong thì nhắn `WDP-2 XONG` cho "SEP-Start 123: reseach,review,plan - fix main flows 2-3" rồi DỪNG.
Không push/merge `dev`/`main`, không deploy. Được push `feat/wdp-p5` để chạy CI. Commit đứng tên "Chill", không dòng đồng tác giả AI.
