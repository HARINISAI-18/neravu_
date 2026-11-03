
import os
from app.services.llm_service import get_client

client = get_client()

response = client.chat.completions.create(
    model=os.getenv("SARVAM_MODEL", "sarvam-105b"),
    messages=[
        {
            "role": "user",
            "content": "Say hello in one short sentence."
        }
    ],
    max_tokens=300,
)

print("MODEL:", response.model)
print("FINISH REASON:", response.choices[0].finish_reason)
print("CONTENT:", repr(response.choices[0].message.content))
print("MESSAGE:", response.choices[0].message.model_dump(exclude_none=True))
print("USAGE:", response.usage)
