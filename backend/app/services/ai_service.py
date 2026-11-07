"""
AI/NLP Service — Module 2 of the documented architecture.

FR-01: Understand natural-language DeFi requests.
FR-02: Convert to structured transaction details.

SECURITY ARCHITECTURE (non-negotiable):
The AI produces a DeFiIntent object.
This object is NOT executed.
It MUST pass through the validation service before any blockchain action.
The AI has zero authority over fund movement.
"""

import json
import logging
import asyncio
from typing import Optional

from google import genai
from google.genai import types, errors

from app.config import settings
from app.schemas.intent import DeFiIntent, SupportedOperation

logger = logging.getLogger(__name__)


# ── System prompt for intent extraction ───────────────────────────────────────
# The prompt instructs the model to produce ONLY a strict JSON object.
# It is designed to be explicit about what the model can and cannot do.

INTENT_EXTRACTION_SYSTEM_PROMPT = """You are a DeFi transaction intent parser. Your ONLY job is to extract structured transaction intent from a user's natural language request.

You must respond with ONLY a valid JSON object — no explanation, no preamble, no markdown, no code fences.

The JSON must have this exact structure:
{
  "operation": "transfer" | "swap" | "stake",
  "token_in": "<TOKEN_SYMBOL or null>",
  "token_out": "<TOKEN_SYMBOL or null>",
  "amount": <number or null>,
  "amount_raw": "<string as user said it or null>",
  "recipient": "<0x ethereum address or null>",
  "chain": "Sepolia",
  "slippage": <number or null>,
  "confidence": <float between 0.0 and 1.0>,
  "requires_confirmation": true,
  "missing_fields": ["<list of field names that could not be extracted>"]
}

RULES:
1. operation must be ONLY "transfer", "swap", or "stake". No other operations are supported.
2. If the operation is not one of the three supported types, set confidence to 0.0 and list "operation" in missing_fields.
3. token symbols must be uppercase: ETH, USDC, DAI, WETH, etc.
4. amount must be a number (e.g. 0.5, 100). Never a string.
5. recipient must be a full 42-character Ethereum address starting with 0x, or null.
6. requires_confirmation is ALWAYS true. Never false.
7. confidence reflects how sure you are about the extraction (0.0 = cannot parse, 1.0 = fully clear).
8. If ANY required field for the operation is missing, add it to missing_fields.
9. chain is always "Sepolia" for this academic prototype.
10. For stake operations: token_in is the token to stake, recipient is null.
11. For transfer: token_in is the token to send, recipient is the address, token_out is null.
12. For swap: token_in is what to sell, token_out is what to buy, recipient is null.

SUPPORTED OPERATIONS ONLY: transfer, swap, stake.
If the user asks for anything else (e.g. "buy", "lend", "borrow"), set operation to the closest match if possible, or set confidence 0.0 and explain in missing_fields.

CRITICAL: respond with ONLY the JSON object. No other text."""


class AIService:
    """
    AI/NLP Module: natural language → structured DeFiIntent.

    The Gemini API is used for intent extraction.
    Output is strictly validated against the DeFiIntent Pydantic schema.
    Malformed or unsupported intents are rejected — not executed.
    """

    def __init__(self):
        self._client: Optional[genai.Client] = None
        self._cached_key: Optional[str] = None

    def _get_client(self) -> genai.Client:
        key = (settings.gemini_api_key or "").strip().strip("'\"")
        if not key or key.lower().startswith("your_"):
            raise RuntimeError(
                "Gemini API key is not configured. "
                "Please add a valid GEMINI_API_KEY in the .env file."
            )
        if len(key) < 15:
            raise RuntimeError(
                "Configured GEMINI_API_KEY appears invalid (too short). "
                "Please check the GEMINI_API_KEY value in .env."
            )

        # Re-initialize client if key changes
        if self._client is None or self._cached_key != key:
            self._client = genai.Client(api_key=key)
            self._cached_key = key
        return self._client

    async def parse_intent(self, user_input: str, wallet_address: str) -> DeFiIntent:
        """
        Parse a natural-language DeFi request into a structured DeFiIntent.

        FR-01: Understand natural-language DeFi requests.
        FR-02: Convert to structured transaction details.

        SECURITY: The returned DeFiIntent is NOT executed.
        It is passed to the validation service next.

        Raises:
            ValueError: If the LLM output cannot be parsed into a valid DeFiIntent.
            RuntimeError: If the API call fails or authentication is invalid.
        """
        user_message = (
            f"Parse this DeFi transaction request: '{user_input}'\n"
            f"The user's wallet address is: {wallet_address}"
        )

        logger.info(f"Parsing intent for wallet {wallet_address[:10]}...: '{user_input[:80]}'")

        try:
            client = self._get_client()
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=settings.ai_model,
                    contents=user_message,
                    config=types.GenerateContentConfig(
                        system_instruction=INTENT_EXTRACTION_SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                ),
                timeout=20.0,
            )
        except (TimeoutError, asyncio.TimeoutError):
            logger.error("Gemini API request timed out after 20s")
            raise RuntimeError("Gemini AI request timed out. Please try again.")
        except errors.APIError as e:
            msg = str(e)
            logger.error(f"Gemini API error (HTTP {e.code}): {e.message or msg}")
            if e.code == 400 and ("API_KEY_INVALID" in msg or "API key not valid" in msg or "INVALID_ARGUMENT" in msg):
                raise RuntimeError(
                    "Invalid Gemini API key. Please check that GEMINI_API_KEY in .env is an active, valid Google AI Studio key."
                )
            elif e.code == 403 or "PERMISSION_DENIED" in msg:
                raise RuntimeError(
                    "Gemini API access denied. Ensure your API key has permission for the Generative Language API."
                )
            elif e.code == 429 or "RESOURCE_EXHAUSTED" in msg:
                raise RuntimeError(
                    "Gemini API rate limit exceeded. Please wait a moment and try again."
                )
            elif e.code == 404:
                raise RuntimeError(
                    f"Configured Gemini model '{settings.ai_model}' was not found. Please verify AI_MODEL in .env."
                )
            elif e.code in (500, 502, 503, 504):
                raise RuntimeError(
                    "Google Gemini API is temporarily unavailable. Please retry in a few moments."
                )
            else:
                raise RuntimeError(
                    f"Gemini API error ({e.status or e.code}). Please verify your request."
                )
        except RuntimeError:
            raise
        except Exception as e:
            logger.error(f"Unexpected AI service error: {type(e).__name__}: {e}")
            raise RuntimeError(
                "AI service temporarily unavailable. Please verify network connectivity and try again."
            )

        raw_output = response.text.strip() if response.text else ""
        logger.debug(f"Raw AI output: {raw_output}")

        # Parse and validate the JSON
        intent = self._parse_and_validate_output(raw_output)
        logger.info(
            f"Intent parsed: operation={intent.operation}, "
            f"token_in={intent.token_in}, amount={intent.amount}, "
            f"confidence={intent.confidence}"
        )
        return intent

    def _parse_and_validate_output(self, raw_output: str) -> DeFiIntent:
        """
        Parse the LLM JSON output and validate it against the DeFiIntent schema.

        If the output cannot be parsed or validated, raises ValueError.
        This ensures malformed LLM output never reaches execution.
        """
        # Strip markdown code fences if the model added them anyway
        raw_output = raw_output.strip()
        if raw_output.startswith("```"):
            lines = raw_output.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_output = "\n".join(lines).strip()

        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError as e:
            logger.error(f"LLM output is not valid JSON: {e}\nOutput: {raw_output}")
            raise ValueError(
                "The AI could not parse your request into a structured format. "
                "Please rephrase your DeFi request."
            )

        # Validate against strict Pydantic schema
        try:
            intent = DeFiIntent(**data)
        except Exception as e:
            logger.error(f"DeFiIntent validation failed: {e}\nData: {data}")
            raise ValueError(
                "The AI produced an output that could not be validated. "
                "Please try again with a clearer request."
            )

        # Additional business logic checks
        if intent.confidence < 0.3:
            raise ValueError(
                f"The AI could not confidently parse your request "
                f"(confidence: {intent.confidence:.0%}). "
                "Please be more specific. Example: 'Transfer 0.1 ETH to 0x1234...'"
            )

        if intent.missing_fields:
            missing = ", ".join(intent.missing_fields)
            raise ValueError(
                f"Your request is missing required information: {missing}. "
                "Please include all required details and try again."
            )

        return intent


# Module-level singleton
ai_service = AIService()
