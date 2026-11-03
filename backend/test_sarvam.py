
from app.services.llm_service import get_client
import os

response = get_client().chat.completions.create(
    model=os.getenv("SARVAM_MODEL", "sarvam-105b"),
    messages=[
        {
            "role": "user",
            "content": (
                "Reply with exactly one short sentence "
                "in Telugu introducing Neravu."
            ),
        }
    ],
    max_tokens=100,
)

print(response.choices[0].message.content)
