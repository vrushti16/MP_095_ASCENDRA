import pytest
from app.services.validator import (
    validate_generated_puzzle,
    scan_text_for_coding,
    PuzzleValidationError
)

def test_coding_syntax_detection():
    # Syntax snippets
    assert scan_text_for_coding("def calculate_sum(a, b): return a + b") is True
    assert scan_text_for_coding("console.log('Testing output');") is True
    assert scan_text_for_coding("SELECT id, name FROM users WHERE active = true;") is True
    assert scan_text_for_coding("```python\nprint('hello')\n```") is True

    # Task intent patterns
    assert scan_text_for_coding("What will this Python program print?") is True
    assert scan_text_for_coding("Write a SQL query to fetch orders.") is True
    assert scan_text_for_coding("Fix the bug in the binary search implementation.") is True

    # Valid non-coding concepts (No false positives)
    assert scan_text_for_coding("What is the difference between supervised and unsupervised learning?") is False
    assert scan_text_for_coding("Which cloud architecture pattern ensures high availability across regions?") is False
    assert scan_text_for_coding("An employee receives a suspicious email asking for credentials. What attack is this?") is False
    assert scan_text_for_coding("Why does correlation not imply causation in data science?") is False

def test_validator_rejects_coding_puzzle():
    coding_puzzle = {
        "question": "What will this script output? print(2 + 2)",
        "interactionType": "multiple_choice",
        "content": {"options": ["4", "22"]},
        "answer": "4",
        "explanation": "Simple addition."
    }
    with pytest.raises(PuzzleValidationError) as excinfo:
        validate_generated_puzzle(coding_puzzle)
    assert "Coding/programming questions are strictly prohibited" in str(excinfo.value)

def test_validator_ordering_integrity():
    valid_ordering = {
        "question": "Arrange the phases of software development lifecycle.",
        "interactionType": "ordering",
        "content": {"items": ["Requirements", "Design", "Implementation", "Testing"]},
        "answer": [0, 1, 2, 3],
        "explanation": "Standard waterfall flow."
    }
    res = validate_generated_puzzle(valid_ordering)
    assert res["interactionType"] == "ordering"

    # Mismatched length
    invalid_ordering = dict(valid_ordering)
    invalid_ordering["answer"] = [0, 1]
    with pytest.raises(PuzzleValidationError):
        validate_generated_puzzle(invalid_ordering)

def test_validator_matching_integrity():
    valid_matching = {
        "question": "Match the cloud acronyms.",
        "interactionType": "matching",
        "content": {
            "terms": ["IaaS", "PaaS", "SaaS"],
            "definitions": ["Infrastructure", "Platform", "Software"]
        },
        "answer": {
            "IaaS": "Infrastructure",
            "PaaS": "Platform",
            "SaaS": "Software"
        },
        "explanation": "Cloud delivery models."
    }
    res = validate_generated_puzzle(valid_matching)
    assert res["interactionType"] == "matching"

def test_validator_multiple_choice_uniqueness():
    duplicate_options = {
        "question": "Which protocol is secure?",
        "interactionType": "multiple_choice",
        "content": {"options": ["HTTPS", "HTTP", "HTTPS", "FTP"]},
        "answer": "HTTPS"
    }
    with pytest.raises(PuzzleValidationError) as exc:
        validate_generated_puzzle(duplicate_options)
    assert "unique" in str(exc.value).lower()
