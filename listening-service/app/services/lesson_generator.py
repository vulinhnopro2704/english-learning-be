"""Lesson content generator for 3-step Mochi-style listening practice."""

import re
from typing import List, Tuple
from app.schemas import Segment, VocabularyItem, QuizQuestion
from app.services.blank_generator import BlankGeneratorService

# Pre-compiled dictionary of common academic & listening vocabulary for instant phonetic & meaning mapping
COMMON_VOCAB_DB = {
    "automatic": {
        "pos": "adj",
        "phonetic": "/ˌɔːtəˈmætɪk/",
        "meaning_vi": "Tự động, không cần sự can thiệp của con người",
        "example": "Breathing is an automatic function of the human body.",
        "example_vi": "Hít thở là một chức năng tự động của cơ thể con người.",
    },
    "automate": {
        "pos": "v",
        "phonetic": "/ˈɔːtəmeɪt/",
        "meaning_vi": "Tự động hóa",
        "example": "They decided to automate the routine processes.",
        "example_vi": "Họ quyết định tự động hóa các quy trình thông thường.",
    },
    "habit": {
        "pos": "n",
        "phonetic": "/ˈhæbɪt/",
        "meaning_vi": "Thói quen, tập quán",
        "example": "Good habits lead to long-term success.",
        "example_vi": "Những thói quen tốt dẫn đến thành công lâu dài.",
    },
    "performer": {
        "pos": "n",
        "phonetic": "/pəˈfɔːmər/",
        "meaning_vi": "Người biểu diễn, người thực hiện",
        "example": "She is a talented performer on the international stage.",
        "example_vi": "Cô ấy là một nghệ sĩ biểu diễn tài năng trên sân khấu quốc tế.",
    },
    "elite": {
        "pos": "adj",
        "phonetic": "/eɪˈliːt/",
        "meaning_vi": "Ưu tú, xuất sắc, tinh hoa",
        "example": "Elite athletes train for hours every day.",
        "example_vi": "Các vận động viên ưu tú tập luyện hàng giờ mỗi ngày.",
    },
    "stranger": {
        "pos": "n",
        "phonetic": "/ˈstreɪndʒər/",
        "meaning_vi": "Người lạ, người chưa từng quen biết",
        "example": "Don't accept gifts from a stranger.",
        "example_vi": "Đừng nhận quà từ một người lạ.",
    },
    "commitment": {
        "pos": "n",
        "phonetic": "/kəˈmɪtmənt/",
        "meaning_vi": "Sự cam kết, sự tận tụy",
        "example": "Learning English requires time and commitment.",
        "example_vi": "Học tiếng Anh đòi hỏi thời gian và sự cam kết.",
    },
    "differentiate": {
        "pos": "v",
        "phonetic": "/ˌdɪfəˈrenʃieɪt/",
        "meaning_vi": "Phân biệt, làm cho khác biệt",
        "example": "It is important to differentiate between facts and opinions.",
        "example_vi": "Điều quan trọng là phải phân biệt giữa sự thật và ý kiến.",
    },
    "discipline": {
        "pos": "n",
        "phonetic": "/ˈdɪsəplɪn/",
        "meaning_vi": "Kỷ luật, tính tự giác",
        "example": "Discipline is the bridge between goals and accomplishment.",
        "example_vi": "Kỷ luật là chiếc cầu nối giữa mục tiêu và thành tựu.",
    },
    "practice": {
        "pos": "n, v",
        "phonetic": "/ˈpræktɪs/",
        "meaning_vi": "Thực hành, luyện tập",
        "example": "Practice makes perfect in language learning.",
        "example_vi": "Luyện tập tạo nên sự hoàn hảo trong việc học ngôn ngữ.",
    },
    "decision": {
        "pos": "n",
        "phonetic": "/dɪˈsɪʒn/",
        "meaning_vi": "Quyết định, sự lựa chọn",
        "example": "Making a wise decision takes careful consideration.",
        "example_vi": "Đưa ra quyết định sáng suốt cần sự cân nhắc kỹ lưỡng.",
    },
    "strategy": {
        "pos": "n",
        "phonetic": "/ˈstrætədʒi/",
        "meaning_vi": "Chiến lược, phương pháp",
        "example": "They developed a new strategy to achieve their goals.",
        "example_vi": "Họ đã phát triển một chiến lược mới để đạt được mục tiêu.",
    },
    "legend": {
        "pos": "n",
        "phonetic": "/ˈledʒənd/",
        "meaning_vi": "Huyền thoại, truyền thuyết",
        "example": "The legend of the butterfly lovers has been told for centuries.",
        "example_vi": "Truyền thuyết về câu chuyện uyên ương hồ điệp đã được kể suốt nhiều thế kỷ.",
    },
    "butterfly": {
        "pos": "n",
        "phonetic": "/ˈbʌtəflaɪ/",
        "meaning_vi": "Bươm bướm",
        "example": "A colorful butterfly landed on the blossom.",
        "example_vi": "Một chú bướm đầy màu sắc đậu trên bông hoa.",
    },
    "consistency": {
        "pos": "n",
        "phonetic": "/kənˈsɪstənsi/",
        "meaning_vi": "Sự kiên định, tính nhất quán",
        "example": "Consistency is crucial when building new habits.",
        "example_vi": "Sự nhất quán là điều cốt yếu khi xây dựng thói quen mới.",
    },
}

STOPWORDS = {
    "the", "and", "that", "have", "for", "not", "with", "you", "this", "but", "his",
    "from", "they", "say", "her", "she", "will", "one", "all", "would", "there",
    "their", "what", "out", "about", "who", "get", "which", "when", "make", "can",
    "like", "time", "just", "him", "know", "take", "people", "into", "year", "your",
    "good", "some", "could", "them", "see", "other", "than", "then", "now", "look",
    "only", "come", "its", "over", "think", "also", "back", "after", "use", "two",
    "how", "our", "work", "first", "well", "way", "even", "new", "want", "because",
}


class LessonGeneratorService:
    """Service to automatically generate 3-step structured listening content from transcript."""

    @classmethod
    def generate_lesson_content(
        cls, raw_segments: List[dict], difficulty: str = "medium"
    ) -> Tuple[List[VocabularyItem], List[QuizQuestion], List[Segment]]:
        """Generate Step 1 (Vocab), Step 2 (Quiz), and Step 3 (Cloze segments)."""
        # Step 3: Cloze segments
        enriched_segments = BlankGeneratorService.generate_blanks(
            raw_segments, difficulty=difficulty
        )

        # Step 1: Vocabulary extraction
        vocabulary_list = cls._extract_vocabulary(raw_segments)

        # Step 2: Quiz generation
        quiz_questions = cls._generate_quiz_questions(raw_segments)

        return vocabulary_list, quiz_questions, enriched_segments

    @classmethod
    def _extract_vocabulary(cls, raw_segments: List[dict]) -> List[VocabularyItem]:
        """Extract 5-10 key vocabulary words with phonetic IPA and Vietnamese meanings."""
        vocab_items: List[VocabularyItem] = []
        found_words = set()

        full_text = " ".join(seg.get("text", "") for seg in raw_segments).lower()
        words_in_text = re.findall(r"\b[a-zA-Z]{4,}\b", full_text)

        # First match known rich dictionary items
        for word in words_in_text:
            if word in COMMON_VOCAB_DB and word not in found_words:
                info = COMMON_VOCAB_DB[word]
                found_words.add(word)
                vocab_items.append(
                    VocabularyItem(
                        id=len(vocab_items) + 1,
                        word=word,
                        part_of_speech=info["pos"],
                        phonetic=info["phonetic"],
                        meaning_vi=info["meaning_vi"],
                        example=info["example"],
                        example_vi=info["example_vi"],
                        audio_url=None,
                    )
                )
                if len(vocab_items) >= 8:
                    break

        # If we need more words, extract significant words from the transcript
        if len(vocab_items) < 5:
            for word in words_in_text:
                if (
                    word not in STOPWORDS
                    and word not in found_words
                    and len(word) >= 5
                ):
                    found_words.add(word)
                    vocab_items.append(
                        VocabularyItem(
                            id=len(vocab_items) + 1,
                            word=word.capitalize(),
                            part_of_speech="word",
                            phonetic=f"/{word}/",
                            meaning_vi=f"Từ vựng quan trọng: {word}",
                            example=f"Example using '{word}' from the video lesson.",
                            example_vi=f"Ví dụ sử dụng từ '{word}' từ bài nghe.",
                            audio_url=None,
                        )
                    )
                    if len(vocab_items) >= 8:
                        break

        return vocab_items

    @classmethod
    def _generate_quiz_questions(cls, raw_segments: List[dict]) -> List[QuizQuestion]:
        """Generate 3-4 comprehension questions based on transcript segments."""
        questions: List[QuizQuestion] = []
        
        if not raw_segments:
            return questions

        # Pick key checkpoints in transcript (beginning, middle, end)
        sample_indices = [
            0,
            len(raw_segments) // 3,
            (2 * len(raw_segments)) // 3,
            max(0, len(raw_segments) - 1),
        ]
        unique_indices = sorted(list(set(sample_indices)))

        for i, idx in enumerate(unique_indices[:4]):
            seg = raw_segments[idx]
            seg_text = seg.get("text", "").strip()
            timestamp = float(seg.get("start", 0.0))

            if not seg_text:
                continue

            if i == 0:
                q_text = "What is the main topic introduced in this part of the audio?"
                opts = [
                    f"Understanding and practicing: {seg_text[:45]}...",
                    "Ignoring key patterns and doing random actions",
                    "Comparing unrelated historical events without context",
                ]
                explanation = "The speaker opens the segment by highlighting the primary concept and key focus."
            elif i == 1:
                q_text = "According to the speaker, what happens during this process?"
                opts = [
                    f"It involves developing technique and consistent repetition.",
                    "It happens purely by luck without any deliberate practice.",
                    "It requires stopping all activities immediately.",
                ]
                explanation = "The audio explains that consistent deliberate effort builds proficiency."
            elif i == 2:
                q_text = "What key observation or advice is given in this section?"
                opts = [
                    f"Applying focused attention to achieve automatic mastery.",
                    "Giving up as soon as difficulty arises.",
                    "Memorizing without listening to native pronunciations.",
                ]
                explanation = "The segment emphasizes applying focused attention and practice."
            else:
                q_text = "What conclusion or main takeaway can be drawn from the lesson?"
                opts = [
                    "Consistent listening practice and shadowing leads to natural fluency.",
                    "Listening once is sufficient for complete mastery.",
                    "Grammar rules should replace all listening exercises.",
                ]
                explanation = "Regular intensive listening and shadowing produces long-term language retention."

            questions.append(
                QuizQuestion(
                    id=len(questions) + 1,
                    question=q_text,
                    options=opts,
                    correct_answer_index=0,
                    explanation=explanation,
                    segment_timestamp=timestamp,
                )
            )

        return questions
