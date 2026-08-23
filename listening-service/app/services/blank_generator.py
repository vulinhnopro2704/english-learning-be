"""Service to generate automatic cloze fill-in-the-blank exercises from transcript text."""

import re
from typing import List, Dict, Any, Optional

# Common English stop words to avoid masking in easy/medium mode
STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "up", "about", "into", "through", "after",
    "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "can", "could", "should", "would", "will", "shall",
    "this", "that", "these", "those", "it", "its", "he", "him", "his", "she",
    "her", "hers", "they", "them", "their", "theirs", "we", "us", "our", "ours",
    "i", "me", "my", "mine", "you", "your", "yours"
}


class BlankGeneratorService:
    """Generates fill-in-the-blank items from transcript sentences."""

    @classmethod
    def generate_blanks(
        cls,
        segments: List[Dict[str, Any]],
        difficulty: str = "medium",
        target_vocabulary: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Mask target keywords in transcript segments based on difficulty.

        Args:
            segments: List of segment dictionaries with 'text' field.
            difficulty: Difficulty level ('easy', 'medium', 'hard').
            target_vocabulary: Optional list of key words from Step 1 to prioritize for masking.

        Returns:
            List of segments enriched with 'masked_text' and 'blanks'.
        """
        # Determine target mask ratio based on difficulty
        target_ratio = 0.20 if difficulty == "easy" else (0.30 if difficulty == "medium" else 0.40)
        min_length = 4 if difficulty == "easy" else (3 if difficulty == "medium" else 2)

        target_vocab_set = (
            {v.lower().strip() for v in target_vocabulary if v}
            if target_vocabulary
            else set()
        )

        enriched_segments = []

        for segment in segments:
            text = segment.get("text", "")
            words = text.split()

            # Identify eligible words and prioritize target vocabulary words
            priority_indices = []
            other_indices = []

            for idx, word in enumerate(words):
                clean_word = re.sub(r"[^\w]", "", word).lower()
                if len(clean_word) >= min_length and clean_word not in STOP_WORDS:
                    if clean_word in target_vocab_set:
                        priority_indices.append(idx)
                    else:
                        other_indices.append(idx)

            # Determine number of blanks to create for this segment
            target_count = max(1, int(len(words) * target_ratio))
            
            # Combine prioritized vocabulary matches first, followed by other eligible words
            combined_candidates = priority_indices + [i for i in other_indices if i not in priority_indices]
            selected_indices = sorted(combined_candidates[:target_count]) if combined_candidates else []

            masked_words = list(words)
            blanks = []

            for blank_idx, word_pos in enumerate(selected_indices):
                original_token = words[word_pos]
                # Separate punctuation from clean word
                match = re.match(r"^([^\w]*)([\w]+)([^\w]*)$", original_token)
                if not match:
                    continue

                prefix, target_word, suffix = match.groups()
                hint_str = f"{target_word[0]}{'_' * (len(target_word) - 1)} ({len(target_word)} letters)"

                masked_words[word_pos] = f"{prefix}_____{suffix}"

                blanks.append({
                    "index": blank_idx,
                    "original_word": target_word,
                    "hint": hint_str,
                })

            masked_text = " ".join(masked_words)

            enriched_segments.append({
                **segment,
                "masked_text": masked_text,
                "blanks": blanks,
            })

        return enriched_segments
