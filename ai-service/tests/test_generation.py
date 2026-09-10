from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_generate_ordering_puzzle():
    payload = {
        "questId": "quest_ancient_runes",
        "topic": "cloud_computing",
        "difficulty": "medium",
        "type": "ordering",
        "interactionType": "ordering"
    }
    response = client.post("/api/v1/ai/puzzles/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Contract checks
    assert data["specVersion"] == "1.0"
    assert data["type"] == "ordering"
    assert data["interactionType"] == "ordering"
    assert data["topic"] == "cloud_computing"
    assert data["difficulty"] == "medium"
    assert "items" in data["content"]
    assert len(data["content"]["items"]) >= 2
    assert isinstance(data["answer"], list)
    assert len(data["answer"]) == len(data["content"]["items"])
    assert data["explanation"] is not None

    # Authority check: FastAPI must NEVER include rewards
    assert "xpReward" not in data
    assert "scoreReward" not in data
    assert "playerXP" not in data
    assert "level" not in data

def test_generate_matching_puzzle():
    payload = {
        "topic": "cyber_security",
        "difficulty": "medium",
        "type": "matching",
        "interactionType": "matching"
    }
    response = client.post("/api/v1/ai/puzzles/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["specVersion"] == "1.0"
    assert data["interactionType"] == "matching"
    assert "terms" in data["content"]
    assert "definitions" in data["content"]
    assert isinstance(data["answer"], dict)
    assert len(data["answer"]) == len(data["content"]["terms"])

def test_generate_mathematics_sequence():
    payload = {
        "topic": "mathematics",
        "difficulty": "easy",
        "type": "sequence",
        "interactionType": "text_input"
    }
    response = client.post("/api/v1/ai/puzzles/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["specVersion"] == "1.0"
    assert data["interactionType"] == "text_input"
    assert data["answer"] is not None

def test_generate_interview_decision():
    payload = {
        "topic": "interview_preparation",
        "difficulty": "medium",
        "type": "scenario",
        "interactionType": "decision"
    }
    response = client.post("/api/v1/ai/puzzles/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["specVersion"] == "1.0"
    assert data["interactionType"] == "decision"
    assert "choices" in data["content"]
    assert len(data["content"]["choices"]) >= 2

def test_generate_true_false():
    payload = {
        "topic": "data_science",
        "difficulty": "easy",
        "type": "concept",
        "interactionType": "true_false"
    }
    response = client.post("/api/v1/ai/puzzles/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["specVersion"] == "1.0"
    assert data["interactionType"] == "true_false"
    assert str(data["answer"]).lower() in {"true", "false"}

def test_generate_rejects_unsupported_topic():
    payload = {
        "topic": "unsupported_magic_astrology",
        "difficulty": "easy"
    }
    response = client.post("/api/v1/ai/puzzles/generate", json=payload)
    assert response.status_code == 422
