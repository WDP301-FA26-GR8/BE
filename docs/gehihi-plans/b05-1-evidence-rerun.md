# B05-1 — Chạy lại bằng chứng Request → cấp phát

| Gói  | Hạng mục                              | AC                                                                                            | Loại    | Cổng vào |
| ---- | ------------------------------------- | --------------------------------------------------------------------------------------------- | ------- | -------- |
| B-05 | `g4-request-and-transfer-integration` | `US-07-01` AC-3, AC-16; `US-07-04` AC-4, AC-6, AC-12; `US-01-12` AC-8, AC-9; `US-01-04` AC-15 | `AUDIT` | P00 xong |

Re-audit 31/10 mới đọc source, chưa chạy test. Plan này biến kết luận thành bằng chứng. Đa số AC đã có code; **không viết lại**.

## Đọc trước

- Mục `Re-audit 31/10/2026 (B-05)` trong spec của hạng mục và trong `g2-downstream-integration/spec.md`.
- `src/modules/requests/grant/grant.policy.ts`, `access-request-grant.listener.ts`
- `src/modules/licensing/provisioning/failure.policy.ts`
- AC gốc: `../docs/BE-UserStory/src/EP-07.md`, `EP-01.md`

## Không làm

- `US-07-04` AC-15, vế _phần đã chi_ của AC-6, AC-12: thuộc `g8-spend-basis-on-failure`.
- `US-01-12` AC-4: thuộc B05-2. `US-01-04` AC-8: thuộc B-01.
- Không khôi phục auto-purchase hay bộ công cụ chuẩn đã bỏ.

## Các bước

1. Chạy test đang có:

   ```powershell
   pnpm test -- src/modules/requests/grant src/modules/licensing/provisioning
   pnpm test:integration -- test/integration/requests/access-request-internal-path.integration-spec.ts
   pnpm test:integration -- test/integration/licensing/provisioning-decision-http.integration-spec.ts
   pnpm test:integration -- test/integration/licensing/provisioning-failure-constraints.integration-spec.ts
   pnpm test:integration -- test/integration/licensing/handover-duty-sources.integration-spec.ts
   pnpm test:integration -- test/integration/licensing/renewal-request.integration-spec.ts
   ```

2. Với `US-01-04` AC-15, tìm test của `requests/sla/step-sla.service.ts`, `requests/sla/sla-queue-age.service.ts`,
   `licensing/saas-issue/saas-issue-calendar.service.ts` rồi chạy. Thiếu test thì ghi lại, không tự mở rộng.

3. Xác minh từng AC thật sự được test khẳng định, không chỉ code tồn tại. Mở test và tìm đúng tình huống:
   - `US-07-01` AC-3: còn bước duyệt chi đang chờ → từ chối, **không có Assignment**.
   - `US-07-01` AC-16: Request đã rút → từ chối, không có Assignment hay tác vụ.
   - `US-01-12` AC-8: để trống ngày hiệu lực hoặc ngày làm việc cuối → từ chối, không bước nào bắt đầu.
   - `US-01-12` AC-9: IT Admin xác nhận thay trưởng phòng → từ chối.

4. Viết test mới cho `US-07-04` AC-4, vế Request. Đề xuất file
   `test/integration/requests/provisioning-quota-after-spend.integration-spec.ts`, dùng `spend-harness.ts` và
   `provisioning-harness.ts`.

   | Setup                                      | Thao tác                                         | Đáp án (từ AC)                                                |
   | ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
   | Request đã duyệt chi, tác vụ cấp đang chạy | Ghi lỗi `QUOTA_EXCEEDED`                         | Không thử lại tự động, tác vụ vào hàng đợi IT Admin phụ trách |
   | Như trên                                   | Đếm `access_request_steps` loại `SPEND_APPROVAL` | Không tăng, không có bước duyệt chi mới                       |

5. Thiếu test ở bước 3 thì viết test đó. Nếu test đỏ cho thấy thiếu hành vi: dừng, báo, không sửa ở plan này.

## Ghi lại

- Cột `Bằng chứng sau implement` trong bảng re-audit ở spec.
- `plan.md` mục `Verification and handoff`.
- Không đổi hạng mục sang `verified` nếu B05-2 chưa xong.

## Verify

```powershell
pnpm test:integration -- test/integration/requests/provisioning-quota-after-spend.integration-spec.ts
pnpm rules:check
pnpm rules:format
```

## Xong khi

Mỗi AC ở bảng trên có đúng một trong ba kết luận kèm tên test: `đã chứng minh`, `thiếu test đã thêm`, `đỏ, cần sửa`.
