import google.generativeai as genai
from app.core.config import settings
from typing import Dict, Any, Optional
import json


class GeminiService:
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    async def process_document(
        self,
        file_content: bytes,
        mime_type: str,
        output_format: str,
        schema: Optional[Dict[str, Any]] = None,
        custom_instructions: str = ""
    ) -> Dict[str, Any]:
        try:
            prompt = self._build_prompt(output_format, schema, custom_instructions)

            file_data = {
                "mime_type": mime_type,
                "data": file_content
            }

            response = self.model.generate_content([prompt, file_data])

            result = self._parse_response(response.text, output_format)

            return {
                "success": True,
                "output": result,
                "tokens_used": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 0
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "tokens_used": 0
            }

    def _build_prompt(
        self,
        output_format: str,
        schema: Optional[Dict[str, Any]],
        custom_instructions: str
    ) -> str:
        base_prompt = "You are an expert document analyzer. Analyze the provided document carefully and extract information according to the specified format.\n\n"

        if custom_instructions:
            base_prompt += f"Additional Instructions: {custom_instructions}\n\n"

        if output_format == "text":
            format_instruction = self._build_text_prompt(schema)
        elif output_format == "json":
            format_instruction = self._build_json_prompt(schema)
        elif output_format == "excel":
            format_instruction = self._build_excel_prompt(schema)
        else:
            format_instruction = "Extract all relevant information from the document."

        return base_prompt + format_instruction

    def _build_text_prompt(self, schema: Optional[Dict[str, Any]]) -> str:
        if not schema or not schema.get("template"):
            return "Extract and summarize all key information from the document in a clear, readable text format."

        template = schema.get("template", "")
        return f"""
Extract information from the document and format it as plain text following this template:

{template}

Replace placeholders with actual values from the document. If a value is not found, write "Not found" or leave it empty as appropriate.
"""

    def _build_json_prompt(self, schema: Optional[Dict[str, Any]]) -> str:
        if not schema or not schema.get("fields"):
            return """
Extract all relevant information from the document and return it as a valid JSON object.
Structure the data logically with appropriate field names.
Return ONLY the JSON object, with no additional text or markdown formatting.
"""

        fields_description = self._describe_json_fields(schema.get("fields", []))

        return f"""
Extract information from the document and return it as a valid JSON object with the following structure:

{json.dumps(schema, indent=2)}

Field descriptions:
{fields_description}

IMPORTANT:
- Return ONLY the JSON object, no markdown, no code blocks, no additional text
- Ensure all field types match the schema
- Use null for missing values
- Validate the JSON is properly formatted
"""

    def _describe_json_fields(self, fields: list) -> str:
        descriptions = []
        for field in fields:
            field_name = field.get("name", "")
            field_type = field.get("type", "string")
            field_desc = field.get("description", "")

            desc = f"- {field_name} ({field_type})"
            if field_desc:
                desc += f": {field_desc}"

            if field_type == "array" and field.get("items"):
                desc += f"\n  Items: {json.dumps(field['items'])}"
            elif field_type == "object" and field.get("properties"):
                desc += f"\n  Properties: {json.dumps(field['properties'])}"

            descriptions.append(desc)

        return "\n".join(descriptions)

    def _build_excel_prompt(self, schema: Optional[Dict[str, Any]]) -> str:
        if not schema or not schema.get("columns"):
            return """
Extract tabular data from the document and return it as a JSON array of objects.
Each object represents a row with consistent field names.
Return ONLY the JSON array, with no additional text or markdown formatting.
"""

        columns = schema.get("columns", [])
        column_descriptions = "\n".join([
            f"- {col.get('name')}: {col.get('description', 'No description')}"
            for col in columns
        ])

        return f"""
Extract tabular data from the document according to these columns:

{column_descriptions}

Return the data as a JSON array of objects, where each object represents a row.
Use these exact field names: {[col.get('name') for col in columns]}

Example format:
[
  {{{", ".join([f'"{col.get("name")}": "value"' for col in columns])}}},
  ...
]

IMPORTANT:
- Return ONLY the JSON array, no markdown, no code blocks, no additional text
- Ensure consistent field names across all rows
- Use null for missing values
- Validate the JSON is properly formatted
"""

    def _parse_response(self, response_text: str, output_format: str) -> Any:
        response_text = response_text.strip()

        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]

        if response_text.endswith("```"):
            response_text = response_text[:-3]

        response_text = response_text.strip()

        if output_format == "text":
            return response_text

        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            return {
                "raw_output": response_text,
                "parse_error": f"Failed to parse JSON: {str(e)}"
            }


gemini_service = GeminiService()
