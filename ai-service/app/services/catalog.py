import uuid
from typing import Dict, Any, List, Optional

# Diverse, high-quality, non-coding educational puzzle templates for offline testing and fallback
OFFLINE_CATALOG: List[Dict[str, Any]] = [
    # 1. Cloud Computing — Process Ordering (ordering)
    {
        "type": "ordering",
        "interactionType": "ordering",
        "topic": "cloud_computing",
        "difficulty": "medium",
        "question": "Arrange the standard incident response phases in the correct operational sequence.",
        "content": {
            "items": [
                "Preparation",
                "Detection & Analysis",
                "Containment, Eradication & Recovery",
                "Post-Incident Activity"
            ]
        },
        "answer": [0, 1, 2, 3],
        "explanation": "According to the NIST incident response framework, teams prepare, detect and analyze, contain and recover, and finally review post-incident lessons."
    },
    # 2. Cyber Security — Threat Matching (matching)
    {
        "type": "matching",
        "interactionType": "matching",
        "topic": "cyber_security",
        "difficulty": "medium",
        "question": "Match each cyber attack vector with its primary mechanism.",
        "content": {
            "terms": [
                "Phishing",
                "Ransomware",
                "Man-in-the-Middle"
            ],
            "definitions": [
                "Deceptive communication designed to steal credentials or sensitive data",
                "Malware that encrypts files and demands payment for the decryption key",
                "Interception of communications between two parties without their knowledge"
            ]
        },
        "answer": {
            "Phishing": "Deceptive communication designed to steal credentials or sensitive data",
            "Ransomware": "Malware that encrypts files and demands payment for the decryption key",
            "Man-in-the-Middle": "Interception of communications between two parties without their knowledge"
        },
        "explanation": "These represent fundamental cybersecurity threat categories with distinct operational vectors."
    },
    # 3. Artificial Intelligence — Conceptual Multiple Choice (multiple_choice)
    {
        "type": "concept",
        "interactionType": "multiple_choice",
        "topic": "artificial_intelligence",
        "difficulty": "easy",
        "question": "Which machine learning paradigm learns optimal behaviors by receiving rewards or penalties from an environment?",
        "content": {
            "options": [
                "Reinforcement Learning",
                "Supervised Regression",
                "Unsupervised Clustering",
                "Dimensionality Reduction"
            ]
        },
        "answer": "Reinforcement Learning",
        "explanation": "Reinforcement Learning trains agents to maximize cumulative rewards through environmental trial and error."
    },
    # 4. Mathematics — Sequence Deduction (text_input)
    {
        "type": "sequence",
        "interactionType": "text_input",
        "topic": "mathematics",
        "difficulty": "easy",
        "question": "What is the next number in the sequence: 4, 9, 16, 25, ...?",
        "content": {
            "sequence": [4, 9, 16, 25],
            "prompt": "Enter the next integer in the series."
        },
        "answer": "36",
        "explanation": "The terms are successive squares: 2^2=4, 3^2=9, 4^2=16, 5^2=25, 6^2=36."
    },
    # 5. Interview Preparation — Situational Judgment (decision)
    {
        "type": "scenario",
        "interactionType": "decision",
        "topic": "interview_preparation",
        "difficulty": "medium",
        "question": "During a technical review, a colleague highlights a flaw in your proposed system architecture. What is the most effective professional response?",
        "content": {
            "choices": [
                "Acknowledge the observation, ask clarifying questions, and collaboratively evaluate alternative approaches.",
                "Defend your original design aggressively to demonstrate technical confidence.",
                "Disregard the feedback and proceed without changes.",
                "Cancel the meeting and rewrite the entire proposal in isolation."
            ]
        },
        "answer": "Acknowledge the observation, ask clarifying questions, and collaboratively evaluate alternative approaches.",
        "explanation": "Constructive collaboration and receptive feedback handling demonstrate emotional intelligence and professional maturity."
    },
    # 6. Data Science — Statistical Fallacy (true_false)
    {
        "type": "concept",
        "interactionType": "true_false",
        "topic": "data_science",
        "difficulty": "easy",
        "question": "Evaluate the validity of the following analytical statement: A high correlation coefficient (r = 0.95) between ice cream sales and shark attacks proves that selling ice cream causes shark attacks.",
        "content": {
            "statement": "A high correlation coefficient between ice cream sales and shark attacks proves causality."
        },
        "answer": "false",
        "explanation": "Correlation does not imply causation; both variables are influenced by a confounding variable (warm summer weather)."
    },
    # 7. Logical Reasoning — Deductive Riddle (text_input)
    {
        "type": "riddle",
        "interactionType": "text_input",
        "topic": "logical_reasoning",
        "difficulty": "easy",
        "question": "The more you take, the more you leave behind. What are they?",
        "content": {
            "prompt": "Enter the one-word answer."
        },
        "answer": "footsteps",
        "explanation": "As you take steps forward, you leave footsteps behind."
    },
    # 8. Aptitude — Quantitative Ratio (multiple_choice)
    {
        "type": "concept",
        "interactionType": "multiple_choice",
        "topic": "aptitude",
        "difficulty": "easy",
        "question": "If a train travels at 60 km/h for 2.5 hours, how far does it travel?",
        "content": {
            "options": [
                "150 km",
                "120 km",
                "180 km",
                "140 km"
            ]
        },
        "answer": "150 km",
        "explanation": "Distance = Speed * Time = 60 * 2.5 = 150 km."
    },
    # 9. English — Analogy Challenge (multiple_choice)
    {
        "type": "concept",
        "interactionType": "multiple_choice",
        "topic": "english",
        "difficulty": "easy",
        "question": "Complete the analogy: ODOMETER is to DISTANCE as COMPASS is to...",
        "content": {
            "options": [
                "DIRECTION",
                "PRESSURE",
                "SPEED",
                "ALTITUDE"
            ]
        },
        "answer": "DIRECTION",
        "explanation": "An odometer measures distance, while a compass measures or indicates direction."
    },
    # 10. Critical Thinking — Fallacy Identification (multiple_choice)
    {
        "type": "scenario",
        "interactionType": "multiple_choice",
        "topic": "critical_thinking",
        "difficulty": "medium",
        "question": "When an argument attacks the character of the person presenting it rather than addressing their actual point, which fallacy is committed?",
        "content": {
            "options": [
                "Ad Hominem",
                "Straw Man",
                "Slippery Slope",
                "False Dilemma"
            ]
        },
        "answer": "Ad Hominem",
        "explanation": "An Ad Hominem fallacy occurs when one attacks the person making an argument instead of addressing the argument itself."
    }
]

def find_catalog_puzzle(topic: str, difficulty: str = "easy", interaction_type: Optional[str] = None, puzzle_type: Optional[str] = None) -> Dict[str, Any]:
    """Find the best matching non-coding puzzle from the offline catalog."""
    norm_topic = topic.strip().lower().replace(" ", "_").replace("-", "_")

    candidates = []
    for item in OFFLINE_CATALOG:
        # Match topic
        if item["topic"] == norm_topic:
            candidates.append(item)

    # If no topic match, filter by interaction type
    if not candidates and interaction_type:
        norm_interaction = interaction_type.strip().lower()
        candidates = [item for item in OFFLINE_CATALOG if item["interactionType"] == norm_interaction]

    if not candidates:
        candidates = OFFLINE_CATALOG

    # Filter by interaction_type if specified
    if interaction_type:
        norm_interaction = interaction_type.strip().lower()
        sub = [c for c in candidates if c["interactionType"] == norm_interaction]
        if sub:
            candidates = sub

    # Choose candidate and copy
    chosen = dict(candidates[0])

    # Assign dynamic IDs
    chosen["externalPuzzleId"] = f"ai_{uuid.uuid4().hex[:12]}"
    chosen["topic"] = norm_topic
    chosen["difficulty"] = difficulty.lower()
    if puzzle_type:
        chosen["type"] = puzzle_type

    return chosen
