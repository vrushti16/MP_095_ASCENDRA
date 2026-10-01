import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

keys = [
    os.getenv("GEMINI_API_KEY"),
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
]

models = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-flash-latest",
]

for i, k in enumerate(keys):
    if not k:
        continue
    genai.configure(api_key=k)
    for model_name in models:
        try:
            m = genai.GenerativeModel(model_name)
            res = m.generate_content(
                "Generate a short puzzle JSON with puzzleId, answer, topic.",
                generation_config={"response_mime_type": "application/json"}
            )
            print(f"SUCCESS! Key index {i}, Model {model_name}:")
            print(res.text)
            exit(0)
        except Exception as e:
            print(f"Key {i}, Model {model_name} failed: {e}")
