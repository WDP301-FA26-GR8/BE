# B10-1 — Rà và vá API duyệt cho Mobile

| Gói  | Hạng mục                | AC                                     | Loại    | Cổng vào                   |
| ---- | ----------------------- | -------------------------------------- | ------- | -------------------------- |
| B-10 | `g10-approval-api-gaps` | `US-16-02` AC-9; `US-16-03` AC-1, 2, 4 | `AUDIT` | P00 xong; Q-11 cho vế AC-4 |

Mobile dùng chung API web. Việc của B là chứng minh contract đủ, chỉ sửa khi thiếu đúng AC. **Không tạo endpoint riêng cho
mobile, không bulk action, không quyết định chỉ-web.** Kiểm tích hợp Mobile thuộc A-07→A-09.

## Đọc trước

- `docs/workspace/items/g10-approval-api-gaps/spec.md`
- `src/modules/requests/spend-approval/spend-approvals.controller.ts`
- `src/modules/requests/spend-approval-view/`
- `src/modules/requests/spend-submission/spend-submission.controller.ts`, route `plan-line-suggestions`
- `src/modules/requests/need-decision/need-decision.controller.ts`
- AC gốc: `../docs/BE-UserStory/src/EP-16.md`

## Lập bảng đối chiếu

Ghi vào spec, mục `Behavior and design`, thay câu "Chưa thiết kế":

| AC              | Dữ liệu AC đòi                                                                          | Operation                                            | Trường trả về | Thiếu gì | Test |
| --------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------- | -------- | ---- |
| `US-16-02` AC-9 | Số tiền `R1`, dòng gợi ý: phần mềm/gói, số tiền, khoảng mua, trạng thái quá hạn         | `GET /access-requests/{id}`, `plan-line-suggestions` |               |          |      |
| `US-16-02` AC-9 | **Không** có _còn lại_ hay kết quả kiểm tra ngân sách                                   | như trên, vai Manager                                |               |          |      |
| `US-16-03` AC-1 | Nhu cầu đã xác nhận, chi phí, 100tr · 40tr · 20tr · còn lại 40tr · chờ 15tr · thời điểm | `GET /access-requests/{id}/spend-approval`           |               |          |      |
| `US-16-03` AC-2 | Lưu snapshot khi quyết, override có lý do, chưa qua Finance thì chưa có bước quyết      | `POST /access-requests/{id}/spend-approval`          |               |          |      |
| `US-16-03` AC-4 | Bước nhu cầu hiện cùng hàng đợi, phân biệt được                                         | `GET /spend-approvals`                               |               |          |      |

## Các bước

1. Với mỗi dòng, đọc DTO và test có sẵn, điền bảng.
2. Dòng có đủ: thêm hoặc chỉ ra test chứng minh, không sửa code.
3. Dòng thiếu: viết test đỏ, sửa nhỏ nhất trong query/DTO của `requests`, thêm trường là tương thích; đổi hoặc bỏ trường là
   dừng và hỏi.
4. Vế _hiện cùng hàng đợi_ của `US-16-03` AC-4: `SpendStepRepo.pageOpenSpendOf` chỉ lọc `SPEND_APPROVAL`, source chưa có danh
   sách bước nhu cầu. **Không tự xây ở plan này.** Ghi blocker Q-11 và việc cần chốt với A: hai list hay một projection.
   Vế _quyết_ của AC-4 đi qua `POST /access-requests/{id}/need-decision`, kiểm được ngay.

## Test tối thiểu

- Quyền âm: Finance, IT Admin, Employee gọi quyết bị từ chối (`US-16-03` AC-3 là của A, chỉ dùng làm hồi quy nếu đã có).
- Manager không thấy trường ngân sách ở detail.
- Snapshot trả về chỉ đọc, không có trường để gửi lại khi quyết.

## Verify

```powershell
pnpm test:http -- test/http/requests
pnpm test:integration -- test/integration/requests --maxWorkers=4
pnpm rules:check
pnpm rules:format
```

Có sửa DTO thì thêm `pnpm check`, `pnpm openapi:export`, và báo A danh sách operation đổi.

## Xong khi

Bảng đầy đủ mọi ô. Mỗi AC ghi `đủ`, `đã vá`, hoặc `chặn bởi Q-11`. Không có endpoint mới trừ khi người phụ trách đồng ý.
