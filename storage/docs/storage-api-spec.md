# Storage API Spec (v1)

## Auth model
- Storage service trust trusted headers do gateway inject:
  - `x-user-id`
  - `x-user-role`
  - `x-user-email`
  - `x-user-jti`
- Thiếu `x-user-id` => `401 Unauthorized`.

## Endpoints

### `POST /v1/files/upload-signature`
- Purpose: cấp signed upload params cho Cloudinary.
- Body:
```json
{
  "resourceType": "image",
  "contentType": "image/png",
  "size": 245123,
  "folder": "users/avatars"
}
```
- Response `200`:
```json
{
  "signature": "...",
  "timestamp": 1774501200,
  "apiKey": "...",
  "cloudName": "...",
  "folder": "users/avatars",
  "expiresAt": "2026-03-26T10:05:00.000Z"
}
```

### `POST /v1/files`
- Purpose: lưu metadata sau upload thành công.
- Body:
```json
{
  "publicId": "users/avatars/file_123",
  "secureUrl": "https://res.cloudinary.com/...",
  "type": "image",
  "format": "png",
  "size": 245123,
  "metadata": {
    "source": "profile"
  }
}
```
- Response `201`: trả file record.

### `GET /v1/files/:id/download-url`
- Purpose: trả signed URL tải file trực tiếp từ Cloudinary.
- Query: `expiresInSeconds` (optional, default theo env).
- Response `200`:
```json
{
  "url": "https://api.cloudinary.com/v1_1/...",
  "expiresAt": "2026-03-26T10:10:00.000Z"
}
```

### `GET /v1/files/:id`
- Purpose: lấy metadata file theo id.
- Response `200`: file record.

### `GET /v1/files`
- Purpose: list metadata file.
- Query:
  - `cursor` (id cuối trang trước)
  - `limit` (1..100, default 20)
  - `type` (`image|video|file`)
  - `from`, `to` (ISO timestamp)
- Response `200`:
```json
{
  "data": [],
  "pagination": {
    "nextCursor": null,
    "hasMore": false,
    "limit": 20
  }
}
```

## Error codes
- `400`: validation error
- `401`: missing trusted headers
- `404`: file not found
- `409`: duplicate `publicId`
- `422`: invalid payload semantics
