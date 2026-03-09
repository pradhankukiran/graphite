"""LLM-based entity and relationship extraction from text."""

import json
import logging
import re

from openai import OpenAI

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER_MODELS = {
    "groq": "openai/gpt-oss-120b",
    "cerebras": "gpt-oss-120b",
    "openrouter": "openai/gpt-oss-120b",
}

ENTITY_EXTRACTION_PROMPT = """Extract entities and relationships from the following text.

Return a JSON object with this exact structure:
{{
  "entities": [
    {{"name": "Entity Name", "type": "Person|Organization|Location|Concept|Event|Technology", "description": "Brief description"}}
  ],
  "relationships": [
    {{"source": "Entity Name 1", "target": "Entity Name 2", "type": "RELATIONSHIP_TYPE", "description": "Brief description"}}
  ]
}}

Rules:
- Extract all named entities (people, organizations, locations, concepts, events, technologies)
- Identify relationships between entities
- Relationship types should be uppercase with underscores (e.g., WORKS_FOR, LOCATED_IN, DEVELOPS, PART_OF)
- Be thorough but precise — only extract entities clearly mentioned in the text
- Descriptions should be concise (1-2 sentences max)

Text:
{text}

JSON:"""


class EntityExtractor:
    """Extract entities and relationships from text using LLM."""

    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        """Initialize with LLM provider settings.

        Auto-detect from configured keys, preferring Cerebras for extraction
        unless ``KG_EXTRACTION_PROVIDER`` overrides it.
        """
        if api_key and base_url:
            self.client = OpenAI(api_key=api_key, base_url=base_url)
            self.model = model or self._default_model_for_base_url(base_url)
        else:
            # Auto-detect provider from env
            self.client, self.model = self._auto_detect_provider()

    @staticmethod
    def _default_model_for_base_url(base_url: str) -> str:
        normalized = base_url.lower()
        if "cerebras.ai" in normalized:
            return DEFAULT_PROVIDER_MODELS["cerebras"]
        if "openrouter.ai" in normalized:
            return DEFAULT_PROVIDER_MODELS["openrouter"]
        return DEFAULT_PROVIDER_MODELS["groq"]

    def _auto_detect_provider(self):
        import os

        provider_name = os.environ.get("KG_EXTRACTION_PROVIDER", "").strip().lower()
        preferred_order = [provider_name] if provider_name else []

        # Extraction is request-heavy, so prefer providers with roomier rate limits.
        for name in ["cerebras", "groq", "openrouter"]:
            if name not in preferred_order:
                preferred_order.append(name)

        for name in preferred_order:
            if name == "cerebras" and os.environ.get("CEREBRAS_API_KEY"):
                return (
                    OpenAI(
                        api_key=os.environ["CEREBRAS_API_KEY"],
                        base_url="https://api.cerebras.ai/v1",
                    ),
                    os.environ.get(
                        "KG_EXTRACTION_MODEL",
                        DEFAULT_PROVIDER_MODELS["cerebras"],
                    ),
                )
            if name == "groq" and os.environ.get("GROQ_API_KEY"):
                return (
                    OpenAI(
                        api_key=os.environ["GROQ_API_KEY"],
                        base_url="https://api.groq.com/openai/v1",
                    ),
                    os.environ.get(
                        "KG_EXTRACTION_MODEL",
                        DEFAULT_PROVIDER_MODELS["groq"],
                    ),
                )
            if name == "openrouter" and os.environ.get("OPENROUTER_API_KEY"):
                return (
                    OpenAI(
                        api_key=os.environ["OPENROUTER_API_KEY"],
                        base_url="https://openrouter.ai/api/v1",
                        default_headers={
                            "HTTP-Referer": "https://graphite.app",
                            "X-Title": "Graphite",
                        },
                    ),
                    os.environ.get(
                        "KG_EXTRACTION_MODEL",
                        DEFAULT_PROVIDER_MODELS["openrouter"],
                    ),
                )

        raise ValueError(
            "No LLM API key configured. Set GROQ_API_KEY, CEREBRAS_API_KEY, or OPENROUTER_API_KEY."
        )

    def extract(self, text: str) -> dict:
        """Extract entities and relationships from text.

        Returns: {"entities": [...], "relationships": [...]}
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an entity extraction system. Always return valid JSON.",
                    },
                    {
                        "role": "user",
                        "content": ENTITY_EXTRACTION_PROMPT.format(
                            text=text[:4000]
                        ),  # Truncate to avoid token limits
                    },
                ],
                temperature=0.0,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            result = json.loads(response.choices[0].message.content)
            return self._validate_result(result)
        except json.JSONDecodeError:
            logger.warning(
                "Failed to parse LLM response as JSON, attempting extraction from text"
            )
            return self._fallback_parse(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            return {"entities": [], "relationships": []}

    def extract_batch(self, texts: list[str]) -> list[dict]:
        """Extract from multiple texts."""
        results = []
        for text in texts:
            results.append(self.extract(text))
        return results

    def _validate_result(self, result: dict) -> dict:
        """Validate and normalize extraction result."""
        entities = []
        for e in result.get("entities", []):
            if "name" in e and "type" in e:
                entity = {
                    "name": e["name"].strip(),
                    "type": e.get("type", "Concept"),
                    "description": e.get("description", ""),
                }
                # Normalize entity type
                valid_types = {
                    "Person",
                    "Organization",
                    "Location",
                    "Concept",
                    "Event",
                    "Technology",
                }
                if entity["type"] not in valid_types:
                    entity["type"] = "Concept"
                entities.append(entity)

        relationships = []
        entity_names = {e["name"] for e in entities}
        for r in result.get("relationships", []):
            if "source" in r and "target" in r and "type" in r:
                if r["source"] in entity_names and r["target"] in entity_names:
                    relationships.append(
                        {
                            "source": r["source"].strip(),
                            "target": r["target"].strip(),
                            "type": r["type"].strip().upper().replace(" ", "_"),
                            "description": r.get("description", ""),
                        }
                    )

        return {"entities": entities, "relationships": relationships}

    def _fallback_parse(self, text: str) -> dict:
        """Try to extract JSON from a non-JSON response."""
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            try:
                return self._validate_result(json.loads(json_match.group()))
            except json.JSONDecodeError:
                pass
        return {"entities": [], "relationships": []}
