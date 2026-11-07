import os
from app.services.llm_service import get_client

response = get_client().chat.completions.create(
    model=os.getenv("SARVAM_MODEL", "sarvam-105b-conversations"),
    messages=[
        {
            "role": "user",
            "content": (
                "Reply with exactly one short sentence "
                "in Telugu introducing Neravu."
            ),
        }
    ],
    max_tokens=1000,
)

content = response.choices[0].message.content or ""
print("SARVAM RESPONSE:", content)
