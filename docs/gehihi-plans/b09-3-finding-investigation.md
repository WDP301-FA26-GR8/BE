# B09-3 — Điều tra và lập hồ sơ `BM-07`

| Gói  | Hạng mục                   | AC                                  | Loại     | Cổng vào   |
| ---- | -------------------------- | ----------------------------------- | -------- | ---------- |
| B-09 | `g9-finding-investigation` | `US-13-05` AC-1→17; `US-05-18` AC-7 | `DESIGN` | B09-2 xong |

Lượt đầu chỉ thiết kế. `US-05-18` AC-7 chuyển từ `g3-downstream-finance-integration` khi thiết kế.

## Quy tắc nghiệp vụ

- IT Admin chỉ chuẩn bị, **không chọn kết cục** (AC-6). `IT1` chuyển hồ sơ cho `C1`.
- Ý kiến trưởng phòng không chặn: `C1` quyết được ngay, `BM-07` ghi _chưa có bối cảnh_ (AC-8).
- Không liên kết được nhân viên thì không hỏi ai (AC-9).
- Phòng thiếu trưởng phòng: yêu cầu treo, **không** giao approver dự phòng, `IT1` hay `C1` (AC-10).
- Mức kiểm soát _Không kiểm soát được_ chỉ là đầu vào, không từ chối hay đóng (AC-11, `US-05-18` AC-7).
- Ý kiến Business Owner lưu kèm người ghi, không thêm bước (AC-12).
- Khớp tin cậy thấp chưa xác nhận thì bản ghi chưa vào hàng đợi của `C1` (AC-13).
- Người giữ thẻ không phải người dùng (AC-15).
- **Màn discovery ẩn họ tên:** chỉ mã nhân viên và email công việc (AC-16). Test phải kiểm trường họ tên không có trong response.
- Có mục _lưu ý trước khi thu hồi_ (AC-17).
- Không nhãn _vi phạm_ (AC-5).

## Thiết kế phải trả lời

- Bảng `discovery_dossiers`, `finding_context_requests`, Inventory 7.116, 7.117.
- Đọc Business Owner, gói, nhóm chức năng qua `CatalogApi`.
- Trưởng phòng hiện hành qua `OrganizationApi`; đổi trưởng phòng thì yêu cầu treo xử lý ra sao.
- AC-3, AC-4 là kết cục do `US-13-06` ghi; ở đây chỉ dữ liệu liên quan.
- Thông báo cho trưởng phòng đi qua inbox có sẵn.

## Đầu ra

Cập nhật spec, plan, test matrix đủ 17 AC, kể cả ca quyền âm. Dừng, không code.

## Verify

```powershell
pnpm rules:check
pnpm rules:format
```
