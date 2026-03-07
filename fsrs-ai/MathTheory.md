Thuật toán FSRS (Free Spaced Repetition Scheduler) được xây dựng dựa trên mô hình DHP (Difficulty - Độ khó, Stability - Độ ổn định, Retrievability - Khả năng nhớ lại)
. Dưới đây là các công thức toán học cốt lõi (dựa trên các phiên bản FSRS v4/v4.5) và hướng dẫn triển khai thực tế vào hệ thống Microservice của bạn.

1. Công thức toán học cốt lõi của FSRS
   Mô hình sử dụng một bộ trọng số (weights) w gồm 17 đến 21 tham số được tối ưu hóa bằng Machine Learning để cá nhân hóa cho từng người dùng
   ,
   ,
   .
   Các biến số chính
   ,
   :
   G (Grade): Đánh giá của người dùng khi ôn tập (1 = Again/Quên, 2 = Hard/Khó, 3 = Good/Tốt, 4 = Easy/Dễ).
   S (Stability): Độ ổn định của ký ức (thời gian tính bằng ngày để xác suất nhớ lại giảm xuống còn 90%).
   D (Difficulty): Độ khó của thẻ từ (từ 1 đến 10).
   R (Retrievability): Xác suất nhớ lại từ vựng tại thời điểm ôn tập.
   t: Số ngày đã trôi qua kể từ lần ôn tập cuối cùng.
   A. Khởi tạo thẻ mới (Lần ôn tập đầu tiên) Khi người dùng học một từ mới, hệ thống sẽ gán giá trị S
   0
   ​
   và D
   0
   ​
   ban đầu dựa trên điểm đánh giá G
   :
   Độ ổn định ban đầu: S
   0
   ​
   (G)=w
   G−1
   ​

Độ khó ban đầu: D
0
​
(G)=w
4
​
−(G−3)⋅w
5
​

B. Tính toán Đường cong quên lãng & Khoảng thời gian tiếp theo Khi một khoảng thời gian t trôi qua, xác suất nhớ lại R sẽ giảm dần theo công thức
:
R(t,S)=(1+FACTOR⋅
S
t
​
)
DECAY

(Trong FSRS-4.5, FACTOR = 19/81 và DECAY = -0.5
)
Để tính số ngày ôn tập tiếp theo I với một mục tiêu xác suất nhớ lại mong muốn (ví dụ r=90%), ta giải phương trình ngược lại
:
I(r,S)=
FACTOR
S
​
⋅(r
DECAY
1
​

−1)
C. Cập nhật Trạng thái sau khi ôn tập (DHP State Transition) Sau khi người dùng trả lời câu hỏi và chọn điểm G, hệ thống sẽ cập nhật D và S mới:
Cập nhật Độ khó (D
′
):
D
′
(D,G)=w
7
​
⋅D
0
​
(3)+(1−w
7
​
)⋅(D−w
6
​
⋅(G−3))
Ý nghĩa: Độ khó sẽ giảm nếu bạn chọn Easy/Good và tăng nếu bạn chọn Hard/Again. Thành phần w
7
​
⋅D
0
​
(3) là cơ chế "hồi quy về giá trị trung bình" (mean reversion) giúp người dùng không bị kẹt trong trạng thái "ease hell" (thẻ vĩnh viễn bị đánh giá quá khó)
.
Cập nhật Độ ổn định nếu nhớ từ (S
r
′
​
khi G=2,3,4):
S
r
′
​
=S⋅(1+e
w
8
​

⋅(11−D)⋅S
−w
9
​

⋅(e
w
10
​
⋅(1−R)
−1)⋅...)
Ý nghĩa:
Thẻ càng khó (D lớn) thì S tăng càng ít
.
S đang có sẵn càng lớn thì tốc độ tăng thêm càng chậm
.
R càng nhỏ (bạn ôn tập khi gần quên) thì S tăng càng mạnh (đây chính là "Hiệu ứng giãn cách" - Spacing effect)
.
Cập nhật Độ ổn định nếu quên từ (S
f
′
​
khi G=1):
S
f
′
​
=w
11
​
⋅D
−w
12
​

⋅((S+1)
w
13
​

−1)⋅e
w
14
​
⋅(1−R)

Khi quên, S sẽ bị giảm mạnh đi nhiều lần nhưng không về 0 hoàn toàn vì bạn vẫn còn lưu lại một chút ký ức cũ
,
.

---

2. Cách triển khai code thực tế cho Đồ án (Microservice)
   Tin vui là bạn không cần phải tự code lại toàn bộ công thức toán học này từ đầu. Nhóm tác giả đã cung cấp một kho lưu trữ mã nguồn mở tên là "Awesome FSRS", bao gồm các thư viện FSRS đã được đóng gói sẵn cho nhiều ngôn ngữ lập trình (Python, JavaScript/TypeScript, Go, Rust, v.v.)
   ,
   .
   Dưới đây là luồng triển khai thực tế (Workflow) kết hợp với DB Prisma mà bạn đã thiết kế:
   Bước 1: Cài đặt thư viện (Ví dụ bằng Node.js / TypeScript) Trong Service SpacedRepetitionService, bạn cài đặt thư viện FSRS (ví dụ: fsrs.js hoặc ts-fsrs).
   npm install ts-fsrs
   Bước 2: Luồng xử lý khi người dùng bắt đầu học
   Hệ thống truy vấn DB bảng UserWordProgress (đã có index trên cột nextReview) để lấy ra các thẻ có nextReview <= Thời gian hiện tại.
   Gửi danh sách từ vựng này về Frontend để hiển thị dạng Flashcard.
   Bước 3: Xử lý kết quả trả lời (Core Logic) Khi user bấm nút đánh giá (Again, Hard, Good, Easy), Frontend gửi API request về Backend gồm wordId, userId, và grade.
   import { FSRS, Card, Rating } from 'ts-fsrs';

// 1. Khởi tạo FSRS với bộ weights mặc định (hoặc weights cá nhân hóa từ UserFSRSSetting)
const fsrs = new FSRS({
request_retention: 0.9, // Mục tiêu nhớ 90%
w: [0.4, 0.6, 2.4, 5.8, /* ... bộ tham số 17-21 số ... */]
});

// 2. Lấy trạng thái hiện tại của thẻ từ DB
const dbCard = await prisma.userWordProgress.findUnique({ where: { userId_wordId } });

// 3. Mapping data từ DB sang object Card của thư viện
const currentCard: Card = {
due: dbCard.nextReview || new Date(),
stability: dbCard.stability,
difficulty: dbCard.difficulty,
elapsed_days: dbCard.interval,
state: dbCard.state, // 0: New, 1: Learning, 2: Review, 3: Relearning
reps: dbCard.reps,
lapses: dbCard.lapses
};

// 4. Gọi FSRS để tính toán S, D và lịch học tiếp theo
// Tham số grade: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
const schedulingInfo = fsrs.repeat(currentCard, new Date());
const nextCardState = schedulingInfo[grade].card;

// 5. Transaction: Lưu vào DB
await prisma.$transaction([
// 5a. Cập nhật thẻ
prisma.userWordProgress.update({
where: { userId_wordId },
data: {
stability: nextCardState.stability,
difficulty: nextCardState.difficulty,
nextReview: nextCardState.due,
interval: nextCardState.scheduled_days,
state: nextCardState.state,
reps: nextCardState.reps,
lapses: nextCardState.lapses,
lastReviewedAt: new Date()
}
}),
// 5b. Ghi Log để phục vụ Machine Learning sau này (bắt buộc)
prisma.reviewLog.create({
data: {
userId, wordId, grade,
state: currentCard.state,
elapsedDays: /* tính số ngày từ lastReviewedAt đến hiện tại */,
scheduledDays: currentCard.elapsed_days,
stability: currentCard.stability,
difficulty: currentCard.difficulty
}
})
]);
Bước 4: Module Optimizer (Python Machine Learning) Vì bạn yêu cầu kiến trúc Microservice + AI, phần AI sẽ nằm ở một service Python độc lập.
Theo định kỳ (ví dụ mỗi tuần 1 lần), service Python này sẽ query bảng ReviewLog của những user có đủ lượng data log.
Nó sẽ chạy bộ FSRS Optimizer (cũng được cung cấp sẵn mã nguồn trên repo fsrs4anki-optimizer dưới dạng Jupyter Notebook / Python scripts)
.
Optimizer áp dụng Gradient Descent (hoặc MLE) để tìm ra mảng tham số w mới tối ưu hóa riêng cho user đó.
Lưu mảng w mới này vào bảng UserFSRSSetting.weights. Các lần tính toán tiếp theo ở Bước 3 sẽ lấy bộ w cá nhân hóa này để sử dụng, làm cho lịch trình học của sinh viên ngày càng chính xác tuyệt đối! 3. Các tính năng "Mới mẻ và Hoàn thiện" tạo điểm nhấn
Để đồ án của bạn vượt trội hơn các website học từ vựng thông thường, bạn có thể đưa vào các tính năng ưu việt của thuật toán FSRS:
Load Balancing (Cân bằng tải): Khi hệ thống tính toán ngày ôn tập tối ưu, nó có thể thêm một chút nhiễu ngẫu nhiên (fuzz) để phân bổ đều số lượng thẻ cần học, giúp sinh viên không bị quá tải vào một ngày cụ thể
.
Easy Days (Ngày nghỉ ngơi): Cho phép người dùng chọn ra những ngày trong tuần (ví dụ Chủ Nhật) để học ít hơn. Hệ thống AI sẽ tự động điều chỉnh và dời lịch của các thẻ học để tránh ngày đó ra
.
Disperse Siblings (Phân tán thẻ liên quan): Đối với các từ vựng giống nhau hoặc sinh ra từ cùng một gốc (siblings), hệ thống sẽ dãn cách lịch ôn tập của chúng ra xa nhau để tránh hiện tượng người dùng nhớ từ nhờ "gợi ý chéo" thay vì thực sự thuộc bài
.
Postpone/Advance (Trì hoãn hoặc học trước): Cho phép người dùng lùi lịch học nếu họ quá bận, hoặc học vượt trước (ví dụ: sắp thi). Thuật toán AI sẽ điều chỉnh lùi/tiến lịch một cách thông minh nhất để giảm thiểu tổn hại đến trí nhớ dài hạn
.
Advanced Stats (Thống kê chuyên sâu): Cung cấp biểu đồ về True Retention (Tỷ lệ nhớ thực tế để đánh giá chất lượng học) hoặc Steps Stats (Thống kê các bước học để gợi ý tinh chỉnh cho trí nhớ ngắn hạn)
.
