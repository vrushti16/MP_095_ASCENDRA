import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

keys = [
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
    os.getenv("GEMINI_API_KEY"),
]

models = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-pro-latest",
    "gemma-4-31b-it",
]

for k_idx, key in enumerate(keys):
    if not key:
        continue
    genai.configure(api_key=key)
    for m in models:
        try:
            mod = genai.GenerativeModel(m)
            r = mod.generate_content(
                "Output valid JSON: {\"status\": \"ok\"}",
                generation_config={"response_mime_type": "application/json"},
                request_options={"timeout": 6.0}
            )
            print(f"SUCCESS! Key index {k_idx}, Model {m} => {r.text.strip()}")
        except Exception as e:
            err_str = str(e)
            if "429" in err_str:
                print(f"Key {k_idx}, Model {m} => RATE LIMITED (429)")
            elif "404" in err_str:
                print(f"Key {k_idx}, Model {m} => NOT FOUND (404)")
            else:
                print(f"Key {k_idx}, Model {m} => {err_str[:120]}")
