# P00 — Dựng môi trường và chốt mốc

| Loại    | Cổng vào                                                      | Kết quả                                     |
| ------- | ------------------------------------------------------------- | ------------------------------------------- |
| `AUDIT` | Người phụ trách xác nhận Q-01, Q-03 hoặc chấp nhận chạy trước | Biết chắc gate nào đang xanh trước khi code |

Không sửa source. Mục tiêu là tách lỗi có sẵn khỏi lỗi do plan sau tạo ra.

## Các bước

1. Kiểm nhánh và độ lệch:

   ```powershell
   git branch --show-current
   git fetch origin
   git rev-list --left-right --count HEAD...origin/dev
   ```

   Nhánh phải là `hien-dev`. Không tự merge hay rebase khi cây còn thay đổi chưa commit.

   Lúc rà ngày 31/10/2026, `origin/dev` hơn `d6c2112` một commit: `a49d359`, chỉ sửa `docs/guides/containers.md`,
   `scripts/ops/deploy-release.sh`, `scripts/verify/deploy-release.test.mjs`. Commit này không đổi thiết kế; ghi lại và tiếp tục. Có commit
   nào khác chạm `src/`, `prisma/`, `test/` thì **dừng**, liệt kê file và báo.

2. Liệt kê thay đổi có sẵn bằng `git status --short`. Đây là tài liệu bước 01 của đợt giao, phải giữ nguyên. Riêng
   `.vscode/settings.json` và `.github/workflows/ci.yml` không thuộc phạm vi.

3. Cài dependency đúng lockfile: `pnpm install --frozen-lockfile`.

4. Dựng PostgreSQL test đúng theo mục `Database cho integration và E2E` của `test/README.md`. Đặt biến môi trường trong
   phiên, không ghi vào file.

5. Chạy mốc:

   ```powershell
   pnpm check
   pnpm test:http
   pnpm test:integration -- test/integration/budgets
   pnpm test:integration -- test/integration/requests --maxWorkers=4
   pnpm test:integration -- test/integration/licensing --maxWorkers=4
   pnpm test:integration:serial
   ```

## Ghi lại

Tạo mục ngày 31/10 hoặc ngày chạy trong `docs/workspace/items/g4-request-and-transfer-integration/plan.md`, phần
`Verification and handoff`: lệnh, số test, SHA, ghi `cây có tài liệu chưa commit`.

## Xong khi

- Có danh sách test đỏ sẵn, nếu có, kèm tên file và thông điệp một dòng.
- Không sửa test đỏ sẵn trong plan này.

## Commit tài liệu bước 01

Chỉ làm khi người phụ trách nói rõ. Stage đúng đường dẫn, không dùng `git add .`:

```powershell
git add docs/roadmap.md docs/workspace/sources.md docs/workspace/items/README.md
git add docs/workspace/items/g2-downstream-integration docs/workspace/items/g3-contract-documents
git add docs/workspace/items/g3-downstream-finance-integration docs/workspace/items/g4-provisioning-failure-handling
git add docs/workspace/items/g4-request-and-transfer-integration docs/workspace/items/g5-commitment-lifecycle
git add docs/workspace/items/g5-request-withdrawal
git add docs/workspace/items/g8-* docs/workspace/items/g9-* docs/workspace/items/g10-* docs/gehihi-plans
git diff --cached --stat
```

Xem lại diff đã stage trước khi commit. `origin/hien-dev` chưa tồn tại; lần push đầu tạo nhánh này.
