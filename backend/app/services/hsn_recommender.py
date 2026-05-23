"""
HSN Recommendation Engine
=========================
Layer 1: TF-IDF lexical search over 21K HSN master rows → top 50 candidates
Layer 2: GPT-4o re-ranking with business context → scored + explained top recommendation
Layer 3: Rules engine → confidence bands AUTO / REVIEW / NEEDS_REVIEW

Source of truth: HSN_SAC.xlsx, first sheet (HSN_MSTR) only.
"""

import os
import json
import re
import logging
from functools import lru_cache
from typing import Optional
from pathlib import Path

import openpyxl
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from openai import OpenAI
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models import models

logger = logging.getLogger(__name__)

# ─── Config ──────────────────────────────────────────────────────────────────

HSN_XLSX_PATH = Path(__file__).parents[3] / "HSN" / "HSN_SAC.xlsx"
CANDIDATE_COUNT = 50          # How many TF-IDF candidates to pass to GPT-4o
AUTO_THRESHOLD = 0.85         # ≥ 85% → AUTO
REVIEW_THRESHOLD = 0.65       # 65–84% → REVIEW, < 65% → NEEDS_REVIEW

client = OpenAI(api_key=settings.OPENAI_API_KEY)

# ─── Text normalisation ───────────────────────────────────────────────────────

SYNONYM_MAP = {
    r"\bups\b": "power backup uninterruptible",
    r"\bcartridge\b": "printer consumable cartridge",
    r"\btoner\b": "printer toner consumable",
    r"\bchair\b": "office seating chair furniture",
    r"\bdesk\b": "office desk furniture",
    r"\bac\b": "air conditioner cooling",
    r"\bhrdd\b": "hard disk drive storage",
    r"\bssd\b": "solid state drive storage",
    r"\blaptop\b": "laptop portable computer",
    r"\bpc\b": "personal computer desktop",
    r"\bmonitor\b": "computer monitor display screen",
    r"\bstationery\b": "office stationery paper supplies",
    r"\bpaper\b": "paper office supplies",
    r"\bpen\b": "writing instrument pen stationery",
    r"\bswitch\b": "network switch ethernet hardware",
    r"\brouter\b": "network router hardware",
    r"\bservices?\b": "service professional fees",
    r"\bcatering\b": "food catering service",
    r"\belectric\b": "electrical electrical items",
}

def normalize_text(text: str) -> str:
    """Lowercase, remove punctuation, expand synonyms."""
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    for pattern, replacement in SYNONYM_MAP.items():
        text = re.sub(pattern, replacement, text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ─── HSN Master Loading & Index ───────────────────────────────────────────────

_hsn_index_cache: Optional[dict] = None

def load_hsn_master() -> dict:
    """
    Load HSN_MSTR (first sheet) from HSN_SAC.xlsx.
    Returns dict with keys: hsn_codes, descriptions, normalized_descriptions.
    Cached in memory after first load.
    """
    global _hsn_index_cache
    if _hsn_index_cache is not None:
        return _hsn_index_cache

    logger.info(f"[HSN] Loading HSN master from {HSN_XLSX_PATH}")
    wb = openpyxl.load_workbook(HSN_XLSX_PATH, read_only=True, data_only=True)
    ws = wb.worksheets[0]  # First sheet only

    hsn_codes = []
    descriptions = []
    normalized = []

    header_skipped = False
    for row in ws.iter_rows(values_only=True):
        if not header_skipped:
            header_skipped = True
            continue
        code = str(row[0]).strip() if row[0] else ""
        desc = str(row[1]).strip() if row[1] else ""
        if code and desc:
            hsn_codes.append(code)
            descriptions.append(desc)
            normalized.append(normalize_text(desc))

    wb.close()

    logger.info(f"[HSN] Loaded {len(hsn_codes)} HSN codes. Building TF-IDF index...")

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 3),
        min_df=1,
        max_features=50000,
        sublinear_tf=True,
    )
    tfidf_matrix = vectorizer.fit_transform(normalized)

    _hsn_index_cache = {
        "hsn_codes": hsn_codes,
        "descriptions": descriptions,
        "normalized": normalized,
        "vectorizer": vectorizer,
        "tfidf_matrix": tfidf_matrix,
    }
    logger.info("[HSN] TF-IDF index built and cached.")
    return _hsn_index_cache


def get_candidates(query: str, top_n: int = CANDIDATE_COUNT) -> list[dict]:
    """
    Use TF-IDF cosine similarity to retrieve top_n HSN candidates.
    Returns list of {hsn_cd, description, score}.
    """
    idx = load_hsn_master()
    normalized_query = normalize_text(query)
    if not normalized_query:
        return []

    query_vec = idx["vectorizer"].transform([normalized_query])
    scores = cosine_similarity(query_vec, idx["tfidf_matrix"]).flatten()
    top_indices = np.argsort(scores)[::-1][:top_n]

    candidates = []
    for i in top_indices:
        if scores[i] > 0.01:  # discard zero-match candidates
            candidates.append({
                "hsn_cd": idx["hsn_codes"][i],
                "description": idx["descriptions"][i],
                "score": round(float(scores[i]), 4),
            })
    return candidates


# ─── GPT-4o Re-ranker ─────────────────────────────────────────────────────────

RERANK_PROMPT = """You are an expert Indian GST and Customs HSN classification specialist.

You will be given a purchase item description and a list of candidate HSN codes retrieved from the official HSN master.
Your job is to identify the BEST matching HSN code for the item.

Rules:
- Prefer the MOST SPECIFIC HSN (8-digit > 6-digit > 4-digit > 2-digit)
- Use product category, vendor context, and business use to disambiguate
- If the item is clearly a SERVICE, note that and pick the closest goods HSN if one exists
- If the best match is weak or ambiguous, reflect that in the confidence score

Respond with ONLY a valid JSON object in this exact format:
{
  "recommended_hsn": "string",
  "recommended_description": "string",
  "confidence": float between 0.0 and 1.0,
  "reasoning": "one concise sentence explaining the match",
  "alternatives": [
    {"hsn_cd": "string", "description": "string", "score": float},
    {"hsn_cd": "string", "description": "string", "score": float},
    {"hsn_cd": "string", "description": "string", "score": float}
  ]
}"""


def rerank_with_ai(item_description: str, vendor_name: str, candidates: list[dict]) -> dict:
    """Send top candidates to GPT-4o for re-ranking with business context."""
    candidates_text = "\n".join(
        f"  HSN {c['hsn_cd']}: {c['description']} (tfidf_score={c['score']})"
        for c in candidates[:30]  # limit to top 30 to stay within context
    )

    user_msg = f"""Item to classify:
- Description: {item_description}
- Vendor: {vendor_name or 'Unknown'}

Top HSN candidates from official master:
{candidates_text}

Return the best HSN classification as JSON."""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": RERANK_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.0,
    )
    return json.loads(response.choices[0].message.content)


# ─── Rules Engine ─────────────────────────────────────────────────────────────

def apply_rules(ai_result: dict, item_description: str) -> dict:
    """
    Post-AI rules to assign confidence band status.
    Returns enriched result dict with 'status' field added.
    """
    confidence = ai_result.get("confidence", 0.0)
    reasoning = ai_result.get("reasoning", "")
    desc_len = len(item_description.strip().split())

    # Rules
    if desc_len <= 2:
        ai_result["status"] = "NEEDS_REVIEW"
        ai_result["reasoning"] = f"Insufficient detail ('{item_description}'). Manual review required."
        ai_result["confidence"] = min(confidence, 0.40)
    elif confidence >= AUTO_THRESHOLD:
        ai_result["status"] = "AUTO"
    elif confidence >= REVIEW_THRESHOLD:
        ai_result["status"] = "REVIEW"
    else:
        ai_result["status"] = "NEEDS_REVIEW"

    # If top 2 alternatives have similar scores → ambiguous
    alts = ai_result.get("alternatives", [])
    if len(alts) >= 1 and alts[0].get("score", 0) >= confidence - 0.05:
        if ai_result["status"] == "AUTO":
            ai_result["status"] = "REVIEW"
            ai_result["reasoning"] = f"Ambiguous: top alternatives are close. {reasoning}"

    return ai_result


# ─── Main Entry Point ─────────────────────────────────────────────────────────

def get_recommendation(item_description: str, vendor_name: str) -> dict:
    """
    Full pipeline: TF-IDF → GPT-4o → Rules.
    Returns recommendation dict ready to persist.
    """
    if not item_description or len(item_description.strip()) < 2:
        return {
            "recommended_hsn": None,
            "recommended_description": None,
            "confidence": 0.0,
            "status": "NEEDS_REVIEW",
            "reasoning": "No item description available.",
            "alternatives": [],
        }

    candidates = get_candidates(item_description)
    if not candidates:
        return {
            "recommended_hsn": None,
            "recommended_description": None,
            "confidence": 0.0,
            "status": "NEEDS_REVIEW",
            "reasoning": "No matching HSN candidates found in master.",
            "alternatives": [],
        }

    ai_result = rerank_with_ai(item_description, vendor_name, candidates)
    final = apply_rules(ai_result, item_description)
    return final


def generate_recommendations_for_engagement(engagement_id: int, db: Session):
    """
    Generate HSN recommendations for all files in an engagement that have
    a missing or empty HSN code. Persists results to hsn_recommendations table.
    """
    # Get all files in engagement with missing HSN
    from sqlalchemy import and_

    results = (
        db.query(models.UploadedFile, models.ExtractedInvoice)
        .join(models.ExtractedInvoice, models.ExtractedInvoice.file_id == models.UploadedFile.id)
        .filter(
            models.UploadedFile.engagement_id == engagement_id,
            models.UploadedFile.status == "extracted",
        )
        .filter(
            (models.ExtractedInvoice.hsn_code == None) |
            (models.ExtractedInvoice.hsn_code == "") |
            (models.ExtractedInvoice.hsn_code == "None") |
            (models.ExtractedInvoice.hsn_code == "null") |
            (models.ExtractedInvoice.hsn_code == "missing") |
            (models.ExtractedInvoice.hsn_code == "0000")
        )
        .all()
    )

    logger.info(f"[HSN] Running recommendations for {len(results)} missing-HSN invoices in engagement {engagement_id}")

    for file, invoice in results:
        # Build the best item description available
        description_parts = []
        if getattr(invoice, "description_of_goods", None):
            description_parts.append(invoice.description_of_goods)
        
        if invoice.vendor_name:
            description_parts.append(invoice.vendor_name)
        if invoice.invoice_number:
            description_parts.append(invoice.invoice_number)
            
        item_description = " - ".join(description_parts) if description_parts else "Unknown"

        logger.info(f"[HSN] Processing file_id={file.id}, description='{item_description}'")

        try:
            rec = get_recommendation(item_description, invoice.vendor_name or "")

            # Upsert: delete old recommendation for this file if exists
            db.query(models.HsnRecommendation).filter(
                models.HsnRecommendation.file_id == file.id
            ).delete(synchronize_session=False)

            db_rec = models.HsnRecommendation(
                file_id=file.id,
                engagement_id=engagement_id,
                item_description=item_description,
                recommended_hsn=rec.get("recommended_hsn"),
                recommended_hsn_description=rec.get("recommended_description"),
                confidence_score=rec.get("confidence", 0.0),
                status=rec.get("status", "NEEDS_REVIEW"),
                top_alternatives=json.dumps(rec.get("alternatives", [])),
                reasoning=rec.get("reasoning", ""),
            )
            db.add(db_rec)
            db.commit()
            logger.info(f"[HSN] Saved recommendation for file_id={file.id}: HSN={rec.get('recommended_hsn')}, status={rec.get('status')}")

        except Exception as e:
            logger.error(f"[HSN] Error processing file_id={file.id}: {e}")
            db.rollback()
            continue
