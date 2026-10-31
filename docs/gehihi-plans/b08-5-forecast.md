# B08-5 — Dự báo L1 và L3

| Gói  | Hạng mục      | AC                | Loại     | Cổng vào                                       |
| ---- | ------------- | ----------------- | -------- | ---------------------------------------------- |
| B-08 | `g8-forecast` | `US-12-03` AC-1→7 | `DESIGN` | B08-2 xong; AC-5 chờ A-06; AC-7 chờ Q-02, A-06 |

Chỉ AC-7 chờ F35 (Q-02); AC-5, AC-7 cần kết quả gia hạn của A-06. Lượt đầu chỉ thiết kế AC-1→AC-4, AC-6.

`src/modules/requests/access-request/pricing.policy.ts` đang đặt `binding: true` cho mọi kỳ giá catalog, trong khi `QĐ-84a`(4) đòi kỳ hủy
được chỉ là dự báo. **Không tự đổi policy đó:** nó ảnh hưởng số tiền khoản cam kết G5.

`P03-D10` = A đã hoãn F35 tới G8, và đổi về sau phải là quyết định Owner mới. Phương án B ghi sẵn: thêm số tháng cam kết vào bằng chứng giá.
Gợi ý chờ Owner: với Request nhiều năm tài chính, kỳ sau `Subscription.endDate` có `binding = false`; không có `endDate` thì giữ ràng buộc.

## Thiết kế phải trả lời

- `L1`: tính thẳng từ thuê bao và hợp đồng. Ví dụ 88 × 15 × 12 USD quy đổi, ghi nguồn, không sai số mô hình.
- `L3`: ba kịch bản từ giả định Finance nhập, bảng `forecast_scenarios` theo Inventory 7.109.
- `L2`: thuê bao `consumption` hiện _dự báo theo mô hình chưa được hiện thực_, không để trống, không ra số. `US-12-08` đang `DEFERRED`.
- Mỗi số kèm khoảng dữ liệu, giả định, thời điểm tính (AC-4).
- Quyền: trưởng phòng, IT Admin, Super Admin bị từ chối toàn công ty (AC-6).
- **Không tạo khoản cam kết** (AC-5, `QĐ-62s`). Test bằng đếm `budget_commitments`.
- AC-7 đọc kết quả quyết định gia hạn của A-06; thống nhất contract trước.
- Vị trí `budgets/forecast/`.

Dự báo đọc thuê bao và hợp đồng, không đọc lịch trả của Request, thì AC-1→AC-4, AC-6 không phụ thuộc Q-02.

## Verify lượt thiết kế

```powershell
pnpm rules:check
pnpm rules:format
```
