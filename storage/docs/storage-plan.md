# Storage Service Plan (NestJS + Prisma + Cloudinary)

## Scope
- Upload file lên Cloudinary theo direct upload (signed upload).
- Lưu metadata file ở PostgreSQL qua Prisma.
- Cấp signed download URL để client tải trực tiếp từ Cloudinary.
- Không triển khai Kafka/SNS/queue, batch, admin APIs.

## Implementation Steps
1. Chuẩn hóa cấu trúc module: `PrismaModule`, `CloudinaryModule`, `FilesModule`.
2. Thêm trusted-headers auth guard theo chuẩn gateway (`x-user-id`, `x-user-role`, `x-user-email`, `x-user-jti`).
3. Thiết kế Prisma schema `File` + generate Prisma client.
4. Triển khai APIs v1:
   - `POST /v1/files/upload-signature`
   - `POST /v1/files`
   - `GET /v1/files/:id/download-url`
   - `GET /v1/files/:id`
   - `GET /v1/files`
5. Bật global validation + DTO validation.
6. Bổ sung unit tests (`CloudinaryService`, `FilesService`, auth guard) và e2e tests cho API chính.

## Acceptance Criteria
- Request thiếu trusted header bị `401`.
- Signature upload chỉ được tạo khi payload hợp lệ.
- Metadata được lưu và truy vấn được qua Prisma.
- Download endpoint trả signed URL + `expiresAt`.
- Danh sách file hỗ trợ cursor pagination và filter cơ bản.
