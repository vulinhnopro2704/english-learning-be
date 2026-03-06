Dưới đây là tài liệu thiết kế Database (DB) và các API Endpoints cho **FSRS-AI Service** – một Microservice độc lập chuyên xử lý thuật toán Spaced Repetition và Machine Learning cho đồ án của bạn.

Theo chuẩn kiến trúc Microservice, service này sẽ **không lưu nội dung từ vựng (nghĩa, phát âm, hình ảnh)** để tránh dư thừa dữ liệu. Nó chỉ hoạt động như một "bộ não" toán học, nhận các ID định danh (User ID, Word/Card ID) và trả về lịch trình tối ưu dựa trên mô hình trí nhớ DSR (Difficulty, Stability, Retrievability).

---

# TÀI LIỆU THIẾT KẾ FSRS-AI SERVICE

## 1. THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)

Vì Service này cần sự linh hoạt cao và xử lý dữ liệu chuỗi thời gian (time-series) cho AI, bạn có thể dùng PostgreSQL (với Prisma) hoặc MongoDB. Dưới đây là thiết kế theo định dạng chuẩn:

### Bảng `CardMemoryState` (Trạng thái bộ nhớ của thẻ)

Lưu trữ các biến trạng thái cốt lõi của mô hình DHP/FSRS cho từng cặp User-Word.

- `id` (UUID): Khóa chính.
- `userId` (UUID): ID của sinh viên.
- `wordId` (Int): ID của từ vựng (tham chiếu đến Service quản lý từ vựng).
- `state` (Int): 0 = New, 1 = Learning, 2 = Review, 3 = Relearning.
- `difficulty` (Float): Độ khó $D$, giới hạn trong khoảng $$.
- `stability` (Float): Độ ổn định của trí nhớ $S$ (thời gian tính bằng ngày để xác suất nhớ giảm còn 90%).
- `retrievability` (Float): Tỷ lệ nhớ lại (Probability of recall - $R$) ước tính ở lần ôn tập cuối.
- `nextReview` (DateTime): Thời điểm hệ thống gợi ý ôn tập lần tới.
- `lastReviewedAt` (DateTime): Thời điểm ôn tập gần nhất.
- `reps` (Int): Tổng số lần đã ôn tập.
- `lapses` (Int): Số lần quên (chọn Again/Sai khi đang ở state Review).

### Bảng `ReviewLog` (Dữ liệu chuỗi thời gian cho Optimizer)

AI không thể tối ưu hóa nếu không có lịch sử. Bảng này ghi lại mọi tương tác để làm dữ liệu huấn luyện huấn luyện (Training Data).

- `id` (UUID): Khóa chính.
- `userId` (UUID): ID của sinh viên.
- `wordId` (Int): ID của từ vựng.
- `grade` (Int): Mức độ đánh giá từ 1 đến 4 (1: Again, 2: Hard, 3: Good, 4: Easy).
- `durationMs` (Int): Thời gian người dùng trả lời (Dùng cho tính năng Auto-grading ở Middleware).
- `state` (Int): Trạng thái thẻ **trước khi** đánh giá.
- `difficulty` (Float): Độ khó $D$ **trước khi** đánh giá.
- `stability` (Float): Độ ổn định $S$ **trước khi** đánh giá.
- `elapsedDays` (Float): Số ngày thực tế đã trôi qua kể từ lần ôn trước đó.
- `scheduledDays` (Float): Số ngày hệ thống đã lên lịch trước đó.
- `reviewedAt` (DateTime): Thời gian thực hiện ôn tập.

### Bảng `FSRSConfig` (Cấu hình và Trọng số Máy học)

Lưu trữ bộ tham số $w$ cá nhân hóa do AI (Optimizer) tìm ra, cùng với cấu hình của tiện ích FSRS Helper.

- `userId` (UUID): Khóa chính.
- `weights` (JSON / Mảng Float): Mảng chứa 17 tham số (nếu dùng FSRS v4.5) hoặc 21 tham số (nếu dùng FSRS v6).
- `requestRetention` (Float): Xác suất nhớ mục tiêu, mặc định 0.9 (90%).
- `easyDays` (Array của Int): Các ngày trong tuần muốn "né" không học nhiều (Ví dụ: Chủ Nhật).
- `maxReviewsPerDay` (Int): Giới hạn số thẻ review mỗi ngày để áp dụng thuật toán Load Balancing / Flatten.

---

## 2. THIẾT KẾ API ENDPOINTS (RESTful)

### Nhóm 1: Core Spaced Repetition (Lập lịch & Đánh giá)

**1. `GET /api/v1/fsrs/due` - Lấy danh sách ID từ vựng đến hạn ôn tập**

- **Mô tả:** Lấy danh sách các `wordId` mà `nextReview <= Thời gian hiện tại`. Có kết hợp Load Balance để không vượt quá `maxReviewsPerDay`.
- **Query Params:** `userId` (UUID), `limit` (Int).
- **Response:** `[wordId_1, wordId_2, ...]`

**2. `POST /api/v1/fsrs/review` - Xử lý kết quả làm bài & Tính lịch học mới**

- **Mô tả:** Đây là Endpoint quan trọng nhất. Web Backend sẽ gửi log làm bài của sinh viên (kèm thời gian). Middleware của service này sẽ tự động chuyển `durationMs` và định dạng bài tập thành FSRS Grade (1, 2, 3, 4) như đã thảo luận, sau đó chạy công thức toán học để ra S, D và `nextReview` mới.
- **Request Body:**
  ```json
  {
    "userId": "uuid",
    "wordId": 123,
    "isCorrect": true,
    "durationMs": 5500,
    "exerciseType": "dictation"
  }
  ```
- **Logic bên trong:**
  - Tự động tính Grade (vd: đúng + 5.5s $\rightarrow$ Grade 3 - Good).
  - Load `weights` hiện tại của sinh viên từ `FSRSConfig`.
  - Tính $S^\prime$ và $D^\prime$ theo công thức DHP của FSRS.
  - Lưu trạng thái mới vào `CardMemoryState` và ghi log vào `ReviewLog`.
- **Response:** Trạng thái bộ nhớ mới (`nextReview`, `stability`, `difficulty`).

### Nhóm 2: AI Optimizer (Huấn luyện Mô hình Machine Learning)

**3. `POST /api/v1/fsrs/optimize` - Kích hoạt AI tối ưu hóa tham số cho User**

- **Mô tả:** Chạy thuật toán học máy (Gradient Descent hoặc Maximum Likelihood Estimation) để huấn luyện lại tập trọng số `weights` ($w$) dựa trên toàn bộ lịch sử trong `ReviewLog` của sinh viên đó.
- **Request Body:** `{ "userId": "uuid" }`
- **Hành vi:** Hệ thống trích xuất chuỗi time-series (lag time, kết quả đúng/sai), chạy vòng lặp tìm cực tiểu hàm mất mát (loss function) và cập nhật trường `weights` mới (gồm 17-21 tham số) vào bảng `FSRSConfig`.
- **Response:** `{"status": "success", "newWeights": [...]}`

### Nhóm 3: FSRS Helper (Tính năng nâng cao)

**4. `POST /api/v1/fsrs/helper/reschedule` - Lập lịch lại toàn bộ (Reschedule)**

- **Mô tả:** Áp dụng khi bộ weights $w$ vừa được Optimizer cập nhật, hoặc user thay đổi `requestRetention`. Thuật toán sẽ tính toán lại toàn bộ `nextReview` của sinh viên.
- **Request Body:** `{ "userId": "uuid" }`

**5. `POST /api/v1/fsrs/helper/easy-days` - Tính toán "Né" ngày nghỉ**

- **Mô tả:** Áp dụng nhiễu ngẫu nhiên (fuzz) để xê dịch `nextReview` ra khỏi các ngày nghỉ (Easy Days) mà sinh viên đã cấu hình (ví dụ ngày lễ, Chủ nhật).
- **Request Body:** `{ "userId": "uuid" }`

**6. `POST /api/v1/fsrs/helper/postpone` / `/advance` - Trì hoãn / Học trước**

- **Mô tả:** Tăng (postpone) hoặc giảm (advance) khoảng thời gian ôn tập (intervals) cho một số thẻ nhất định để giảm thiểu tổn hại đến quá trình học dài hạn (dùng bài toán cực tiểu hóa hàm chi phí - cost function).
- **Request Body:** `{ "userId": "uuid", "cardsToPostpone": 50 }`

---

**Cách giao tiếp với hệ thống Web chính của bạn:**

1. Sinh viên vào Web làm bài -> `User/Course Service` lấy danh sách từ vựng thông qua việc gọi `GET /api/v1/fsrs/due`.
2. Sinh viên trả lời -> Gửi kết quả về `User/Course Service`. Service này đẩy thông tin `durationMs`, `isCorrect` sang `FSRS-AI Service` qua API `POST /api/v1/fsrs/review`.
3. Định kỳ (ví dụ cuối tuần), một Cronjob trên hệ thống gọi API `POST /api/v1/fsrs/optimize` cho từng user để AI của bạn học lại hành vi của người dùng và cập nhật tham số.

Tài liệu này cung cấp đầy đủ bức tranh kỹ thuật. Bạn có thể chép thẳng tài liệu này cho Assistant lập trình (như GitHub Copilot hoặc ChatGPT) để tiến hành sinh code tạo Schema và Scaffold API ngay! Cần thêm chi tiết về Data format của phần nào không?
