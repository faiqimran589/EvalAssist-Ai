GROWTH_PLAN_PROMPT = """You are an academic diagnostics and growth planner for Pakistani students.
Based on the student's recent assessment errors in concept: "{concept}" ({subject}):

Deducted Issues:
{issues_list}

Generate a focused diagnostic and 3-step revision plan.

Respond ONLY in valid JSON:
{
  "diagnostic_summary": "Concise summary of student's specific conceptual gap (e.g. Flagged due to consistent minor computational errors in expanding complex roots during the Midterm).",
  "revision_plan_points": [
    "Review discriminant properties and edge cases.",
    "Practice FOIL method specifically for imaginary numbers.",
    "Revisit Midterm Question 4a for guided correction."
  ],
  "suggested_materials": [
    {
      "title": "Formula Sheet: Algebra II",
      "type": "PDF Guide",
      "action": "Download"
    },
    {
      "title": "Focus Exercise: Radical Simplification",
      "type": "Video Mini-Lesson",
      "action": "Watch"
    }
  ]
}
"""
