<div align="center">

# 🎓 EvalAssist AI

**AI Grading & Personalized Learning Platform**

Turn photos of exam papers into structured questions and rubrics, grade student
answers with AI, and generate personalized growth plans — with bilingual
(English / اردو) support.

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python\&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi\&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js\&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript\&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## ✨ Overview

EvalAssist AI is an educational assessment platform designed to help teachers
create, manage, and grade assessments with less manual effort while giving
students actionable feedback and personalized learning recommendations.

The platform processes exam-paper images, extracts assessment information,
evaluates student answer submissions, and provides performance insights.
Teachers can review assessment results, adjust grades when necessary, and
explore class-level and individual performance.

Students can submit their answers, receive bilingual feedback, and follow
personalized learning paths based on their performance.

## 🚀 Key Features

### For Teachers

* 📸 **Image → Assessment:** Extract questions, rubrics, answer keys, and diagrams
  from exam-paper images or PDFs.
* 🧩 **Assessment Wizard:** Guided multi-step assessment creation workflow.
* 🤖 **AI-assisted grading:** Review grading results, request revisions, and
  override marks when necessary.
* 📊 **Analytics:** Performance matrices, class insights, and student trends.
* 🌱 **Growth plans:** Personalized recommendations based on performance patterns.
* 🔗 **Quick join:** Invite students using a shareable assessment link.

### For Students

* 📝 **Timed attempts:** Assessment sessions with session and activity tracking.
* 🖼️ **Photo submissions:** Submit handwritten answers as images.
* 💬 **Bilingual feedback:** English and اردو feedback with mathematical notation.
* 🧭 **Learning path:** Diagnostic and practice activities focused on weaker
  concepts.

### AI & OCR

* **Vision-based extraction:** Converts exam-paper images into structured
  assessment information.
* **AI reasoning:** Assists with evaluating answers against assessment criteria.
* **Local OCR:** Provides text recognition for supported content.
* **Document processing:** Supports image and PDF-based assessment workflows.

## 🛠️ Tech Stack

| Layer          | Technology                                                 |
| -------------- | ---------------------------------------------------------- |
| Frontend       | Next.js 14, React 18, TypeScript, Tailwind CSS, KaTeX      |
| Backend        | FastAPI, Uvicorn, Pydantic v2, SQLAlchemy                  |
| Database       | SQLite                                                     |
| Authentication | JWT-based authentication + bcrypt password hashing         |
| AI / OCR       | Vision models, LLM-based grading, EasyOCR, PyMuPDF, Pillow |

## 🔐 Security

EvalAssist AI keeps sensitive configuration separate from the public source
code.

* Local environment files must remain private.
* API keys, passwords, tokens, and credentials must never be committed.
* Example configuration files should contain placeholders only.
* Real credentials should never be included in source code or documentation.
* Any credential previously exposed publicly should be revoked or rotated before
  publishing the repository.

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE).

## ⚠️ Disclaimer

EvalAssist AI is an educational project. AI-generated extraction, feedback, and
grading results should always be reviewed by a human before being finalized.
