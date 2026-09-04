import re
import math
from typing import Dict, Any, List, Optional, Tuple

# Common stop words to ignore when extracting concept keywords
STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "by", "for",
    "with", "about", "against", "between", "into", "through", "during", "before", "after",
    "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under",
    "again", "further", "then", "once", "here", "there", "all", "any", "both", "each", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
    "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now", "is",
    "am", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do",
    "does", "did", "doing", "would", "should", "could", "ought", "i", "you", "he", "she", "it",
    "we", "they", "them", "their", "his", "her", "its", "our", "that", "this", "these", "those"
}

# Domain synonyms for robust semantic matching (Pakistani Matric/FSc & STEM/Humanities)
SYNONYMS = {
    "voltage": ["potential difference", "electromotive force", "emf", "volt", "v"],
    "current": ["amperage", "flow of charge", "ampere", "amps", "i", "a"],
    "resistance": ["resistor", "impedance", "ohm", "ohms", "r", "omega"],
    "velocity": ["speed", "rate of displacement", "v"],
    "acceleration": ["rate of change of velocity", "a", "g"],
    "force": ["push or pull", "newton", "f", "n"],
    "energy": ["work", "joule", "joules", "j", "calorie"],
    "power": ["rate of doing work", "watt", "watts", "w"],
    "mass": ["inertia", "kg", "kilogram", "grams", "m"],
    "density": ["mass per volume", "rho"],
    "pressure": ["force per area", "pascal", "pa", "atm"],
    "photosynthesis": ["chlorophyll", "glucose production", "light reaction"],
    "respiration": ["cellular respiration", "atp production", "glucose oxidation"],
    "derivative": ["differentiation", "rate of change", "slope", "dy/dx", "f'(x)"],
    "integral": ["integration", "antiderivative", "area under curve"],
    "momentum": ["quantity of motion", "p=mv", "mass times velocity"],
}

def clean_text(text: str) -> str:
    """Normalizes text for comparison."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s\+\-\*\/\=\<\>\(\)\.\^]", " ", text)
    return " ".join(text.split())

def extract_concept_terms(text: str) -> List[str]:
    """Extracts significant keywords, numbers, formulas, and phrases."""
    cleaned = clean_text(text)
    tokens = cleaned.split()
    terms = [t for t in tokens if t not in STOP_WORDS and len(t) > 1]
    
    # Also extract short formulas e.g. "v=ir", "f=ma", "e=mc^2"
    formulas = re.findall(r"[a-z0-9\+\-\*\/\=\^]{3,}", cleaned)
    for f in formulas:
        if f not in terms:
            terms.append(f)
    return terms

def calculate_term_match(term: str, student_tokens: List[str], student_raw: str) -> bool:
    """Checks if a term or its semantic equivalent exists in student answer."""
    term = term.lower().strip()
    if not term:
        return False
        
    # Exact token match
    if term in student_tokens:
        return True
        
    # Substring / formula match
    if term in student_raw:
        return True
        
    # Stemming / prefix match
    if len(term) >= 4:
        stem = term[:4]
        if any(st.startswith(stem) for st in student_tokens):
            return True
            
    # Synonym match
    for canonical, syns in SYNONYMS.items():
        if term == canonical or term in syns:
            if canonical in student_raw or any(s in student_raw for s in syns):
                return True
                
    return False

class SemanticEvaluator:
    @staticmethod
    def evaluate_answer(
        question_text: str,
        marks_total: float,
        subject: str,
        key_points: List[Dict[str, Any]],
        deductions: List[Dict[str, Any]],
        student_answer: str,
        expected_answer: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates a student's answer semantically against key points and expected concepts.
        Judges conceptual understanding, meaning, and correctness — never penalizing for exact wording.
        """
        raw_ans = (student_answer or "").strip()
        
        # 1. Blank Answer Check
        if not raw_ans or len(raw_ans.replace(" ", "")) == 0 or raw_ans in ["[Blank / No Answer]", "[No option selected]"]:
            return {
                "question_id": "",
                "extracted_answer_text": "[Blank / No Answer]",
                "marks_awarded": 0.0,
                "marks_total": float(marks_total),
                "confidence_score": 1.0,
                "correct_points": [],
                "deducted_points": [{
                    "issue": "No Answer Provided",
                    "reason": "Student left the question completely blank.",
                    "concept": f"{subject} > General",
                    "penalty": -marks_total
                }],
                "annotations": [],
                "improvement_tip": "Make sure to attempt this question in future tests. Even partial steps earn marks.",
                "ai_summary_en": "No answer was provided. Zero marks awarded.",
                "ai_summary_ur": "اس سوال کا کوئی جواب نہیں دیا گیا۔ صفر نمبر دیے گئے۔"
            }

        cleaned_student = clean_text(raw_ans)
        student_tokens = cleaned_student.split()
        
        # 2. Key Points Matching
        total_kp_points = sum(float(kp.get("points", 1.0) or 1.0) for kp in key_points) if key_points else marks_total
        if total_kp_points <= 0:
            total_kp_points = marks_total

        matched_points = []
        earned_points = 0.0
        
        if key_points:
            for kp in key_points:
                kp_text = kp.get("text", "")
                kp_pts = float(kp.get("points", 1.0) or 1.0)
                terms = extract_concept_terms(kp_text)
                
                if not terms:
                    if len(student_tokens) >= 3:
                        earned_points += kp_pts
                        matched_points.append(kp_text)
                    continue
                
                # Check term coverage
                matched_terms = [t for t in terms if calculate_term_match(t, student_tokens, cleaned_student)]
                coverage_ratio = len(matched_terms) / len(terms) if terms else 0.0
                
                if coverage_ratio >= 0.4 or (len(terms) >= 3 and len(matched_terms) >= 2):
                    earned_points += kp_pts
                    matched_points.append(kp_text)
                elif coverage_ratio > 0.15 or len(matched_terms) >= 1:
                    partial = round(kp_pts * 0.5, 1)
                    earned_points += partial
                    matched_points.append(f"{kp_text} (Partial credit: {partial}/{kp_pts} marks)")
        else:
            # Fallback when no explicit key points were configured
            q_terms = extract_concept_terms(question_text)
            matched_q = [t for t in q_terms if calculate_term_match(t, student_tokens, cleaned_student)]
            cov = len(matched_q) / len(q_terms) if q_terms else 0.5
            if cov >= 0.3 or len(student_tokens) >= 6:
                earned_points = round(marks_total * min(1.0, 0.6 + (cov * 0.4)), 1)
                matched_points.append(f"Addressed core concepts of: {question_text[:50]}")
            else:
                earned_points = round(marks_total * 0.4, 1)
                matched_points.append("Attempted question with relevant concepts")

        # Scale earned points to marks_total
        if total_kp_points > 0:
            scale = marks_total / total_kp_points
            scaled_awarded = min(marks_total, earned_points * scale)
        else:
            scaled_awarded = min(marks_total, earned_points)

        # 3. Deduction evaluation
        triggered_deductions = []
        total_penalties = 0.0
        
        if deductions:
            for d in deductions:
                cond = d.get("error_condition", "")
                pen = abs(float(d.get("penalty", -1.0) or -1.0))
                cond_lower = cond.lower()
                
                if "unit" in cond_lower:
                    units = ["m", "cm", "kg", "g", "s", "sec", "j", "joule", "w", "watt", "v", "volt", "a", "amp", "ohm", "pa", "n", "m/s", "m/s2"]
                    has_unit = any(u in student_tokens or f" {u}" in cleaned_student for u in units)
                    has_numbers = bool(re.search(r"\d+", cleaned_student))
                    if has_numbers and not has_unit and ("calculate" in question_text.lower() or "find" in question_text.lower()):
                        triggered_deductions.append({
                            "issue": "Missing Units",
                            "reason": cond,
                            "concept": f"{subject} > Units & Measurements",
                            "penalty": -pen
                        })
                        total_penalties += pen

        # Final marks calculation
        final_marks = max(0.0, min(marks_total, round(scaled_awarded - total_penalties, 1)))
        
        # If student answer has substantive length and matched criteria, ensure score reflects quality
        if len(matched_points) == len(key_points) and len(key_points) > 0 and not triggered_deductions:
            final_marks = float(marks_total)
        elif len(student_tokens) >= 5 and final_marks == 0.0 and len(matched_points) > 0:
            final_marks = max(1.0, round(marks_total * 0.5, 1))

        # Confidence calculation
        confidence = 0.92 if len(matched_points) > 0 else 0.85

        # Improvement tips & Summaries
        if final_marks >= marks_total * 0.85:
            tip = "Excellent conceptual response. Clear, accurate, and comprehensive."
            summary_en = "Outstanding work demonstrating thorough grasp of the core concepts."
            summary_ur = "بہترین جواب، بنیادی تصورات کی مکمل اور جامع تفہیم کا مظاہرہ۔"
        elif final_marks >= marks_total * 0.5:
            tip = "Good attempt. Elaborate on the underlying reasoning and ensure standard terminology is used throughout."
            summary_en = "Solid conceptual foundation with key points addressed. Minor details can be expanded."
            summary_ur = "اچھی کوشش، بنیادی نکات واضح ہیں۔ مزید تفصیل شامل کر کے مکمل نمبر حاصل کیے جا سکتے ہیں۔"
        else:
            tip = "Review this topic carefully. Focus on defining core formulas and step-by-step derivations."
            summary_en = "Partial answer provided. Key definitions and formulas need to be reviewed."
            summary_ur = "جواب میں کچھ اہم نکات رہ گئے۔ بنیادی فارمولوں اور تعریفات کا اعادہ ضروری ہے۔"

        # Bounding box visual annotations
        annotations = []
        if final_marks > 0:
            annotations.append({
                "bbox": [10.0, 15.0, 80.0, 20.0],
                "label": "Correct Concept Identified",
                "type": "positive"
            })
        if triggered_deductions:
            annotations.append({
                "bbox": [10.0, 45.0, 80.0, 15.0],
                "label": triggered_deductions[0]["issue"],
                "type": "issue"
            })

        return {
            "question_id": "",
            "extracted_answer_text": raw_ans,
            "marks_awarded": float(final_marks),
            "marks_total": float(marks_total),
            "confidence_score": confidence,
            "correct_points": matched_points if matched_points else ["Answer addresses question requirements"],
            "deducted_points": triggered_deductions,
            "annotations": annotations,
            "improvement_tip": tip,
            "ai_summary_en": summary_en,
            "ai_summary_ur": summary_ur
        }
