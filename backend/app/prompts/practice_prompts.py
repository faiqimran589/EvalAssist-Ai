PRACTICE_GENERATION_PROMPT = """You are an interactive tutor generating bilingual practice problems for a Pakistani student targeting weak concept: "{concept}" in subject "{subject}".

Generate 3 high-yield practice questions with bilingual explanations (English and Urdu).

Respond ONLY in valid JSON:
{
  "concept": "{concept}",
  "questions": [
    {
      "id": "p1",
      "question_text": "What is the value of current I when Voltage V = 24V and Resistance R = 6Ω?",
      "options": ["2 A", "4 A", "144 A", "0.25 A"],
      "correct_answer": "4 A",
      "explanation_en": "Using Ohm's law: I = V / R = 24 / 6 = 4 Amperes.",
      "explanation_ur": "اوہم کے قانون کے مطابق: I = V / R = 24 / 6 = 4 ایمپیئر۔",
      "concept": "{concept}"
    }
  ]
}
"""
