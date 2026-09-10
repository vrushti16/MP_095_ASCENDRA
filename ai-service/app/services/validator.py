import re
from typing import Dict, Any, List

class PuzzleValidationError(Exception):
    def __init__(self, message: str, code: str = "VALIDATION_FAILED"):
        super().__init__(message)
        self.message = message
        self.code = code

# Layer 1: Programming syntax keywords & language constructs
CODE_SYNTAX_PATTERNS = [
    re.compile(r"```(python|javascript|js|ts|typescript|java|c\+\+|cpp|c#|sql|bash|sh|ruby|go|rust|php)", re.IGNORECASE),
    re.compile(r"```[\s\S]*?```"),
    re.compile(r"\bdef\s+[a-zA-Z0-9_]+\s*\(", re.IGNORECASE),
    re.compile(r"\bfunction\s*[a-zA-Z0-9_]*\s*\(", re.IGNORECASE),
    re.compile(r"\bconsole\.log\s*\(", re.IGNORECASE),
    re.compile(r"\bprint\s*\(", re.IGNORECASE),
    re.compile(r"#include\s*<[a-zA-Z0-9_.]+>", re.IGNORECASE),
    re.compile(r"\bpublic\s+(static\s+)?(void|class|int|String)\b", re.IGNORECASE),
    re.compile(r"\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE|CREATE\s+TABLE)\b[\s\S]*?\b(FROM|WHERE|SET|VALUES)\b", re.IGNORECASE),
    re.compile(r"\bimport\s+(numpy|pandas|react|express|tensorflow|torch|sklearn|flask)\b", re.IGNORECASE),
    re.compile(r"\b(const|let|var)\s+[a-zA-Z0-9_]+\s*=", re.IGNORECASE),
    re.compile(r"\bfor\s*\(\s*(let|var|int)\s+[a-zA-Z0-9_]+\s*=", re.IGNORECASE),
    re.compile(r"\bwhile\s*\([^)]*\)\s*\{", re.IGNORECASE)
]

# Layer 2: Task-intent patterns (asking to write/debug/trace code)
PROGRAMMING_TASK_INTENT_PATTERNS = [
    re.compile(r"\bwhat\s+(will|does)\s+this\s+.*(code|program|script|function|snippet|query)\s+(output|print|return|do)\b", re.IGNORECASE),
    re.compile(r"\b(write|create)\s+(a\s+)?.*(code|script|query|program|function|algorithm)\b", re.IGNORECASE),
    re.compile(r"\bwhich\s+.*(function|method|library|syntax|keyword|command|operator|api)\s+(should|would|to|can|is\s+used)\b", re.IGNORECASE),
    re.compile(r"\bfix\s+the\s+(bug|error|syntax|issue)\b", re.IGNORECASE),
    re.compile(r"\bpredict\s+the\s+(output|result)\s+of\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+is\s+the\s+(time|space)\s+complexity\s+of\s+.*(code|function|algorithm|implementation|logic|snippet)\b", re.IGNORECASE),
    re.compile(r"\bimplement\s+.*(in\s+code|in\s+python|in\s+java|in\s+javascript|in\s+c\+\+|in\s+sql)\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+does\s+(this|the\s+following)\s+.*(code|snippet|query|script)\s+evaluate\s+to\b", re.IGNORECASE),
    re.compile(r"\bcomplete\s+the\s+missing\s+(code|line\s+of\s+code|syntax)\b", re.IGNORECASE),
    re.compile(r"\b(python|javascript|java|c\+\+|sql|typescript|bash|golang|rust)\s+(program|code|snippet|script|query)\s+(prints?|outputs?|returns?)\b", re.IGNORECASE)
]

def scan_text_for_coding(text: str) -> bool:
    """Check a single text string against syntax and intent patterns."""
    if not text or not isinstance(text, str):
        return False
    for p in CODE_SYNTAX_PATTERNS:
        if p.search(text):
            return True
    for p in PROGRAMMING_TASK_INTENT_PATTERNS:
        if p.search(text):
            return True
    return False

def scan_puzzle_for_coding(data: Dict[str, Any]) -> bool:
    """Recursively check all string fields in a generated puzzle for coding content."""
    strings = []

    def collect(obj):
        if isinstance(obj, str):
            strings.append(obj)
        elif isinstance(obj, list):
            for item in obj:
                collect(item)
        elif isinstance(obj, dict):
            for v in obj.values():
                collect(v)

    collect(data.get("question", ""))
    collect(data.get("content", {}))
    collect(data.get("explanation", ""))
    collect(data.get("answer", ""))

    return any(scan_text_for_coding(s) for s in strings)

def validate_generated_puzzle(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate puzzle before returning to Node.js backend:
    - Layer 1 & 2: Non-coding enforcement
    - Layer 3: Context and answer integrity by interaction model
    """
    # 1. Non-coding enforcement
    if scan_puzzle_for_coding(data):
        raise PuzzleValidationError("Coding/programming questions are strictly prohibited in ASCENDRA", "CODING_PROHIBITED")

    # 2. Basic fields
    question = data.get("question")
    if not question or not isinstance(question, str) or len(question.strip()) < 5:
        raise PuzzleValidationError("Puzzle question must be a descriptive string", "INVALID_QUESTION")

    interaction_type = data.get("interactionType")
    if not interaction_type:
        raise PuzzleValidationError("Missing interactionType", "MISSING_INTERACTION_TYPE")

    content = data.get("content", {})
    if not isinstance(content, dict):
        raise PuzzleValidationError("content must be a dictionary", "INVALID_CONTENT")

    answer = data.get("answer")
    if answer is None or (isinstance(answer, str) and not answer.strip()):
        raise PuzzleValidationError("Missing authoritative answer", "MISSING_ANSWER")

    # 3. Content & Answer Integrity by interactionType
    if interaction_type == "multiple_choice":
        options = content.get("options", [])
        if not isinstance(options, list) or len(options) < 2:
            raise PuzzleValidationError("Multiple choice requires content.options list with at least 2 items", "INVALID_OPTIONS")
        # Check uniqueness
        norm_opts = [str(o).strip().lower() for o in options]
        if len(set(norm_opts)) != len(options):
            raise PuzzleValidationError("Options must be unique", "DUPLICATE_OPTIONS")
        # Check answer matches
        ans_str = str(answer).strip().lower()
        if ans_str not in norm_opts and not (isinstance(answer, int) and 0 <= answer < len(options)):
            raise PuzzleValidationError("Answer does not match available options", "ANSWER_MISMATCH")

    elif interaction_type == "ordering":
        items = content.get("items", [])
        if not isinstance(items, list) or len(items) < 2:
            raise PuzzleValidationError("Ordering requires content.items list with at least 2 items", "INVALID_ORDERING_ITEMS")
        if not isinstance(answer, list) or len(answer) != len(items):
            raise PuzzleValidationError("Ordering answer must be a list with same length as items", "INVALID_ORDERING_ANSWER")

    elif interaction_type == "matching":
        terms = content.get("terms", [])
        definitions = content.get("definitions", [])
        if not isinstance(terms, list) or not isinstance(definitions, list) or len(terms) < 2:
            raise PuzzleValidationError("Matching requires terms and definitions lists", "INVALID_MATCHING_CONTENT")
        if not isinstance(answer, dict) or len(answer) != len(terms):
            raise PuzzleValidationError("Matching answer must be a mapping dictionary matching all terms", "INVALID_MATCHING_ANSWER")

    elif interaction_type == "decision":
        choices = content.get("choices", [])
        if not isinstance(choices, list) or len(choices) < 2:
            raise PuzzleValidationError("Decision requires content.choices list with at least 2 items", "INVALID_DECISION_CHOICES")

    elif interaction_type == "true_false":
        if str(answer).strip().lower() not in {"true", "false"}:
            raise PuzzleValidationError("True/false answer must be 'true' or 'false'", "INVALID_TRUE_FALSE_ANSWER")

    return data
