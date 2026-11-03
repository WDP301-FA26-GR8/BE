# Plan: khung — Bổ sung API Request và ngân sách cho hai Story duyệt trên Mobile

- [Spec](spec.md); revision đầu vào: Docs `d6d868c`, BE `d6c2112`.
- Phụ trách: Dev B (nhánh `hien-dev`). Thiết kế ban đầu bởi: AI theo giao việc của Dev B (31/10/2026).
- Owner review: chưa review. Peer review: tùy chọn.
- Triển khai: `not-started`. PR: chưa có.

## Before coding

Hạng mục khung: không code. Đọc spec, xác nhận mục _Dependencies and blockers_ trước khi thiết kế; đối chiếu lại source ở BE
hiện hành.

## Tasks

### Task 1: rà soát contract và đối chiếu AC duyệt trên mobile

- Files: `spec.md`, `plan.md`, `test/http/requests/spend-approvals.http-spec.ts`.
- Depends on: B-10 / B10-1.
- Acceptance: Lập bảng đối chiếu contract DTO của `US-16-02` AC-9; `US-16-03` AC-1, AC-2, AC-4. Thêm test HTTP hợp đồng, chỉ ra integration test chứng minh. Ghi nhận blocker Q-11 cho vế hàng đợi của AC-4.
- Verify: `pnpm test:http -- test/http/requests`, `pnpm test:gates`, `pnpm rules:check` và `pnpm rules:format` → xanh.

## Verification and handoff

Lượt chạy: 31/10/2026, gói B-10 (plan B10-1), model `gemini-3.8 flash -high`.

| Lệnh / kiểm tra AC                                                                                             | Revision / môi trường       | Kết quả thực chạy     | Giới hạn / việc còn lại                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm test:http -- test/http/requests` (`US-16-03` AC-1, AC-2)                                                 | hien-dev, local HTTP        | 94 passed, 5 files    | Đầy đủ guard, validate param và strict body loại trừ trường snapshot                                        |
| `pnpm test:gates`                                                                                              | hien-dev, local gate runner | 317 passed, 16 suites | Kiến trúc, kích thước test, boundary xanh                                                                   |
| `pnpm rules:check` & `pnpm rules:format`                                                                       | hien-dev                    | 0 errors, formatted   | Tuân thủ rule tài liệu                                                                                      |
| `US-16-02` AC-9 (`spend-need-decision.integration-spec.ts`, `spend-finance-review.integration-spec.ts`)        | hien-dev, integration       | Có sẵn trong repo     | Số tiền R1, dòng gợi ý đầy đủ; Manager không thấy remaining hay mã kiểm tra                                 |
| `US-16-03` AC-1, AC-2 (`spend-approval.integration-spec.ts`, `spend-decision-constraints.integration-spec.ts`) | hien-dev, integration       | Có sẵn trong repo     | Nhu cầu, chi phí, snapshot 100·40·20·40·15tr, thời điểm chỉ đọc; quyết định kèm snapshot, override có lý do |
| `US-16-03` AC-4 (vế quyết: `spend-need-decision.integration-spec.ts`; vế hàng đợi)                             | hien-dev                    | Vế quyết sẵn có       | Vế hàng đợi bước nhu cầu gom chung với bước chi: chặn bởi Q-11, cần chốt với Dev A                          |

- [x] AC trong scope có bằng chứng; lỗi đã xử lý hoặc ghi blocker.
- [x] Spec/plan/test design phản ánh đúng implementation cuối.
- [x] Diff cuối đã tự review; tài liệu vận hành bị ảnh hưởng đã cập nhật; phần chưa kiểm chứng ghi rõ.
- [ ] Giao Owner review trên revision cụ thể; cập nhật roadmap/PR. Chỉ ghi `merged-dev`, `accepted`, `released` sau
      đúng sự kiện thật.
