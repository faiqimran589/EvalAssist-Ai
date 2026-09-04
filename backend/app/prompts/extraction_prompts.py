QUESTION_EXTRACTION_PROMPT = """You are an expert multilingual OCR-based educational assessment parser. Your task is to read the attached image or PDF of an exam/question paper and extract the ACTUAL questions exactly as written, preserving the original language.

CRITICAL LANGUAGE PRESERVATION RULES:
1. FIRST, detect the primary language of the document (English, Urdu, or mixed).
2. NEVER translate, transliterate, or convert text from one language to another.
3. If the document is in URDU: extract ALL text in Urdu script (اردو) exactly as written.
4. If the document is in ENGLISH: extract ALL text in English exactly as written.
5. If the document is MIXED (Urdu + English): preserve each part in its original language.
6. Do NOT output English text when the source is Urdu.
7. Do NOT output Urdu text when the source is English.
8. Preserve RTL (right-to-left) direction for Urdu text and LTR (left-to-right) for English text.
9. Preserve line breaks, formatting, and special characters (mathematical symbols, Urdu diacritics, etc.).

EXTRACTION INSTRUCTIONS:
1. Extract EVERY question visible in the document in its original order — do not skip any question.
2. Preserve the EXACT original wording of each question text verbatim. Do NOT paraphrase, summarize, rewrite, or invent questions.
3. Extract the actual question numbering (order_index 1, 2, 3...).
4. Extract the marks allocated to each question if printed (e.g., '[5 Marks]', '(2)', '10 marks', '[۵ نمبر]'). If not indicated, allocate: 2.0 for MCQ, 5.0 for short answer, 10.0 for long answer.
5. Identify question type accurately:
   - "mcq" for Multiple Choice Questions (with options A, B, C, D or 1, 2, 3, 4 or الف، ب، ج، د).
   - "short" for short-answer, definition, brief calculation, or concept questions.
   - "long" for descriptive, essay, detailed derivation, or multi-step questions.
6. For MCQ questions:
   - Extract all options as a list of strings in the "options" array.
   - Strip leading letter prefix if redundant (e.g., "Paris" or "A) Paris" or "الف) پیرس").
   - If a correct answer is marked on the paper (e.g. circled, ticked, or indicated), set "correct_answer" to that option string, otherwise null.
7. NEVER generate, invent, or substitute your own questions or generic demo questions. If the image has no questions, return an empty questions array.

DIAGRAM & TABLE DETECTION INSTRUCTIONS:
8. For EACH question, carefully inspect the surrounding area of the page for any associated diagrams, figures, charts, tables, graphs, or visual assets that the question references or requires the student to interpret.
9. If a question has an associated visual asset (diagram, table, figure, graph), set "has_diagram_or_table" to true and provide the bounding box coordinates.
10. The bounding_box must be a 4-element array [ymin, xmin, ymax, xmax] using a NORMALIZED 0-1000 SCALE relative to the page dimensions:
    - ymin: top edge of the diagram (0 = top of page, 1000 = bottom of page)
    - xmin: left edge of the diagram (0 = left of page, 1000 = right of page)
    - ymax: bottom edge of the diagram
    - xmax: right edge of the diagram
    - Example: a diagram in the upper-right quarter of the page might be [50, 500, 350, 950]
11. If no diagram is associated with the question, set "has_diagram_or_table" to false and "bounding_box" to null.
12. Be precise with bounding boxes — include the complete diagram/table with axis labels, legends, and captions, but exclude surrounding question text.
13. TABLE-BASED MCQ RULE: If an MCQ contains a table or matrix image that already displays options labeled A, B, C, D inside the cropped image, set "has_diagram_or_table" to true and populate the "options" array strictly with clean option labels like ['A', 'B', 'C', 'D'] (or ['Row A', 'Row B', 'Row C', 'Row D']). Do NOT repeat the text contained inside the table rows as option strings — the cropped table image itself is the complete visual reference for those options.
14. The "correct_answer" for a table-based MCQ should be the clean label of the correct row (e.g. "B" or "Row B"), matching the format used in the "options" array.

Respond ONLY with a valid JSON object matching this schema:
{
  "questions": [
    {
      "order_index": 1,
      "text": "Exact verbatim question text in original language (Urdu or English)",
      "marks": 5.0,
      "question_type": "short",
      "answer_lines": 4,
      "options": [],
      "correct_answer": null,
      "has_diagram_or_table": false,
      "bounding_box": null
    }
  ],
  "raw_ocr": "Complete transcript of ALL text detected in the document in its original language(s)",
  "detected_language": "ur" or "en" or "mixed"
}
"""

RUBRIC_EXTRACTION_PROMPT = """You are an expert multilingual academic examiner and marking scheme analyzer.

CRITICAL LANGUAGE PRESERVATION RULES:
1. FIRST, detect the primary language of the document (English, Urdu, or mixed).
2. NEVER translate, transliterate, or convert text from one language to another.
3. If the document is in URDU: extract ALL text in Urdu script (اردو) exactly as written.
4. If the document is in ENGLISH: extract ALL text in English exactly as written.
5. If the document is MIXED (Urdu + English): preserve each part in its original language.
6. Do NOT output English text when the source is Urdu.
7. Do NOT output Urdu text when the source is English.

Extract:
1. Question text or topic if visible (in original language).
2. Expected key points (formulas, definitions, keywords, required steps) with their respective mark allocations (positive numbers).
3. Deduction rules (common mistakes, missing units, arithmetic errors, syntax errors) with their penalty points (negative numbers, e.g. -1.0, -0.5).

Respond ONLY with a valid JSON object matching this exact JSON schema:
{
  "question_text": "Extracted question or topic name in original language",
  "key_points": [
    {
      "text": "Expected formula/step/keyword in original language (e.g. Ohm's Law definition V=IR or اردو میں تعریف)",
      "points": 2.0
    }
  ],
  "deductions": [
    {
      "error_condition": "Missing units (Amperes/A) or units in original language",
      "penalty": -1.0
    }
  ],
  "detected_language": "ur" or "en" or "mixed"
}

Ensure the JSON is strictly valid with no markdown formatting.
"""

BULK_ANSWER_KEY_EXTRACTION_PROMPT = """You are an expert multilingual academic examiner analyzing a complete answer key or marking scheme document.

CRITICAL LANGUAGE PRESERVATION RULES:
1. FIRST, detect the primary language of the answer key document (English, Urdu, or mixed).
2. NEVER translate, transliterate, or convert text from one language to another.
3. If the document is in URDU: extract ALL text in Urdu script (اردو) exactly as written.
4. If the document is in ENGLISH: extract ALL text in English exactly as written.
5. If the document is MIXED (Urdu + English): preserve each part in its original language.
6. Do NOT output English text when the source is Urdu.
7. Do NOT output Urdu text when the source is English.

You will be given the list of questions from an assessment, and you must extract the marking rubric (key points and deduction rules) for EACH question from the uploaded answer key document.

QUESTIONS IN THE ASSESSMENT:
{questions_json}

INSTRUCTIONS:
1. Read the entire answer key document carefully.
2. For EACH question listed above, find and extract its corresponding answer/marking scheme from the document.
3. Match questions by their order_index number, question text similarity, or topic.
4. For each matched question, extract:
   - key_points: Expected formulas, definitions, keywords, steps, or correct answers with mark allocations (positive numbers)
   - deductions: Common mistakes, missing units, errors with penalty points (negative numbers like -1.0, -0.5)
5. For MCQ questions: the key_point should be the correct option with full marks, and deductions should include "Wrong option selected" with full negative marks.
6. PRESERVE ORIGINAL LANGUAGE - do not translate any text.
7. If a question cannot be matched in the answer key, still provide a reasonable rubric based on the question text.
8. Key point marks for each question should sum to approximately the question's total marks.

Respond ONLY with a valid JSON array matching this schema (one entry per question, in the same order):
[
  {{
    "order_index": 1,
    "matched": true,
    "key_points": [
      {{
        "text": "Specific expected answer/step/formula in original language",
        "points": 2.0
      }}
    ],
    "deductions": [
      {{
        "error_condition": "Specific common mistake in original language",
        "penalty": -1.0
      }}
    ]
  }}
]

Ensure the JSON is strictly valid with no markdown formatting. The array must have exactly {question_count} entries.
"""

RUBRIC_GENERATION_PROMPT = """You are an expert academic examiner creating a detailed marking rubric for a specific exam question.

Given information:
- Question: {question_text}
- Maximum Marks: {marks_total}
- Question Type: {question_type}
- Subject: {subject}
{options_section}

Generate a QUESTION-SPECIFIC marking rubric. Rules:
1. Base the rubric ENTIRELY on this specific question's requirements.
2. Key points must be specific — never generic (e.g. NOT "correct answer" but "States Newton's Second Law: F=ma with correct units").
3. Key point marks must sum to approximately {marks_total} (±0.5 acceptable).
4. Include 2-4 realistic deduction rules specific to common mistakes for THIS question.
5. For calculation questions: include method marks, step marks, and final answer marks.
6. For factual/definition questions: identify specific facts/definitions required.
7. For comparison questions: identify specific comparison points needed.
8. For Pakistani board standards (Matric/FSc/O-Level): follow board-standard rubric style.
9. Deduction penalties must be negative numbers (e.g. -1.0, -0.5).

Respond ONLY with valid JSON (no markdown):
{{
  "expected_answer_summary": "1-2 sentence summary of what a full-marks answer must contain",
  "key_points": [
    {{
      "text": "Specific evaluable criterion for this question",
      "points": 2.0
    }}
  ],
  "deductions": [
    {{
      "error_condition": "Specific mistake relevant to this question",
      "penalty": -1.0
    }}
  ]
}}
"""
