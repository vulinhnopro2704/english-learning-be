# KỊCH BẢN THUYẾT TRÌNH ĐỒ ÁN TỐT NGHIỆP (MỤC TIÊU XUẤT SẮC 8.5+)

## Đề tài

**Xây dựng Nền tảng học tiếng Anh trên kiến trúc Microservices: Ứng dụng FSRS v6 để lập lịch ôn tập, dự đoán trạng thái trí nhớ và Generative AI để sinh bài tập ngữ cảnh**

---

## MỤC TIÊU CỦA BÀI THUYẾT TRÌNH

Hội đồng tốt nghiệp ngành Công nghệ thông tin / Kỹ thuật phần mềm không muốn nghe phần trình bày giống như giới thiệu sản phẩm thương mại. Trọng tâm của bài thuyết trình là phải chứng minh được:

1. **Tính khoa học của giải pháp:** Cơ sở toán học của thuật toán FSRS v6 (Spaced Repetition) và cách nó tối ưu hơn các thuật toán truyền thống (SuperMemo-2, Leitner).
2. **Chiều sâu kỹ thuật phần mềm:** Thiết kế hệ thống Microservices chuẩn chỉnh (API Gateway, Database Isolation, Cache Strategy, Eventual Consistency, Fault-tolerant CI/CD).
3. **Giải pháp AI thực tiễn & Tối ưu hóa:** Ứng dụng mô hình LLM cục bộ (Local LLM via Ollama) để tiết kiệm chi phí, kết hợp tối ưu hóa Pipeline đa phương tiện (VAD, Opus Codec) và rendering 3D (Draco, KTX2).
4. **Quy trình kiểm soát chất lượng dữ liệu:** Huấn luyện (training) & kiểm tra (evaluation gate) để tránh làm hỏng mô hình học máy cá nhân hóa của người dùng.

---

## PHÂN BỔ THỜI GIAN (Tổng: 15 phút)

| Nội dung slide                                        | Thời gian đề xuất | Tập trung trọng tâm                                       |
| :---------------------------------------------------- | :---------------- | :-------------------------------------------------------- |
| Slide 1: Giới thiệu                                   | 30 giây           | Chuyên nghiệp, ngắn gọn                                   |
| Slide 2: Đặt vấn đề & Bài toán thực tế                | 1 phút            | Nỗi đau người học, giới hạn của công nghệ cũ              |
| Slide 3: Tổng quan giải pháp & Hệ sinh thái           | 1 phút            | 3 trụ cột: FSRS v6, GenAI, Microservices                  |
| Slide 4: Kiến trúc hệ thống Microservices             | 1 phút 30 giây    | Sơ đồ khối, sự cô lập Database (Neon Postgres)            |
| Slide 5: API Gateway - Trụ cột an ninh                | 1 phút            | JWT, Session Revocation (Redis), Rate Limiting            |
| Slide 6: Learn Service Caching & Invalidation         | 1 phút            | Chiến lược cache SHORT/MEDIUM/LONG & Eviction             |
| Slide 7: Cơ sở toán học FSRS v6 & Mô hình DHP         | 1 phút 30 giây    | Công thức toán học cốt lõi (S, D, R), hiệu ứng giãn cách  |
| Slide 8: FSRS-AI Service - ML Pipeline                | 1 phút 30 giây    | Evaluation Gate (Log-Loss), Async Reschedule, Rollback    |
| Slide 9: Generative Service & Multimedia Optimization | 1 phút 30 giây    | Local LLM Ollama, TTS/STT, VAD, Opus, Draco, KTX2         |
| Slide 10: Quy trình Triển khai CI/CD & DevOps         | 1 phút            | GitHub Actions, GHCR, Fault-tolerant Deploy, PM2          |
| Slide 11: Demo Hệ thống thực tế                       | 3 phút            | Luồng đi từ học từ vựng -> FSRS tính toán -> Luyện nói AI |
| Slide 12: Đóng góp & Hướng phát triển                 | 1 phút            | Tóm tắt kết quả, mở rộng phát triển                       |

---

# CHI TIẾT NỘI DUNG SLIDE & KỊCH BẢN THUYẾT TRÌNH

---

Kính thưa Thầy/Cô Chủ tịch và các Thầy/Cô trong Hội đồng chấm đồ án tốt nghiệp, cùng toàn thể các bạn sinh viên có mặt trong buổi bảo vệ ngày hôm nay.Em tên là [Họ và tên], sinh viên lớp [Tên lớp], khoa [Tên khoa]. Sau thời gian học tập và nghiên cứu dưới sự hướng dẫn khoa học của Thầy/Cô [Tên GVHD], hôm nay em xin phép được báo cáo kết quả thực hiện đồ án tốt nghiệp của mình với đề tài: [Tên đầy đủ của đề tài].Sau đây, em xin kính mời Hội đồng cùng theo dõi phần trình bày của em.

## Slide 1. GIỚI THIỆU ĐỀ TÀI

### Nội dung Slide

- **Tên đề tài:** Xây dựng Nền tảng học tiếng Anh trên kiến trúc Microservices: Ứng dụng FSRS v6 để lập lịch ôn tập, dự đoán trạng thái trí nhớ và Generative AI để sinh bài tập ngữ cảnh
- **Sinh viên thực hiện:** Trương Vũ Linh
- **Giảng viên hướng dẫn:** [Tên Giảng viên]
- **Trường/Khoa:** [Logo Trường] - Khoa Công nghệ Thông tin

### Kịch bản thuyết trình

> Kính chào quý Thầy/Cô trong Hội đồng bảo vệ đồ án tốt nghiệp. Em tên là **Trương Vũ Linh**.
>
> Hôm nay, em xin phép được trình bày đề tài đồ án tốt nghiệp của mình: **"Xây dựng Nền tảng học tiếng Anh trên kiến trúc Microservices, ứng dụng thuật toán FSRS v6 để lập lịch ôn tập, dự đoán trạng thái trí nhớ và Generative AI để sinh bài tập ngữ cảnh."**
>
> Đề tài này được em nghiên cứu và xây dựng nhằm giải quyết triệt để bài toán cá nhân hóa lộ trình ghi nhớ từ vựng dựa trên cơ sở khoa học nhận thức, đồng thời tạo ra môi trường luyện phản xạ giao tiếp thông minh với chi phí vận hành tối ưu. Sau đây em xin phép bắt đầu phần trình bày của mình.

---

## Slide 2. ĐẶT VẤN ĐỀ & BÀI TOÁN THỰC TẾ

### Nội dung Slide

- **Đường cong quên lãng (Ebbinghaus Forgetting Curve):** Khả năng ghi nhớ thông tin giảm tới 70-80% chỉ sau vài ngày nếu không có lịch ôn tập tối ưu.
- **Giới hạn giải pháp cũ:**
  - _Leitner (Flashcard truyền thống):_ Phân chia hộp thẻ cố định, thiếu linh hoạt, dễ gây nản lòng hoặc quá tải.
  - _SuperMemo-2 (SM-2):_ Lập lịch dựa trên quy luật chung của số đông, không thích ứng theo hành vi và tốc độ học của từng cá nhân ("Ease Hell" - kẹt trong vòng lặp ôn tập từ khó).
- **Thiếu ngữ cảnh ứng dụng:** Học từ vựng rời rạc, thiếu môi trường thực hành phản xạ giao tiếp tự nhiên (Voice Interaction).

### Kịch bản thuyết trình

> Trong học tập ngoại ngữ, thách thức lớn nhất của người học là sự suy giảm trí nhớ theo thời gian, được mô tả bởi **Đường cong quên lãng của Hermann Ebbinghaus**. Khả năng nhớ lại từ vựng giảm rất nhanh chỉ sau vài ngày nếu không có sự ôn tập đúng thời điểm.
>
> Các hệ thống hiện nay thường áp dụng thuật toán cổ điển như **Leitner** hoặc **SuperMemo-2 (SM-2)**. Tuy nhiên, SM-2 có điểm yếu cốt lõi là lập lịch dựa trên thống kê chung của số đông, dẫn đến hiện tượng "Ease Hell" - người học bị kẹt trong việc ôn tập lặp đi lặp lại những từ khó mà không thể thoát ra. Ngoài ra, việc học từ vựng thường bị cô lập, thiếu đi môi trường luyện tập phản xạ giao tiếp thực tế.
>
> Nhận diện các khoảng trống công nghệ đó, đồ án này đặt ra mục tiêu xây dựng một nền tảng giải quyết trọn vẹn cả 3 khía cạnh: tối ưu hóa thời điểm ôn tập cá nhân hóa, tối ưu chi phí sinh bài tập ngữ cảnh, và tạo môi trường giao tiếp thoại thời gian thực.

## Slide 3. KIẾN TRÚC HỆ THỐNG MICROSERVICES & DATABASE ISOLATION

### Nội dung Slide

```
┌────────────────────────────────────────────────────────┐
│                   React Client App                     │
└──────────────────────────┬─────────────────────────────┘
                           │ Public HTTP (:3000)
                           ▼
┌────────────────────────────────────────────────────────┐
│        API Gateway (NestJS + Redis Session Cache)      │
└────┬──────────┬──────────┬───────────┬───────────┬─────┘
     │          │          │           │           │ Internal HTTP
     ▼          ▼          ▼           ▼           ▼ (Docker Network)
┌────────┐ ┌────────┐ ┌─────────┐ ┌─────────┐ ┌────────────┐
│  Auth  │ │ Learn  │ │ Storage │ │ FSRS-AI │ │ Generative │
│ Service│ │ Service│ │ Service │ │ Service │ │  Service   │
└────┬───┘ └────┬───┘ └────┬────┘ └────┬────┘ └─────┬──────┘
     │          │          │           │            │
     ▼          ▼          ▼           ▼            ▼
┌────────────────────────────────────────────────────────┐
│            Neon Serverless PostgreSQL (Cloud)          │
│    (Mỗi service sở hữu một Schema/Database riêng biệt)  │
└────────────────────────────────────────────────────────┘
```

- **Database Isolation:** Tuân thủ nguyên tắc thiết kế Microservices. Mỗi service kết nối đến cơ sở dữ liệu riêng thông qua các URL Schema độc lập trên Neon PostgreSQL.

### Kịch bản thuyết trình

> Đây là sơ đồ kiến trúc tổng thể của hệ thống.
>
> Yêu cầu từ phía React Client sẽ đi qua **API Gateway** được xây dựng trên NestJS để thực hiện phân luồng, xác thực và kiểm soát lưu lượng. Bên trong mạng nội bộ (Docker Network), Gateway sẽ điều phối yêu cầu đến 5 microservices chuyên biệt thông qua giao thức HTTP.
>
> Để đảm bảo tính độc lập và giảm thiểu rủi ro xung đột dữ liệu, em áp dụng nguyên lý **Database Isolation**. Dù sử dụng hạ tầng cơ sở dữ liệu đám mây **Neon Serverless PostgreSQL**, mỗi service (`Auth`, `Learn`, `Storage`, `FSRS-AI`, và `Generative`) chỉ được phép truy cập và quản lý schema/database của riêng mình. Mọi sự trao đổi dữ liệu chéo giữa các service đều phải đi qua Gateway hoặc các API nội bộ, tuyệt đối không truy vấn trực tiếp vào DB của service khác.

---

## Slide 4. API GATEWAY - TRỤ CỘT BẢO MẬT & ĐIỀU PHỐI

### Nội dung Slide

- **Vai trò chính:**
  - **Reverse Proxy:** Định tuyến các endpoint `/api/v1/auth/*`, `/api/v1/learn/*`, `/api/v1/fsrs/*`, v.v.
  - **Security & Auth Handshake:** Xác thực JWT token tập trung.
  - **Active Session Management:** Kiểm tra token bị thu hồi (Session Revocation) tức thì qua Redis Cache.
  - **Downstream Context Injection:** Sau khi xác thực thành công, Gateway tự động tiêm thông tin `x-user-id` vào header của request trước khi forward đến các service nội bộ.
  - **Traffic Control:** Giới hạn tần suất yêu cầu (IP-based Rate Limiting - mặc định 100 req/phút) và cơ chế chặn IP (IP Blacklist) lưu trữ cấu hình trên Redis.

### Kịch bản thuyết trình

> Trong hệ thống Microservices, **API Gateway** đóng vai trò là "chốt chặn bảo mật" duy nhất đối mặt với môi trường Internet.
>
> Thay vì để mỗi service tự xác thực JWT, Gateway sẽ đảm nhận việc này một cách tập trung. Khi có yêu cầu gửi lên, Gateway kiểm tra tính hợp lệ của JWT và đối chiếu với danh sách các token đã bị thu hồi (Blacklist/Session Revocation) lưu trên bộ nhớ đệm **Redis** với độ trễ cực thấp.
>
> Khi xác thực thành công, Gateway sẽ tiêm mã định danh người dùng vào header dạng `x-user-id` và chuyển tiếp đến các service phía sau. Các service nội bộ chỉ cần tin tưởng header này mà không cần giải mã lại JWT, giúp giảm tải CPU.
>
> Để bảo vệ hệ thống khỏi các cuộc tấn công DDoS hoặc spam API, Gateway cấu hình cơ chế **Rate Limiting** giới hạn 100 request một phút cho mỗi địa chỉ IP và hỗ trợ cấu hình **IP Blacklist** động thông qua Redis.

---

## Slide 5. LEARN SERVICE CACHING & INVALIDATION STRATEGY

### Nội dung Slide

- **Kiến trúc Cache:** NestJS Cache Manager + Redis 7 làm phân vùng cache chính.
- **Chiến lược Phân cấp TTL (Time-To-Live):**
  - `SHORT (60 giây):` Cho các dữ liệu tiến trình thay đổi liên tục (User Streak, Daily Goal Progress).
  - `MEDIUM (5 phút):` Cho danh sách từ vựng, thông tin bài học (Lessons, Words).
  - `LONG (24 giờ):` Cho cấu trúc khóa học (Courses structure).
- **Cơ chế Invalidation (Thu hồi Cache tự động):**
  - Khi xảy ra các thao tác ghi (Mutations: create, update, complete lesson, submit practice), hệ thống sử dụng cơ chế xóa cache theo Scope-based Pattern (ví dụ: quét và xóa toàn bộ cache key bắt đầu bằng `learn:v1:courses:u:[userId]`).

### Kịch bản thuyết trình

> Để tối ưu hóa hiệu năng truy vấn cho **Learn Service** - nơi chịu tải lớn nhất khi người dùng duyệt danh mục bài học, em đã thiết kế hệ thống **Caching** phân cấp sử dụng **Redis 7**.
>
> Cache key được tổ chức theo quy chuẩn nghiêm ngặt: `learn:v1:[scope]:u:[userId]:q:[params]`. Em phân chia thời gian sống của cache (TTL) thành 3 cấp độ: `SHORT` 60 giây đối với dữ liệu động như Streak; `MEDIUM` 5 phút cho từ vựng và bài học; và `LONG` 24 giờ cho cấu trúc khóa học ít biến động.
>
> Điểm phức tạp nhất ở đây là việc xử lý tính nhất quán của dữ liệu (Data Consistency). Khi người dùng hoàn thành một bài học hoặc thực hiện ôn tập, hệ thống sẽ kích hoạt cơ chế **Scope-based Cache Invalidation**, tự động quét và xóa sạch các key Redis thuộc scope bị ảnh hưởng của chính user đó. Nhờ vậy, dữ liệu hiển thị trên Client luôn được cập nhật mới nhất ngay sau khi có sự thay đổi, đồng thời giảm tải hơn 80% truy vấn đọc trực tiếp vào cơ sở dữ liệu PostgreSQL.

---

## Slide 7. CƠ SỞ TOÁN HỌC THUẬT TOÁN FSRS v6

### Nội dung Slide

- **Mô hình nhận thức DHP (Difficulty - Stability - Retrievability):**
  - **Stability ($S$):** Độ ổn định của trí nhớ (số ngày cần thiết để xác suất nhớ lại giảm còn 90%).
  - **Difficulty ($D$):** Độ khó vốn có của từ vựng (thang điểm 1 - 10).
  - **Retrievability ($R$):** Xác suất nhớ lại của từ vựng tại thời điểm kiểm tra:
    $$R(t, S) = \left(1 + \text{FACTOR} \cdot \frac{t}{S}\right)^{\text{DECAY}}$$
    _(Với FSRS v4.5/v6, $\text{FACTOR} = \frac{19}{81}$, $\text{DECAY} = -0.5$)_
- **Khoảng thời gian ôn tập tiếp theo ($I$):** Tính toán dựa trên mức độ giữ lại mục tiêu (Target Retention - $r$):
  $$I(r, S) = \frac{S}{\text{FACTOR}} \cdot \left(r^{\frac{1}{\text{DECAY}}} - 1\right)$$
- **Hiệu ứng giãn cách (Spacing Effect):** $R$ càng nhỏ (ôn tập ngay trước khi quên), độ ổn định mới $S'$ sau khi nhớ lại thành công tăng càng mạnh.

### Kịch bản thuyết trình

> Tiếp theo, em xin phép trình bày về điểm nhấn khoa học của đồ án: **Thuật toán FSRS v6 (Free Spaced Repetition Scheduler)**.
>
> Khác với thuật toán SM-2 lập lịch dựa trên chu kỳ nhân đôi thô sơ, FSRS mô hình hóa trạng thái não bộ dựa trên ba biến số: Độ ổn định ($S$), Độ khó ($D$), và Khả năng nhớ lại ($R$). Khả năng nhớ lại $R$ suy giảm theo thời gian $t$ dưới dạng một hàm số mũ được mô tả trên slide.
>
> Khi người học chọn điểm đánh giá (Again, Hard, Good, Easy), hệ thống sẽ tính toán khoảng thời gian ôn tập tối ưu tiếp theo ($I$) dựa trên mục tiêu duy trì xác suất nhớ lại ($r$ - thường cấu hình là 90%).
>
> Thuật toán này hiện thực hóa **Hiệu ứng giãn cách (Spacing Effect)** trong tâm lý học nhận thức: nếu bạn ôn tập một từ vựng tại thời điểm sắp quên (Retrievability $R$ ở mức thấp) mà vẫn nhớ lại thành công, bộ não sẽ được kích thích mạnh mẽ nhất, giúp độ ổn định trí nhớ $S$ tăng vọt lên trong các chu kỳ sau.

---

## Slide 8. FSRS-AI SERVICE - MACHINE LEARNING PIPELINE & AN TOÀN LẬP LỊCH

### Nội dung Slide

- **Công nghệ sử dụng:** FastAPI (Python) + SQLAlchemy (Asyncpg) + thư viện tối ưu hóa `fsrs[optimizer]`.
- **Quy trình huấn luyện & Kiểm soát chất lượng (Evaluation Gate):**
  - _Điều kiện huấn luyện:_ Chỉ tự động chạy huấn luyện lại bộ trọng số (21 tham số weights) khi người dùng tích lũy đủ dữ liệu (`valid_logs >= 20`) và cách lần train trước tối thiểu 3 ngày.
  - _Cổng kiểm duyệt chất lượng:_ So sánh mô hình mới (Candidate weights) và mô hình cũ (Baseline weights) thông qua độ đo **Log-Loss** (hoặc Calibration Error). Chỉ chấp nhận cập nhật nếu độ lỗi giảm tối thiểu 2% (`FSRS_TRAIN_MIN_IMPROVEMENT_PCT = 0.02`).
  - _Rollback:_ Cho phép phục hồi về phiên bản trọng số ổn định trước đó nếu phát hiện hành vi học bất thường phá vỡ mô hình học máy.
- **Cơ chế Tránh bùng nổ bài học (Safe Reschedule):**
  - Tác vụ phân phối lại lịch học chạy bất đồng bộ (Async).
  - Giới hạn tỉ lệ dịch chuyển do thay đổi trọng số ở mức tối đa 30% (`FSRS_RESCHEDULE_MAX_SHIFT_RATIO = 0.3`) để tránh việc hàng loạt từ vựng bị dồn vào một ngày duy nhất (Study Spikes).

### Kịch bản thuyết trình

> Để huấn luyện mô hình FSRS cá nhân hóa cho từng học viên, em đã xây dựng dịch vụ **FSRS-AI** độc lập sử dụng **FastAPI (Python)** tích hợp bộ tối ưu hóa học máy `fsrs[optimizer]`.
>
> Việc tự động tối ưu hóa trọng số (21 tham số weights đại diện cho đặc thù trí nhớ của mỗi người) cần được kiểm soát nghiêm ngặt. Hệ thống chỉ cho phép kích hoạt huấn luyện khi đạt đủ tối thiểu 20 nhật ký ôn tập hợp lệ và có thời gian giãn cách 3 ngày.
>
> Điểm đột phá về mặt kỹ thuật phần mềm ở đây là cơ chế **Evaluation Gate**. Khi mô hình mới được huấn luyện xong, nó phải trải qua bài kiểm tra chéo độ lỗi **Log-Loss** với mô hình hiện tại. Bộ tham số mới chỉ được ghi nhận nếu nó giúp giảm sai số Log-Loss ít nhất 2% so với bộ cũ. Nếu không đạt, hệ thống sẽ từ chối cập nhật để bảo vệ lịch trình học hiện tại của người dùng. Dữ liệu lịch trình mới sẽ được tính toán bất đồng bộ dưới nền (Async background task) và giới hạn tỷ lệ dịch chuyển do thay đổi weights ở mức tối đa 30% nhằm ngăn chặn hiện tượng dồn ứ bài học, gây áp lực tâm lý cho người học.

---

## Slide 9. GENERATIVE SERVICE - GIA SƯ ẢO AI & TỐI ƯU HÓA PIPELINE ĐA PHƯƠNG TIỆN

### Nội dung Slide

- **Kiến trúc Gia sư ảo (Roleplay & Voice Chat):**
  - **LLM Engine:** Kết nối với **Ollama** chạy mô hình ngôn ngữ lớn cục bộ (Local LLM) -> Giải quyết triệt để bài toán chi phí gọi API và bảo mật dữ liệu.
  - **Speech Processing:** Sử dụng ElevenLabs cho bộ chuyển đổi Text-to-Speech (TTS) và Speech-to-Text (STT) chất lượng cao.
- **Tối ưu hóa Pipeline đa phương tiện (Frontend & Backend):**
  - **Voice Activity Detection (VAD):** Client chỉ kích hoạt gửi luồng âm thanh khi phát hiện tiếng nói của người dùng, tiết kiệm băng thông và tài nguyên CPU máy chủ.
  - **Opus Codec:** Nén và truyền tải âm thanh thời gian thực với độ trễ tối thiểu.
  - **3D Avatar Rendering Optimization:**
    - Nén mô hình nhân vật 3D bằng công nghệ **Draco Compression** (giảm dung lượng tải file GLB).
    - Chuyển đổi texture nhân vật sang định dạng **KTX2** để trình duyệt giải mã trực tiếp bằng GPU thay vì CPU.
    - _Kết quả thực nghiệm:_ VRAM giảm từ **980MB xuống còn 210MB**, loại bỏ hoàn toàn hiện tượng giật khung hình khi chuyển cảnh trên các thiết bị cấu hình thấp.

### Kịch bản thuyết trình

> Bên cạnh việc ôn tập, tính năng **Luyện phản xạ giao tiếp với Gia sư ảo 3D** là một cấu phần quan trọng của đồ án.
>
> Để hiện thực hóa tính năng này với chi phí tối thiểu, em đã sử dụng **Ollama** để tự lưu trữ và chạy mô hình ngôn ngữ lớn cục bộ (Local LLM), cho phép sinh phản hồi hội thoại hoàn toàn miễn phí. Luồng âm thanh tương tác được tối ưu hóa thông qua công nghệ **Voice Activity Detection (VAD)** ở Client để chỉ ghi âm và gửi dữ liệu khi người dùng nói, kết hợp với codec nén âm thanh chuyên dụng **Opus** nhằm mang lại trải nghiệm thoại thời gian thực mượt mà.
>
> Khi tích hợp nhân vật 3D tương tác để tăng tính trực quan, phiên bản đầu tiên gặp hiện tượng trình duyệt bị đứng và tụt FPS do dung lượng mô hình lớn và CPU bị quá tải khi giải mã vân bề mặt (texture).
>
> Em đã giải quyết bài toán này bằng cách nén mô hình qua **Draco** và chuyển toàn bộ texture sang chuẩn **KTX2**. Kết quả tối ưu rất ấn tượng: lượng bộ nhớ đồ họa VRAM tiêu thụ giảm từ **980MB xuống chỉ còn 210MB**, giúp nhân vật 3D hiển thị mượt mà ở mức 60 FPS ngay cả trên các thiết bị di động cấu hình trung bình.

---

## Slide 10. QUY TRÌNH TRIỂN KHAI CI/CD & DEVOPS

### Nội dung Slide

- **Hạ tầng Dockerized:** Mỗi service được đóng gói bằng Multi-stage Dockerfile giúp giảm kích thước Image xuống tối đa (sử dụng Alpine Linux base image).
- **Luồng CI/CD tự động (GitHub Actions):**
  - Trigger build khi push vào branch `main` (có bộ lọc path-filter để chỉ rebuild service có thay đổi code).
  - Tự động đóng gói và đẩy Container Image lên **GitHub Container Registry (GHCR)**.
- **Chính sách Triển khai Chịu lỗi (Fault-tolerant Deployment Policy):**
  - Quá trình deploy trên VPS được tự động hóa qua SSH.
  - Hệ thống cho phép deploy từng phần: Nếu một service bất kỳ gặp lỗi không thể build hình ảnh mới, quy trình CI/CD vẫn tiếp tục cập nhật các service thành công khác, giữ nguyên hình ảnh cũ của service lỗi để đảm bảo hệ thống không bị gián đoạn.
  - `api-gateway` luôn được cập nhật và kiểm tra sức khỏe (Health Check) cuối cùng để đảm bảo tính sẵn sàng toàn hệ thống.
  - Sử dụng **PM2 Runtime** (`pm2-runtime`) làm Process Manager bên trong mỗi container để tự động khởi động lại tiến trình Node.js nếu xảy ra crash đột ngột.

### Kịch bản thuyết trình

> Nhằm chứng minh tính thực tiễn của một kỹ sư phần mềm, em đã thiết lập toàn bộ quy trình phát triển và vận hành tự động hóa (DevOps) cho dự án.
>
> Mỗi microservice được đóng gói bằng **Dockerfile Multi-stage** để giảm thiểu dung lượng ảnh container. Quy trình tích hợp và triển khai liên tục (CI/CD) được thiết lập thông qua **GitHub Actions**. Khi có mã nguồn mới đẩy lên nhánh chính, hệ thống sẽ nhận diện thay đổi theo từng thư mục (path-filtering) để chỉ tiến hành build lại service đó nhằm tiết kiệm thời gian và tài nguyên.
>
> Quy trình deploy trên máy chủ VPS được cấu hình theo **Chính sách chịu lỗi từng phần (Fault-tolerant Deployment)**. Nếu quá trình build của một service bị thất bại, workflow vẫn tiếp tục triển khai các service thành công khác mà không làm gián đoạn toàn bộ hệ thống. Service lỗi sẽ tạm thời chạy trên image cũ ổn định. API Gateway luôn được khởi động lại và kiểm tra Health Check ở bước cuối cùng của luồng deploy. Đồng thời, bên trong các container Node.js, em cấu hình **PM2** để giám sát và tự phục hồi tiến trình ngay lập tức nếu xảy ra lỗi nghiêm trọng gây sập ứng dụng.

---

## Slide 11. KỊCH BẢN DEMO HỆ THỐNG THỰC TẾ

### Nội dung Slide

- **Luồng trải nghiệm người dùng tương thích kiến trúc:**

```
[Đăng nhập qua Gateway/Auth] ──► [Học từ vựng mới (Learn Service)]
                                        │
                                        ▼
[Ôn tập từ vựng đến hạn] ◄── [FSRS-AI tính toán lịch học mới]
        │
        ▼
[Luyện hội thoại theo ngữ cảnh sinh bởi AI (Generative Service)]
        │
        ▼
[Xem Dashboard phân tích tiến trình, chỉ số rủi ro quên từ]
```

- **Minh họa API Phản hồi:** API Insights, Daily Report trả về đồng thời hai cấu trúc: `metrics` (vẽ biểu đồ trực quan) và `narrative` (câu giải thích bằng tiếng Việt thân thiện).

### Kịch bản thuyết trình

> Sau đây, em xin phép trình diễn Demo hoạt động thực tế của hệ thống để chứng minh sự phối hợp nhịp nhàng giữa các microservices.
>
> Đầu tiên, người dùng đăng nhập thông qua Google OAuth. Yêu cầu đi qua Gateway và được xử lý tại **Auth Service**.
>
> Tiếp theo, học viên vào giao diện bài học của **Learn Service**, tiến hành học từ mới. Khi hoàn thành bài học, Learn Service sẽ gọi sang **FSRS-AI Service** để khởi tạo các thẻ ghi nhớ (cards) tương ứng với người dùng.
>
> Khi đến hạn ôn tập, học viên thực hiện trả lời và đánh giá mức độ ghi nhớ. FSRS-AI dựa trên phản hồi để cập nhật trạng thái trí nhớ và tính toán lịch ôn tập tiếp theo.
>
> Sau khi đã thuộc từ vựng, người dùng có thể mở giao diện Gia sư ảo 3D thuộc **Generative Service** để bắt đầu hội thoại. Lúc này mô hình Local LLM sẽ tự động phân tích các từ vựng người dùng đã học để thiết lập một bối cảnh giao tiếp chứa các từ đó, ép buộc người dùng phải vận dụng thực tế.
>
> Cuối cùng, kết quả học tập sẽ được hiển thị trên Dashboard. Các API báo cáo của chúng ta không chỉ trả về số liệu thô mà còn trả về cả các đoạn nhận xét bằng tiếng Việt được sinh tự động, ví dụ như: _"Ngày mai có 28 từ đến hạn, bạn nên ôn tập thành 2 phiên ngắn để tránh dồn ứ bài học"_.

---

## Slide 12. KẾT QUẢ ĐẠT ĐƯỢC & GIÁ TRỊ THỰC TIỄN

### Nội dung Slide

- **Về mặt Nghiên cứu & Thuật toán:**
  - Tích hợp thành công mô hình FSRS v6 cá nhân hóa weights cho từng học viên.
  - Hạn chế tối đa hiện tượng lệch lịch học nhờ cơ chế Evaluation Gate bảo vệ mô hình.
- **Về mặt Kỹ thuật hệ thống:**
  - Xây dựng hệ thống Microservices hoàn chỉnh, bảo mật qua API Gateway, tăng tốc độ truy cập nhờ Redis Cache phân cấp.
  - Tối ưu hóa thành công tài nguyên đồ họa WebGL (VRAM giảm 78%) và tối ưu hóa băng thông truyền tải âm thanh (VAD + Opus Codec).
- **Khả năng triển khai thực tế:**
  - Hệ thống đã được đóng gói container hóa hoàn chỉnh và triển khai thực tế lên VPS thông qua pipeline CI/CD tự động chịu lỗi.

### Kịch bản thuyết trình

> Trải qua quá trình nghiên cứu và phát triển nghiêm túc, đồ án đã hoàn thành toàn bộ các mục tiêu đề ra với những kết quả thực tiễn rõ rệt:
>
> Về mặt nghiên cứu, đồ án đã tích hợp thành công mô hình khoa học nhận thức **FSRS v6** với quy trình tự động tối ưu hóa và bảo vệ mô hình máy học thông minh bằng độ đo Log-Loss, giúp lịch ôn tập bám sát thực tế trí nhớ người học.
>
> Về mặt kỹ thuật phần mềm, hệ thống đã chứng minh được tính đúng đắn của kiến trúc Microservices cô lập dữ liệu hoàn toàn. Các giải pháp tối ưu hóa bộ nhớ đồ họa VRAM cho mô hình 3D từ 980MB xuống 210MB cùng giải pháp truyền tải âm thanh nén Opus đã biến một ứng dụng nặng về đồ họa và âm thanh trở nên khả thi và mượt mà trên trình duyệt web thông thường.
>
> Toàn bộ mã nguồn đã được triển khai thực tế trên máy chủ VPS, hoạt động ổn định và sẵn sàng cho việc mở rộng tính năng.

---

## Slide 13. HƯỚNG PHÁT TRIỂN TƯƠNG LAI

### Nội dung Slide

- **Đánh giá phát âm (Pronunciation Assessment):** Tích hợp thêm AI Engine để phân tích phổ âm thanh của người nói, chấm điểm chi tiết đến từng âm vị (Phoneme-level).
- **Fine-tuning Mô hình Ngôn ngữ cục bộ:** Tiến hành tinh chỉnh (Fine-tune) các mô hình LLM mã nguồn mở dung lượng nhỏ (như Llama-3-8B hoặc Qwen-2) chuyên biệt cho tác vụ sư phạm tiếng Anh để gia sư AI phản hồi thông minh hơn.
- **Phát triển đa nền tảng:** Xây dựng phiên bản Mobile Application (React Native / Flutter) đồng bộ dữ liệu ngoại tuyến (Offline Syncing) giúp người học ôn tập mọi lúc mọi nơi.

### Kịch bản thuyết trình

> Để hệ thống ngày một hoàn thiện hơn, trong tương lai, đồ án có thể được tiếp tục phát triển theo ba hướng chính:
>
> Thứ nhất, phát triển module **Đánh giá phát âm**. Sử dụng các mô hình học sâu để so sánh phổ âm thanh của học viên với người bản xứ, đưa ra điểm số chi tiết cho từng âm vị để họ tự sửa sai.
>
> Thứ hai, tiến hành **Fine-tuning** một mô hình LLM nội bộ chuyên sâu về giảng dạy tiếng Anh, giúp gia sư ảo có khả năng sửa lỗi ngữ pháp chuẩn xác và thông minh hơn.
>
> Cuối cùng là xây dựng ứng dụng di động đa nền tảng kết hợp cơ chế đồng bộ dữ liệu ngoại tuyến, giúp học viên học tập liền mạch ngay cả khi không có kết nối Internet.
>
> Trên đây là toàn bộ nội dung trình bày đồ án tốt nghiệp của em. Em xin chân thành cảm ơn quý Thầy, Cô trong Hội đồng đã dành thời gian lắng nghe. Em rất mong nhận được những nhận xét, ý kiến đóng góp và câu hỏi từ thầy cô để đồ án của em được hoàn thiện hơn nữa. Em xin chân thành cảm ơn.
