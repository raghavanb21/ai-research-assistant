import json
import logging
import re
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from google import genai
from google.genai import types

from app.config import settings
from app.models.paper import Paper, Summary, QAMessage

logger = logging.getLogger(__name__)

# Candidate free-tier models in order of priority
CANDIDATE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
]

class LLMService:
    """Service for generating LLM-powered paper summaries and answering natural-language questions."""

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self._client = None
        if self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Google GenAI Client: {e}")

    @property
    def is_configured(self) -> bool:
        return bool(self._client and self.api_key)

    def _get_paper_context(self, paper: Paper) -> Tuple[str, str]:
        """
        Builds the paper context payload from available content (full text or abstract + metadata).
        Returns a tuple of (context_string, context_type).
        """
        authors_str = ", ".join(paper.authors) if paper.authors else "Unknown Authors"
        year_str = str(paper.publication_year) if paper.publication_year else "N/A"
        
        has_full_text = bool(paper.full_text and len(paper.full_text.strip()) > 100)
        
        if has_full_text:
            # Full text extracted from PDF
            # Truncate if exceptionally long (> 50k chars) to preserve low latency and high quality
            full_text_content = paper.full_text.strip()
            if len(full_text_content) > 50000:
                full_text_content = full_text_content[:50000] + "\n\n[... Remaining content truncated for summary context ...]"
            
            context = (
                f"PAPER TITLE: {paper.title}\n"
                f"AUTHORS: {authors_str}\n"
                f"PUBLICATION YEAR: {year_str}\n"
                f"SOURCE: {paper.source} (Full PDF Document Text)\n\n"
                f"--- ABSTRACT ---\n{paper.abstract or 'N/A'}\n\n"
                f"--- EXTRACTED PAPER FULL TEXT ---\n{full_text_content}"
            )
            return context, "full_text"
        else:
            # Metadata and abstract from search
            abstract_content = paper.abstract or "No abstract provided in academic index."
            context = (
                f"PAPER TITLE: {paper.title}\n"
                f"AUTHORS: {authors_str}\n"
                f"PUBLICATION YEAR: {year_str}\n"
                f"SOURCE: {paper.source}\n"
                f"ARXIV ID: {paper.arxiv_id or 'N/A'}\n"
                f"DOI: {paper.doi or 'N/A'}\n\n"
                f"--- PAPER ABSTRACT AND CONTENT ---\n{abstract_content}"
            )
            return context, "abstract"

    def _call_gemini_resilient(self, prompt: str, system_instruction: Optional[str] = None) -> Tuple[str, str]:
        """
        Calls Gemini with a resilient fallback chain over candidate models.
        Returns tuple of (response_text, model_used).
        """
        if not self.is_configured:
            raise ValueError("Gemini API key is not configured in backend/.env")

        last_error = None
        for model_name in CANDIDATE_MODELS:
            try:
                config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,
                    top_p=0.95,
                ) if system_instruction else types.GenerateContentConfig(
                    temperature=0.3,
                    top_p=0.95,
                )
                
                # response = self._client.models.generate_content(
                #     model=model_name,
                #     contents=prompt,
                #     config=config
                # )

                chat = self._client.chats.create(
                    model=model_name,
                    config=config,
                )

                response = chat.send_message(prompt)
                
                if response and response.text:
                    return response.text.strip(), model_name
            except Exception as e:
                logger.warning(f"Model {model_name} failed: {e}. Trying next fallback model...")
                last_error = e
                continue

        raise RuntimeError(f"All candidate Gemini models failed. Last error: {last_error}")

    def generate_summary(self, paper: Paper, db: Session, force_regenerate: bool = False) -> Summary:
        """
        Generates a comprehensive structured summary for the given paper.
        If a cached summary exists and force_regenerate is False, returns the cached summary.
        """
        if not force_regenerate and paper.summary:
            return paper.summary

        context, context_type = self._get_paper_context(paper)

        system_prompt = (
            "You are an expert AI academic research assistant. "
            "Your task is to analyze research papers and produce rigorous, clear, and comprehensive structured summaries. "
            "Base your summary strictly on the paper's actual text and abstract content. "
            "Do not hallucinate details not supported by the text."
        )

        user_prompt = f"""
Analyze the following research paper and generate a structured summary in valid JSON format.

{context}

Respond ONLY with a valid JSON object matching this schema:
{{
  "summary_text": "Full structured markdown summary with headings (### Core Problem & Objective, ### Key Innovation & Methodology, ### Main Findings & Results, ### Limitations & Future Work)",
  "key_points": [
    "Key takeaway point 1",
    "Key takeaway point 2",
    "Key takeaway point 3",
    "Key takeaway point 4",
    "Key takeaway point 5"
  ]
}}

Guidelines for the summary:
1. Ground every claim directly in the paper's text.
2. In '### Core Problem & Objective', explain what research challenge the authors tackle.
3. In '### Key Innovation & Methodology', describe the core architecture, algorithm, or methodology proposed.
4. In '### Main Findings & Results', detail the experimental results, benchmark comparisons, or key discoveries.
5. In '### Limitations & Future Work', describe constraints, assumptions, or future avenues identified.
6. Provide 4 to 6 punchy, insightful bullet points in 'key_points'.
"""

        raw_response, model_used = self._call_gemini_resilient(user_prompt, system_instruction=system_prompt)

        # Parse JSON from response (handling potential markdown code fences)
        summary_text = ""
        key_points = []
        try:
            clean_json = raw_response
            if "```json" in clean_json:
                clean_json = clean_json.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_json:
                clean_json = clean_json.split("```")[1].split("```")[0].strip()

            parsed = json.loads(clean_json)
            summary_text = parsed.get("summary_text", "").strip()
            key_points = parsed.get("key_points", [])
        except Exception as parse_err:
            logger.warning(f"Failed to parse structured JSON from LLM: {parse_err}. Using raw markdown output.")
            summary_text = raw_response
            # Extract bullet points if any
            bullets = [line.lstrip("*- ").strip() for line in raw_response.splitlines() if line.strip().startswith(("-", "*"))]
            key_points = bullets[:5] if bullets else ["Comprehensive summary generated from paper content."]

        # Update or create Summary in database
        if paper.summary:
            summary = paper.summary
            summary.summary_text = summary_text
            summary.key_points = key_points
            summary.model_used = model_used
        else:
            summary = Summary(
                paper_id=paper.id,
                summary_text=summary_text,
                model_used=model_used
            )
            summary.key_points = key_points
            db.add(summary)

        db.commit()
        db.refresh(summary)
        return summary

    def answer_question(self, paper: Paper, question: str, db: Session) -> QAMessage:
        """
        Answers a natural-language question about a selected paper grounded strictly in its content.
        Maintains conversational history in SQLite.
        """
        context, context_type = self._get_paper_context(paper)

        # Retrieve previous conversation messages for this paper
        history_messages = (
            db.query(QAMessage)
            .filter(QAMessage.paper_id == paper.id)
            .order_by(QAMessage.created_at.asc())
            .all()
        )

        # Build conversation history context
        history_text = ""
        if history_messages:
            history_text = "\n\n--- PREVIOUS CONVERSATION HISTORY ---\n"
            for msg in history_messages[-6:]:  # Keep last 6 messages for context
                role_label = "User" if msg.role == "user" else "Assistant"
                history_text += f"{role_label}: {msg.message}\n"

        system_prompt = (
            "You are an expert AI research assistant analyzing academic research papers. "
            "Your objective is to answer user questions about the selected paper with high precision, depth, and clarity. "
            "STRICT GROUNDING RULES:\n"
            "1. Ground all answers strictly in the provided paper context (paper title, authors, abstract, and text).\n"
            "2. If the paper does NOT provide sufficient information or does not mention what the user is asking (e.g. specific datasets, baselines, hyperparameters, or ablation studies not discussed), explicitly state that the paper does not contain or mention this information rather than guessing or hallucinating.\n"
            "3. Structure your response with clean Markdown (bullet points, bold headers, clear paragraphs).\n"
            "4. Be direct, authoritative, and helpful to a researcher."
        )

        user_prompt = f"""
{context}
{history_text}

--- CURRENT USER QUESTION ---
{question}

Please provide a well-structured, accurate answer grounded strictly in the paper above:
"""

        answer_text, model_used = self._call_gemini_resilient(user_prompt, system_instruction=system_prompt)

        # Save user question to database
        user_msg = QAMessage(
            paper_id=paper.id,
            role="user",
            message=question,
            context_used=context_type
        )
        db.add(user_msg)

        # Save assistant answer to database
        assistant_msg = QAMessage(
            paper_id=paper.id,
            role="assistant",
            message=answer_text,
            context_used=f"{context_type}:{model_used}"
        )
        db.add(assistant_msg)

        db.commit()
        db.refresh(assistant_msg)
        return assistant_msg

    def get_summary(self, paper_id: int, db: Session) -> Optional[Summary]:
        """Retrieves cached summary if available."""
        return db.query(Summary).filter(Summary.paper_id == paper_id).first()

    def get_qa_history(self, paper_id: int, db: Session) -> List[QAMessage]:
        """Retrieves all Q&A messages for a paper in chronological order."""
        return (
            db.query(QAMessage)
            .filter(QAMessage.paper_id == paper_id)
            .order_by(QAMessage.created_at.asc())
            .all()
        )

    def clear_qa_history(self, paper_id: int, db: Session) -> int:
        """Deletes all Q&A messages for a paper."""
        deleted_count = (
            db.query(QAMessage)
            .filter(QAMessage.paper_id == paper_id)
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted_count


llm_service = LLMService()
