# B05-2 — Trưởng phòng cũ và mới xem chi tiết điều chuyển

| Gói  | Hạng mục                              | AC              | Loại   | Cổng vào   |
| ---- | ------------------------------------- | --------------- | ------ | ---------- |
| B-05 | `g4-request-and-transfer-integration` | `US-01-12` AC-4 | `CODE` | B05-1 xong |

AC-4: Finance mở `BM-04` bị từ chối. Trưởng phòng cũ, trưởng phòng mới, Super Admin xem được. IT Admin chỉ thấy phần kỹ thuật.
Vế `BM-06` chờ G7, không làm.

## Hiện trạng đã xác minh

- `src/modules/personnel/transfer/*.controller.ts`: `GET :id` có `@RequireRoles('SUPER_ADMIN', 'IT_ADMIN')`.
- `TransferQueryService.get` gọi `scopeOf`; `readAccessOf` trả `NONE` cho `MANAGER`, nên trưởng phòng bị 403.

## Bẫy chính (F-16)

`readAccessOf` trong `personnel-self-action.policy.ts` dùng chung cho `leave-query`, `notice-query`, `offboarding-view`,
`transfer-query`. **Không sửa hàm này và không thêm giá trị vào `ReadAccess` nếu việc đó đổi nhánh của ba service kia.**

## Các bước

1. Viết test đỏ trước.

   HTTP, `test/http/personnel/`:

   | Vai             | `GET /department-transfers/{id}` | Đáp án                        |
   | --------------- | -------------------------------- | ----------------------------- |
   | `FINANCE`       | có id                            | 403                           |
   | `MANAGER`       | có id                            | qua guard, service quyết định |
   | Không đăng nhập | có id                            | 401                           |

   Integration, `test/integration/personnel/`:

   | Người gọi                                          | Đáp án                           |
   | -------------------------------------------------- | -------------------------------- |
   | Trưởng phòng phòng cũ                              | 200, bản đầy đủ                  |
   | Trưởng phòng phòng mới                             | 200, bản đầy đủ                  |
   | Trưởng phòng phòng thứ ba                          | `NOT_FOUND`                      |
   | Từng là trưởng phòng, giai đoạn đã kết thúc        | `NOT_FOUND`                      |
   | IT Admin phụ trách                                 | 200, bản tối thiểu, không căn cứ |
   | Người vừa là IT Admin vừa là trưởng phòng phòng cũ | 200, lấy mức rộng hơn            |
   | Super Admin                                        | 200, bản đầy đủ                  |

2. Thêm `'MANAGER'` vào `@RequireRoles` của **chỉ** route `GET :id`. Danh sách và `/changes` giữ nguyên. Cập nhật mô tả
   403/404 trong OpenAPI của route.

3. Trong `TransferQueryService.get`:
   - Giữ nhánh `FULL` và `MINIMAL` hiện có.
   - Khi `actor.roles` có `MANAGER`, kiểm actor đang giữ giai đoạn trưởng phòng hiệu lực của `record.fromDepartmentId` hoặc
     `record.toDepartmentId`, đọc qua public API `organization`. Tra hàm có sẵn trước (`getHeadPeriodsOf` ở
     `organization/public/organization-history.api.ts`), chỉ thêm facade nếu không dùng được.
   - Vai đọc từ PostgreSQL mỗi request nên thu hồi vai có hiệu lực ngay; không cache.
   - `scopeOf` hiện ném 403 cho `NONE`. Kiểm trưởng phòng phải chạy **trước** nhánh đó, và chỉ ở `get`.
   - Không phải trưởng phòng liên quan thì `TransferRefusedError('NOT_FOUND')`.

4. `toDetail(record, names, 'FULL')` cho trưởng phòng. Căn cứ: dòng `BM-04` trong BRD ghi người xem là Super Admin và trưởng phòng cũ/mới;
   chỉ IT Admin bị giới hạn. Thêm comment ngắn dẫn `US-01-12` AC-4.

5. Không migration.

6. Cập nhật:
   - `test/support/api-coverage-manifest.ts` nếu manifest ghi vai.
   - `src/modules/personnel/README.md` nếu card nêu quyền đọc.
   - Spec: bảng test của re-audit; đóng D7 theo dòng `BM-04` của BRD, báo Owner.

## Verify

```powershell
pnpm test:http -- test/http/personnel
pnpm test:integration -- test/integration/personnel
pnpm check
pnpm openapi:export
pnpm arch:routes
```

Xem diff `openapi.json`: chỉ route `GET /department-transfers/{id}` đổi.

## Xong khi

- Bảy ca integration và ba ca HTTP xanh.
- `git diff` không chạm `personnel-self-action.policy.ts`, `leave-query`, `notice-query`, `offboarding-view`.
- Sau plan này gói B-05 đủ để chạy regression `pnpm test:http`, `pnpm test:integration`, `pnpm test:e2e` và bàn giao.
