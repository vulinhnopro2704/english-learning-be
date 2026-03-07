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

Tự động chuyển đổi hành vi thành Điểm số (Grades) cho thuật toán FSRS
Thuật toán FSRS mặc định cần đầu vào là 4 mức đánh giá: 1 (Again), 2 (Hard), 3 (Good), và 4 (Easy)
. Website của bạn có thể tự động "chấm điểm" bằng cách theo dõi hành vi làm bài của người dùng:
Grade 1 (Again/Sai): Người dùng điền sai, chọn sai đáp án, hoặc bỏ qua câu hỏi.
Grade 2 (Hard/Khó): Người dùng trả lời đúng nhưng tốn quá nhiều thời gian suy nghĩ, hoặc phải sử dụng quyền trợ giúp (nghe lại audio nhiều lần, click xem gợi ý/phiên âm).
Grade 3 (Good/Tốt): Người dùng trả lời đúng trong khoảng thời gian trung bình.
Grade 4 (Easy/Dễ): Người dùng trả lời đúng cực kỳ nhanh chóng và dứt khoát. Thực tế, ngay cả khi bạn chỉ dùng hệ thống Nhị phân (Đúng/Sai), FSRS vẫn hỗ trợ tốt. Trong hệ sinh thái FSRS, một số công cụ được thiết kế để ánh xạ trực tiếp: "Pass" (Đúng) tương đương với "Good", và "Fail" (Sai) tương đương với "Again"
. 2. Định lượng độ khó dựa trên Định dạng bài tập (Exercise Types)
Các nghiên cứu chỉ ra rằng định dạng bài tập ảnh hưởng trực tiếp đến độ khó của quá trình hồi tưởng trí nhớ. Ví dụ, trong hệ thống Ari9000, các nhà nghiên cứu đã sử dụng đặc trưng "số lần nhấp chuột" (n clicks) cần thiết để trả lời làm dữ liệu đầu vào cho AI, vì một câu hỏi yêu cầu điền nhiều chỗ trống chắc chắn sẽ khó hơn
.
Áp dụng vào web của bạn, bạn có thể thiết lập trọng số độ khó khác nhau cho từng dạng bài:
Dạng trắc nghiệm (Chọn nghĩa tiếng Việt): Nhẹ nhất, mang tính chất nhận diện (Recognition).
Dạng nghe điền từ / Xem phiên âm gõ từ: Trung bình, yêu cầu kết nối âm thanh/ký hiệu với chính tả.
Dạng điền chỗ trống không gợi ý: Khó nhất, mang tính chất tự gọi nhớ (Active Recall). Mô hình AI của bạn có thể ghi nhận định dạng bài tập này như một biến đầu vào (feature vector) để dự đoán chính xác hơn tốc độ quên của học sinh
. 3. Khởi tạo Độ khó (Difficulty) tự động dựa trên Dữ liệu đám đông (Global Data)
Một thách thức là làm sao để hệ thống biết một từ vựng mới tinh có khó hay không khi người dùng chưa từng học? Giải pháp đến từ cách nền tảng MaiMemo xử lý dữ liệu: thay vì hỏi người dùng, họ tính toán tỷ lệ phần trăm số người nhớ được từ đó vào ngày hôm sau
.
Dựa trên dữ liệu từ hàng trăm ngàn người học, những từ vựng có tỷ lệ nhớ lại (recall ratio) lớn hơn 85% sẽ được gán độ khó tự động d=1 (Rất dễ)
.
Những từ có tỷ lệ nhớ lại thấp hơn 45% sẽ bị gán độ khó d=10 (Rất khó)
. Hệ thống của bạn có thể thu thập log đúng/sai của tất cả sinh viên làm bài. Từ nào nhiều người sai ở lần ôn tập đầu tiên, AI sẽ tự động hiểu đó là "từ khó" đối với toàn bộ người dùng mới, từ đó chủ động rút ngắn lịch ôn tập mà không cần ai phải tự khai báo
.
