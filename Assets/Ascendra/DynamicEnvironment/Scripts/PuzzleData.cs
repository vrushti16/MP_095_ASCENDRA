using System;
using System.Collections.Generic;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    [Serializable]
    public class PuzzleElementData
    {
        public string id;
        public string value;
        public string label;
        public string type;
        public string semanticType = "";
        public string targetValue = "";
        public int index;
        public bool isInteractable = true;
        public int gridRow = -1;
        public int gridColumn = -1;
    }

    [Serializable]
    public class PuzzleLayoutData
    {
        public int rows = 1;
        public int columns = 1;
    }

    [Serializable]
    public class LearningIntegrationData
    {
        public string concept = "";
        public string gameRepresentation = "";
        public string playerAction = "";
    }

    [Serializable]
    public class PuzzleStateData
    {
        public Dictionary<string, string> initialState = new Dictionary<string, string>();
        public Dictionary<string, string> currentState = new Dictionary<string, string>();
        public Dictionary<string, string> targetState = new Dictionary<string, string>();
        public bool resetOnFailure = true;
    }

    [Serializable]
    public class PlayerReturnStateData
    {
        public bool restorePlayerPosition = true;
        public bool restorePlayerRotation = true;
        public bool restoreCamera = true;
        public bool returnToTrigger = true;
        public bool destroyPuzzleEnvironmentAfterCompletion = true;
        public bool restoreExplorationMusic = true;
    }

    [Serializable]
    public class AssetRequirementsData
    {
        public string primaryPack = "DUNGEON_LOWPOLY_PACK";
        public List<string> secondaryPacks = new List<string>();
        public List<string> optionalPacks = new List<string>();
    }

    [Serializable]
    public class SemanticAssetRequirement
    {
        public string semanticType = "stone_pillar";
        public string role = "mechanism";
        public int quantity = 1;
        public bool interactive = true;
    }

    [Serializable]
    public class InteractiveObjectDefinition
    {
        public string id = "obj_01";
        public string semanticType = "rotating_ring";
        public string interaction = "rotate";
        public string initialState = "0";
        public List<string> allowedActions = new List<string>();
    }

    [Serializable]
    public class EnvironmentalClueData
    {
        public string id = "clue_01";
        public string type = "environmental_mural";
        public string location = "north_wall";
        public string content = "";
        public bool discoverable = true;
    }

    [Serializable]
    public class StoryData
    {
        public string context = "";
        public string discovery = "";
    }

    [Serializable]
    public class ObjectiveData
    {
        public string type = "mechanism_activation";
        public string description = "";
    }

    [Serializable]
    public class SuccessResponseData
    {
        public string environmentEffect = "gate_opens";
        public string animation = "mechanism_activation";
        public string audio = "puzzle_success";
        public string rewardType = "knowledge_crystal";
        public int rewardAmount = 1;
    }

    [Serializable]
    public class FailureResponseData
    {
        public string environmentEffect = "mechanism_reset";
        public string feedback = "subtle_environment_feedback";
        public bool allowRetry = true;
    }

    [Serializable]
    public class PuzzleData
    {
        public string puzzleId = "PZ-DEFAULT";
        public PuzzleType puzzleType = PuzzleType.NumberMatrix;
        public string rawPuzzleType = "number_matrix";
        public string taskType = "aptitude";
        public string difficulty = "medium";
        public int difficultyLevel = 3;
        public EnvironmentTheme theme = EnvironmentTheme.Dungeon;
        public PuzzleInteractionType interactionType = PuzzleInteractionType.TileSelection;
        public string rawInteractionType = "tile_selection";
        public string title = "Mystic Mechanism";
        public string description = "";
        public string instructions = "Interact with the elements to align the mechanism.";
        public float timeLimit = 0f; // 0 = unlimited

        public PuzzleLayoutData layout = new PuzzleLayoutData();
        public List<PuzzleElementData> elements = new List<PuzzleElementData>();
        
        public LearningIntegrationData learningIntegration = new LearningIntegrationData();
        public PuzzleStateData puzzleState = new PuzzleStateData();
        public PlayerReturnStateData playerReturnState = new PlayerReturnStateData();
        public AssetRequirementsData assetRequirements = new AssetRequirementsData();
        public List<SemanticAssetRequirement> requiredAssets = new List<SemanticAssetRequirement>();
        public List<InteractiveObjectDefinition> interactiveObjects = new List<InteractiveObjectDefinition>();
        public List<EnvironmentalClueData> clues = new List<EnvironmentalClueData>();
        public StoryData story = new StoryData();
        public ObjectiveData objective = new ObjectiveData();
        public SuccessResponseData success = new SuccessResponseData();
        public FailureResponseData failure = new FailureResponseData();

        public string answer = "";
        public string solution = "";
        public string explanation = "";
        public Dictionary<string, string> visualProperties = new Dictionary<string, string>();

        public static PuzzleData FromJson(string json) => ParseJson(json);

        /// <summary>
        /// Robust Json Parser that handles API variations, missing fields, and custom element extraction.
        /// Uses Unity's JsonUtility with fallbacks for JSON objects.
        /// </summary>
        public static PuzzleData ParseJson(string json)
        {
            PuzzleData data = new PuzzleData();
            if (string.IsNullOrEmpty(json))
                return data;

            try
            {
                // Simple JSON field extractors for loose JSON structures
                data.puzzleId = ExtractString(json, "externalPuzzleId", ExtractString(json, "puzzle_id", ExtractString(json, "puzzleId", ExtractString(json, "id", "AI_PUZZLE"))));
                data.rawPuzzleType = ExtractString(json, "puzzleType", ExtractString(json, "puzzle_type", ExtractString(json, "type", "number_matrix")));
                data.taskType = ExtractString(json, "taskType", ExtractString(json, "category", ExtractString(json, "topic", "aptitude")));
                data.difficulty = ExtractString(json, "difficulty", "medium");
                data.rawInteractionType = ExtractString(json, "interactionType", ExtractString(json, "interaction_type", "tile_selection"));
                data.title = ExtractString(json, "title", ExtractString(json, "question", "Mystic Challenge"));
                data.description = ExtractString(json, "description", ExtractString(json, "explanation", ""));
                data.answer = ExtractString(json, "answer", ExtractString(json, "correctAnswer", ""));
                data.solution = ExtractString(json, "solution", "");
                if (string.IsNullOrEmpty(data.answer) || data.answer == "??")
                {
                    if (!string.IsNullOrEmpty(data.solution) && data.solution != "??")
                    {
                        data.answer = data.solution;
                    }
                }

                // Map Theme
                string themeStr = ExtractString(json, "theme", "dungeon");
                data.theme = ParseTheme(themeStr);

                // Map Difficulty Level
                data.difficultyLevel = ExtractInt(json, "difficulty_level", ExtractInt(json, "difficultyLevel", ParseDifficultyLevel(data.difficulty)));

                // Map Enums
                data.puzzleType = ParsePuzzleType(data.rawPuzzleType);
                data.interactionType = ParseInteractionType(data.rawInteractionType);

                // Story & Objective
                data.story.context = ExtractString(json, "context", "");
                data.story.discovery = ExtractString(json, "discovery", "");
                data.objective.type = ExtractString(json, "objective_type", ExtractString(json, "type", "mechanism_activation"));
                data.objective.description = ExtractString(json, "objective_description", ExtractString(json, "description", ""));

                // Learning Integration
                data.learningIntegration.concept = ExtractString(json, "concept", "");
                data.learningIntegration.gameRepresentation = ExtractString(json, "game_representation", "");
                data.learningIntegration.playerAction = ExtractString(json, "player_action", "");

                // Asset Requirements
                data.assetRequirements.primaryPack = ExtractString(json, "primary_pack", ExtractString(json, "primary_asset_pack", "DUNGEON_LOWPOLY_PACK"));
                data.assetRequirements.secondaryPacks = ExtractStringList(json, "secondary_packs");
                data.assetRequirements.optionalPacks = ExtractStringList(json, "optional_packs");

                // Parse Layout (rows, columns)
                int rows = ExtractInt(json, "rows", -1);
                int cols = ExtractInt(json, "columns", ExtractInt(json, "cols", -1));

                // Parse explicit elements array if present
                List<string> rawElements = ExtractStringList(json, "elements");
                if (rawElements.Count > 0)
                {
                    for (int i = 0; i < rawElements.Count; i++)
                    {
                        string elemJson = rawElements[i].Trim();
                        PuzzleElementData elem = new PuzzleElementData
                        {
                            index = i,
                            isInteractable = true
                        };

                        if (!elemJson.StartsWith("{"))
                        {
                            elem.id = $"elem_{i}";
                            elem.value = elemJson.Trim('"', ' ', '\t');
                            elem.label = elem.value;
                            elem.type = "tile";
                        }
                        else
                        {
                            elem.id = ExtractString(elemJson, "id", $"elem_{i}");
                            elem.value = ExtractString(elemJson, "value", ExtractString(elemJson, "label", ExtractString(elemJson, "symbol", ExtractString(elemJson, "number", $"Val {i + 1}"))));
                            elem.label = ExtractString(elemJson, "label", ExtractString(elemJson, "value", ExtractString(elemJson, "name", ExtractString(elemJson, "symbol", $"Tile {i + 1}"))));
                            elem.type = ExtractString(elemJson, "type", "tile");
                            elem.semanticType = ExtractString(elemJson, "semanticType", ExtractString(elemJson, "semantic_type", ""));
                            elem.targetValue = ExtractString(elemJson, "target_value", ExtractString(elemJson, "targetValue", ""));
                            elem.isInteractable = ExtractBool(elemJson, "isInteractable", true);
                        }
                        data.elements.Add(elem);
                    }
                }

                if (string.IsNullOrEmpty(data.answer) || data.answer == "??")
                {
                    foreach (var el in data.elements)
                    {
                        if (!string.IsNullOrEmpty(el.targetValue) && el.targetValue != "??")
                        {
                            data.answer = el.targetValue;
                            break;
                        }
                    }
                }
                if (string.IsNullOrEmpty(data.answer) || data.answer == "??")
                {
                    data.answer = "36";
                }

                // If elements list is empty, dynamically construct elements from content options/items/choices/terms
                if (data.elements.Count == 0)
                {
                    List<string> options = ExtractStringList(json, "options");
                    if (options.Count == 0) options = ExtractStringList(json, "items");
                    if (options.Count == 0) options = ExtractStringList(json, "choices");
                    if (options.Count == 0) options = ExtractStringList(json, "terms");

                    if (options.Count > 0)
                    {
                        for (int i = 0; i < options.Count; i++)
                        {
                            data.elements.Add(new PuzzleElementData
                            {
                                id = $"opt_{i}",
                                value = options[i],
                                label = options[i],
                                type = "option",
                                index = i,
                                isInteractable = true
                            });
                        }
                    }
                }

                // Dynamic generation if elements list is still empty
                if (data.elements.Count == 0)
                {
                    int totalCount = (rows > 0 && cols > 0) ? (rows * cols) : 1;
                    string targetVal = !string.IsNullOrEmpty(data.answer) ? data.answer : "Activate";
                    for (int i = 0; i < totalCount; i++)
                    {
                        data.elements.Add(new PuzzleElementData
                        {
                            id = $"tile_{i}",
                            value = (i == totalCount / 2) ? targetVal : $"{i + 1}",
                            label = (i == totalCount / 2) ? targetVal : $"{i + 1}",
                            type = "mechanism_node",
                            index = i,
                            isInteractable = true
                        });
                    }
                }

                // Calculate Layout Rows/Cols if not explicitly given
                int count = data.elements.Count;
                if (rows <= 0 || cols <= 0)
                {
                    if (count == 9) { rows = 3; cols = 3; }
                    else if (count == 16) { rows = 4; cols = 4; }
                    else if (count == 25) { rows = 5; cols = 5; }
                    else if (count > 0)
                    {
                        cols = Mathf.CeilToInt(Mathf.Sqrt(count));
                        rows = Mathf.CeilToInt((float)count / cols);
                    }
                    else
                    {
                        rows = 3; cols = 3;
                    }
                }

                data.layout.rows = rows;
                data.layout.columns = cols;

                // Assign Grid Row and Column to elements
                for (int i = 0; i < data.elements.Count; i++)
                {
                    data.elements[i].gridRow = i / cols;
                    data.elements[i].gridColumn = i % cols;
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[PuzzleData] Error parsing puzzle JSON: {ex.Message}. Falling back to default.");
            }

            return data;
        }

        #region Helper Json Parsers
        private static string ExtractString(string json, string key, string fallback)
        {
            return ExtractString(json, key, key, fallback);
        }

        private static string ExtractString(string json, string primaryKey, string secondaryKey, string fallback)
        {
            string val = ExtractRawValue(json, primaryKey);
            if (string.IsNullOrEmpty(val)) val = ExtractRawValue(json, secondaryKey);
            if (string.IsNullOrEmpty(val)) return fallback;
            return val.Trim('"', ' ', '\t', '\r', '\n');
        }

        private static int ExtractInt(string json, string key, int fallback)
        {
            string val = ExtractRawValue(json, key);
            if (int.TryParse(val, out int res)) return res;
            return fallback;
        }

        private static bool ExtractBool(string json, string key, bool fallback)
        {
            string val = ExtractRawValue(json, key);
            if (string.IsNullOrEmpty(val)) return fallback;
            val = val.Trim('"', ' ', '\t', '\r', '\n');
            if (bool.TryParse(val, out bool res)) return res;
            if (val == "1") return true;
            if (val == "0") return false;
            return fallback;
        }

        private static string ExtractRawValue(string json, string key)
        {
            if (string.IsNullOrEmpty(json) || string.IsNullOrEmpty(key)) return null;

            int idx = json.IndexOf($"\"{key}\"", StringComparison.OrdinalIgnoreCase);
            if (idx < 0) idx = json.IndexOf($"{key}:", StringComparison.OrdinalIgnoreCase);
            if (idx < 0) idx = json.IndexOf($"{key}=", StringComparison.OrdinalIgnoreCase);
            if (idx < 0) return null;

            int colon = json.IndexOf(':', idx);
            if (colon < 0) colon = json.IndexOf('=', idx);
            if (colon < 0) return null;

            int start = colon + 1;
            while (start < json.Length && char.IsWhiteSpace(json[start])) start++;
            if (start >= json.Length) return null;

            if (json[start] == '"')
            {
                int end = json.IndexOf('"', start + 1);
                while (end > start && json[end - 1] == '\\')
                {
                    end = json.IndexOf('"', end + 1);
                }
                if (end > start)
                    return json.Substring(start + 1, end - start - 1);
            }
            else if (json[start] == '{' || json[start] == '[')
            {
                char openChar = json[start];
                char closeChar = openChar == '{' ? '}' : ']';
                int depth = 0;
                for (int i = start; i < json.Length; i++)
                {
                    if (json[i] == openChar) depth++;
                    else if (json[i] == closeChar)
                    {
                        depth--;
                        if (depth == 0)
                        {
                            return json.Substring(start, i - start + 1);
                        }
                    }
                }
            }
            else
            {
                int end = start;
                while (end < json.Length && json[end] != ',' && json[end] != ';' && json[end] != '}' && json[end] != ']' && !char.IsWhiteSpace(json[end]))
                {
                    end++;
                }
                return json.Substring(start, end - start);
            }
            return null;
        }

        private static List<string> ExtractStringList(string json, string key)
        {
            List<string> result = new List<string>();
            if (string.IsNullOrEmpty(json) || string.IsNullOrEmpty(key)) return result;

            int idx = json.IndexOf($"\"{key}\"", StringComparison.OrdinalIgnoreCase);
            if (idx < 0) idx = json.IndexOf($"{key}:", StringComparison.OrdinalIgnoreCase);
            if (idx < 0) return result;

            int bracket = json.IndexOf('[', idx);
            if (bracket < 0) return result;

            int depth = 0;
            int itemStart = -1;

            for (int i = bracket + 1; i < json.Length; i++)
            {
                char c = json[i];
                if (c == '[' || c == '{')
                {
                    if (depth == 0) itemStart = i;
                    depth++;
                }
                else if (c == ']' || c == '}')
                {
                    depth--;
                    if (depth == 0 && itemStart >= 0)
                    {
                        result.Add(json.Substring(itemStart, i - itemStart + 1));
                        itemStart = -1;
                    }
                    else if (depth < 0)
                    {
                        break;
                    }
                }
                else if (c == '"' && depth == 0)
                {
                    int strEnd = json.IndexOf('"', i + 1);
                    while (strEnd > i && json[strEnd - 1] == '\\') strEnd = json.IndexOf('"', strEnd + 1);
                    if (strEnd > i)
                    {
                        result.Add(json.Substring(i + 1, strEnd - i - 1));
                        i = strEnd;
                    }
                }
            }

            return result;
        }


        public static PuzzleType ParsePuzzleType(string typeStr)
        {
            if (string.IsNullOrEmpty(typeStr)) return PuzzleType.NumberMatrix;
            string norm = typeStr.ToLower().Replace("-", "_");
            switch (norm)
            {
                case "number_matrix": case "matrix": return PuzzleType.NumberMatrix;
                case "sequence": case "ordering": return PuzzleType.Sequence;
                case "pattern": case "rotate": return PuzzleType.Pattern;
                case "logical_reasoning": case "logic": case "matching": case "riddle": return PuzzleType.LogicalReasoning;
                case "mathematics": case "math": return PuzzleType.Mathematics;
                case "communication": case "communication_skills": return PuzzleType.Communication;
                case "english": case "verbal_reasoning": return PuzzleType.English;
                case "interview_preparation": case "decision": case "scenario": return PuzzleType.InterviewPreparation;
                case "ai": case "artificial_intelligence": case "cloud_computing": case "cyber_security": return PuzzleType.ArtificialIntelligence;
                case "problem_solving": case "critical_thinking": return PuzzleType.ProblemSolving;
                default: return PuzzleType.NumberMatrix;
            }
        }

        public static PuzzleInteractionType ParseInteractionType(string interStr)
        {
            if (string.IsNullOrEmpty(interStr)) return PuzzleInteractionType.TileSelection;
            string norm = interStr.ToLower().Replace("-", "_");
            switch (norm)
            {
                case "tile_selection": case "tile": return PuzzleInteractionType.TileSelection;
                case "sequence_order": case "ordering": case "sequence": return PuzzleInteractionType.SequenceOrder;
                case "rotate_symbol": case "rotate": return PuzzleInteractionType.RotateSymbol;
                case "switch_mechanism": case "switch": return PuzzleInteractionType.SwitchMechanism;
                case "move_and_place": case "move": case "matching": return PuzzleInteractionType.MoveAndPlace;
                case "decision_plate": case "decision": case "multiple_choice": return PuzzleInteractionType.DecisionPlate;
                case "text_input": return PuzzleInteractionType.TextInput;
                case "true_false": return PuzzleInteractionType.TrueFalse;
                default: return PuzzleInteractionType.TileSelection;
            }
        }

        public static int ParseDifficultyLevel(string diffStr)
        {
            if (string.IsNullOrEmpty(diffStr)) return 3;
            string norm = diffStr.ToLower();
            switch (norm)
            {
                case "beginner": case "easy": return 1;
                case "novice": return 2;
                case "skilled": case "medium": return 3;
                case "expert": case "hard": return 4;
                case "master": return 5;
                case "legend": return 6;
                default: return 3;
            }
        }

        public static EnvironmentTheme ParseTheme(string themeStr)
        {
            if (string.IsNullOrEmpty(themeStr)) return EnvironmentTheme.Dungeon;
            string norm = themeStr.ToLower();
            switch (norm)
            {
                case "dungeon": return EnvironmentTheme.Dungeon;
                case "dark": return EnvironmentTheme.Dark;
                case "medieval": return EnvironmentTheme.Medieval;
                case "alchemy": return EnvironmentTheme.Alchemy;
                default: return EnvironmentTheme.Dungeon;
            }
        }
        #endregion
    }
}
