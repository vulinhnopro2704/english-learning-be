# Listening Service

Microservice xử lý trích xuất transcript từ video YouTube, chuẩn hóa timestamp đồng bộ, và tự động tạo bài tập điền từ (Fill in the Blank) & Shadowing phục vụ website học tiếng Anh.

---

## 1. Tính năng chính

- **Trích xuất YouTube Captions & Timestamps**: Tự động lấy subtitle/captions chính xác (start/end timestamp) từ bất kỳ video YouTube URL hoặc Video ID nào qua `yt-dlp` và `youtube-transcript-api`.
- **Tự động tạo bài tập Điền Từ (Cloze Generator)**: Phân tích các từ vựng quan trọng (Nouns, Verbs, Adjectives, Collocations) để tạo đoạn văn bị khuyết từ theo 3 mức độ khó (`easy`, `medium`, `hard`) kèm gợi ý ký tự.
- **Xác thực Header từ API Gateway**: Nhận và xác thực header `x-user-id`, `x-user-role`, `x-user-email` do API Gateway chuyển tiếp sau khi verify JWT.
- **Phân quyền Admin**: Giới hạn quyền import và khởi tạo bài học mới cho người dùng có vai trò `admin`.

---

## 2. API Endpoints

- `GET /health`: Health check endpoint (`{"status": "ok"}`).
- `GET /api-docs` (hoặc `/listening/api-docs` qua Gateway): Swagger UI API Documentation.
- `POST /api/v1/listening/extract`: Trích xuất transcript gốc dạng timestamped segments (yêu cầu login).
- `POST /api/v1/listening/process-video`: Tự động xử lý video YouTube thành bài học hoàn chỉnh với bài tập điền từ (yêu cầu quyền Admin).

---

## 3. Khởi chạy cục bộ

```bash
# Cài đặt dependencies
pip install -r requirements.txt

# Khởi chạy service trên cổng 3006
uvicorn app.main:app --host 0.0.0.0 --port 3006 --reload
```
