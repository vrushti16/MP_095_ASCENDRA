using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;
using Ascendra.Audio;
using Ascendra.DynamicEnvironment;

public class FirstClue : MonoBehaviour
{
    [System.Serializable]
    public struct CluePuzzleProfile
    {
        public string title;
        public string topic;
        public string difficulty;
        public string type;
        public string interactionType;
        [TextArea(2, 4)]
        public string description;
    }

    [Header("Clue State")]
    private bool puzzleOpened = false;
    private bool clueSolved = false;
    public bool allowRetriggerAfterCompletion = true;

    public GameObject puzzlePanel;
    public GameObject cluePanel;

    [Header("Dynamic Clue Variation System")]
    [Tooltip("If enabled, every trigger cycles to a different puzzle topic, mechanism, theme, and 3D environment.")]
    public bool cyclePuzzlesEachTrigger = true;
    public int currentProfileIndex = 0;

    [SerializeField]
    private List<CluePuzzleProfile> puzzleProfiles = new List<CluePuzzleProfile>()
    {
        new CluePuzzleProfile {
            title = "Ancient Rune Number Matrix",
            topic = "aptitude",
            difficulty = "medium",
            type = "number_matrix",
            interactionType = "tile_selection",
            description = "Ancient stone matrix with carved rune monuments and torch flames."
        },
        new CluePuzzleProfile {
            title = "Harmonic Ruin Sequence",
            topic = "pattern_recognition",
            difficulty = "easy",
            type = "sequence",
            interactionType = "sequence_order",
            description = "Semi-circular arc of ancient pillars, amphoras, and glowing monoliths."
        },
        new CluePuzzleProfile {
            title = "Alchemical Essence Trial",
            topic = "logic",
            difficulty = "medium",
            type = "problem_solving",
            interactionType = "decision_plate",
            description = "Alchemical laboratory platform with cauldrons, potion flasks, and gems."
        },
        new CluePuzzleProfile {
            title = "Tome of Ancient Secrets",
            topic = "cryptography",
            difficulty = "hard",
            type = "riddle",
            interactionType = "multiple_choice",
            description = "Library study platform with ancient big books, codices, and warm candlelight."
        },
        new CluePuzzleProfile {
            title = "Vault of Numeric Relics",
            topic = "mathematics",
            difficulty = "medium",
            type = "mathematics",
            interactionType = "tile_selection",
            description = "Crypt vault with chests, stone slabs, hourglasses, and dark atmosphere."
        }
    };

    [Header("AI Service Live Endpoint Settings")]
    public bool useLiveAiBackend = false;
    public bool useSamplePuzzleForTesting = false;
    public string aiBackendUrl = "http://localhost:8000/api/v1/ai/puzzles/generate";
    public float apiTimeoutSeconds = 30.0f;

    [Header("Static JSON Puzzle Asset Settings")]
    [Tooltip("If enabled, loads the static JSON puzzle file directly without network dependency.")]
    public bool useStaticJsonFile = true;
    public TextAsset staticPuzzleAsset;

    [Header("Sample AI JSON Override (Master Prompt Format Fallback)")]
    [TextArea(5, 15)]
    public string samplePuzzleJson = @"{
        ""puzzleId"": ""PZ-001"",
        ""category"": ""aptitude"",
        ""difficulty"": ""medium"",
        ""difficulty_level"": 3,
        ""title"": ""Ancient Stone Number Matrix"",
        ""puzzleType"": ""number_matrix"",
        ""taskType"": ""aptitude"",
        ""theme"": ""dungeon"",
        ""interactionType"": ""tile_selection"",
        ""environment"": {
            ""type"": ""dungeon_chamber"",
            ""theme"": ""ancient_dungeon"",
            ""primary_asset_pack"": ""DUNGEON_LOWPOLY_PACK"",
            ""secondary_asset_packs"": [""LOW_POLY_MEDIEVAL_PROPS""]
        },
        ""story"": {
            ""context"": ""An ancient mechanical stone matrix seals the inner ruin chamber."",
            ""discovery"": ""The central pedestal rotates as azure energy flows through stone grooves.""
        },
        ""objective"": {
            ""type"": ""mechanism_activation"",
            ""description"": ""Align the missing stone tile value (??) in the 3x3 numerical resonance grid.""
        },
        ""mechanism"": {
            ""type"": ""number_wheels"",
            ""stages"": 1,
            ""interaction_model"": ""physical_world_interaction""
        },
        ""layout"": { ""rows"": 3, ""columns"": 3 },
        ""elements"": [
            { ""id"": ""t1"", ""value"": ""12"", ""label"": ""12"", ""type"": ""number_tile"" },
            { ""id"": ""t2"", ""value"": ""18"", ""label"": ""18"", ""type"": ""number_tile"" },
            { ""id"": ""t3"", ""value"": ""24"", ""label"": ""24"", ""type"": ""number_tile"" },
            { ""id"": ""t4"", ""value"": ""30"", ""label"": ""30"", ""type"": ""number_tile"" },
            { ""id"": ""t5"", ""value"": ""??"", ""label"": ""??"", ""type"": ""number_tile"" },
            { ""id"": ""t6"", ""value"": ""42"", ""label"": ""42"", ""type"": ""number_tile"" },
            { ""id"": ""t7"", ""value"": ""48"", ""label"": ""48"", ""type"": ""number_tile"" },
            { ""id"": ""t8"", ""value"": ""54"", ""label"": ""54"", ""type"": ""number_tile"" },
            { ""id"": ""t9"", ""value"": ""60"", ""label"": ""60"", ""type"": ""number_tile"" }
        ],
        ""clues"": [
            {
                ""id"": ""clue_01"",
                ""type"": ""environmental_mural"",
                ""location"": ""north_wall"",
                ""content"": ""Each stone tile increases by a steady harmonic increment of 6."",
                ""discoverable"": true
            }
        ],
        ""answer"": ""36"",
        ""validation"": {
            ""type"": ""state_based"",
            ""validation_rule"": ""sequence_match"",
            ""required_state"": { ""t5"": ""36"" },
            ""allow_retry"": true
        }
    }";

    public string GetStaticPuzzleJsonContent()
    {
        if (staticPuzzleAsset != null && !string.IsNullOrEmpty(staticPuzzleAsset.text))
        {
            return staticPuzzleAsset.text;
        }

        TextAsset loadedAsset = Resources.Load<TextAsset>("Puzzles/static_village_puzzle");
        if (loadedAsset != null && !string.IsNullOrEmpty(loadedAsset.text))
        {
            return loadedAsset.text;
        }

        return samplePuzzleJson;
    }

    private void Start()
    {
        if (puzzlePanel != null)
            puzzlePanel.SetActive(false);

        if (cluePanel != null)
            cluePanel.SetActive(false);
    }

    private void OnEnable()
    {
        PuzzleEventBus.OnPuzzleSolved += OnPuzzleSolvedEvent;
        PuzzleEventBus.OnPuzzleEnvironmentDestroyed += OnEnvironmentCleanedUp;
    }

    private void OnDisable()
    {
        PuzzleEventBus.OnPuzzleSolved -= OnPuzzleSolvedEvent;
        PuzzleEventBus.OnPuzzleEnvironmentDestroyed -= OnEnvironmentCleanedUp;
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player"))
            return;

        if (puzzleOpened)
            return;

        // If solved and retrigger is not allowed, ignore
        if (clueSolved && !allowRetriggerAfterCompletion)
            return;

        puzzleOpened = true;

        GameObject playerObj = other.gameObject;
        CharacterController cc = playerObj.GetComponent<CharacterController>() ?? playerObj.GetComponentInParent<CharacterController>();
        if (cc != null)
        {
            playerObj = cc.gameObject;
        }

        Vector3 triggerPlayerPos = playerObj.transform.position;
        Quaternion triggerPlayerRot = playerObj.transform.rotation;

        Debug.Log($"[ASCENDRA EXPLORATION] Player reached clue trigger at {triggerPlayerPos}! Initializing puzzle...");
        OpenPuzzle(playerObj, triggerPlayerPos, triggerPlayerRot);
    }

    private void OpenPuzzle(GameObject playerObj = null, Vector3? triggerPlayerPos = null, Quaternion? triggerPlayerRot = null)
    {
        // Dedicated 3D puzzle encounter: Keep 2D quiz UI disabled
        if (puzzlePanel != null)
            puzzlePanel.SetActive(false);

        if (useStaticJsonFile || useSamplePuzzleForTesting)
        {
            Debug.Log("[ASCENDRA PUZZLE] Mode: Loading static puzzle JSON...");
            InstantiatePuzzle(GetStaticPuzzleJsonContent(), playerObj, triggerPlayerPos, triggerPlayerRot);
        }
        else if (useLiveAiBackend)
        {
            StartCoroutine(FetchAndOpenPuzzle(playerObj, triggerPlayerPos, triggerPlayerRot));
        }
        else
        {
            Debug.Log("[ASCENDRA PUZZLE] Testing Mode: Using sample AI JSON override.");
            InstantiatePuzzle(GetStaticPuzzleJsonContent(), playerObj, triggerPlayerPos, triggerPlayerRot);
        }
    }

    private IEnumerator FetchAndOpenPuzzle(GameObject playerObj = null, Vector3? triggerPlayerPos = null, Quaternion? triggerPlayerRot = null)
    {
        // Select active profile
        CluePuzzleProfile activeProfile = GetActiveProfile();

        Debug.Log($"[AI Puzzle] Requesting puzzle profile #{currentProfileIndex}: '{activeProfile.title}'");
        Debug.Log($"[AI Puzzle] Topic: {activeProfile.topic} | Type: {activeProfile.type} | Difficulty: {activeProfile.difficulty}");
        Debug.Log($"[AI Puzzle] Endpoint: {aiBackendUrl}");

        string requestJson = $"{{\"topic\":\"{activeProfile.topic}\",\"difficulty\":\"{activeProfile.difficulty}\",\"type\":\"{activeProfile.type}\",\"interactionType\":\"{activeProfile.interactionType}\"}}";

        using (UnityWebRequest request = new UnityWebRequest(aiBackendUrl, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(requestJson);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = Mathf.RoundToInt(apiTimeoutSeconds);

            yield return request.SendWebRequest();

            long responseCode = request.responseCode;
            string responseBody = request.downloadHandler != null ? request.downloadHandler.text : "";

            Debug.Log($"[AI Puzzle] HTTP Status: {responseCode}");

            if (request.result == UnityWebRequest.Result.Success && responseCode == 200)
            {
                Debug.Log("[AI Puzzle] Response received successfully!");
                PuzzleData puzzleData = PuzzleData.FromJson(responseBody);
                string puzzleId = puzzleData != null && !string.IsNullOrEmpty(puzzleData.puzzleId) ? puzzleData.puzzleId : "UNKNOWN";
                string puzzleType = puzzleData != null ? (!string.IsNullOrEmpty(puzzleData.rawPuzzleType) ? puzzleData.rawPuzzleType : puzzleData.puzzleType.ToString()) : "N/A";
                string difficulty = puzzleData != null ? puzzleData.difficulty : "N/A";
                string theme = puzzleData != null ? puzzleData.theme.ToString() : "N/A";

                Debug.Log($"[AI Puzzle] Puzzle ID: {puzzleId} | Type: {puzzleType} | Theme: {theme} | Diff: {difficulty}");

                // Prepare next profile for the subsequent clue trigger
                if (cyclePuzzlesEachTrigger && puzzleProfiles.Count > 0)
                {
                    currentProfileIndex = (currentProfileIndex + 1) % puzzleProfiles.Count;
                }

                InstantiatePuzzle(responseBody, playerObj, triggerPlayerPos, triggerPlayerRot);
            }
            else
            {
                string errorMsg = !string.IsNullOrEmpty(request.error) ? request.error : $"HTTP {responseCode}: {responseBody}";
                Debug.LogWarning($"[AI Puzzle] Live AI endpoint unavailable ({errorMsg}). Gracefully falling back to static village puzzle!");
                InstantiatePuzzle(GetStaticPuzzleJsonContent(), playerObj, triggerPlayerPos, triggerPlayerRot);
            }
        }
    }

    private CluePuzzleProfile GetActiveProfile()
    {
        if (puzzleProfiles != null && puzzleProfiles.Count > 0)
        {
            int idx = Mathf.Clamp(currentProfileIndex, 0, puzzleProfiles.Count - 1);
            return puzzleProfiles[idx];
        }

        return new CluePuzzleProfile
        {
            title = "Default Aptitude",
            topic = "aptitude",
            difficulty = "medium",
            type = "number_matrix",
            interactionType = "tile_selection"
        };
    }

    private void InstantiatePuzzle(string puzzleJson, GameObject playerObj = null, Vector3? triggerPlayerPos = null, Quaternion? triggerPlayerRot = null)
    {
        Debug.Log("[ASCENDRA PUZZLE] Triggering Dedicated 3D Puzzle Encounter from JSON...");

        PuzzleEncounterManager encounterMgr = PuzzleEncounterManager.Instance;
        if (encounterMgr == null)
        {
            GameObject mgrObj = new GameObject("PuzzleEncounterManager");
            encounterMgr = mgrObj.AddComponent<PuzzleEncounterManager>();
        }

        encounterMgr.StartEncounter(puzzleJson, playerObj, triggerPlayerPos, triggerPlayerRot);
    }

    private void OnPuzzleSolvedEvent(string puzzleId)
    {
        if (clueSolved) return;
        PuzzleSolved();
    }

    public void PuzzleSolved()
    {
        if (clueSolved) return;
        clueSolved = true;

        Debug.Log("[ASCENDRA PUZZLE] Puzzle Solved! Updating clue state...");

        if (puzzlePanel != null)
            puzzlePanel.SetActive(false);

        if (cluePanel != null)
            cluePanel.SetActive(true);

        if (QuestManager.Instance != null)
        {
            QuestManager.Instance.UpdateObjective("Follow the clue to the next location");
        }
    }

    private void OnEnvironmentCleanedUp()
    {
        // When environment is destroyed and player is back to exploration
        if (allowRetriggerAfterCompletion)
        {
            Debug.Log("[FirstClue] Puzzle environment destroyed. Clue trigger reset for next dynamic puzzle!");
            puzzleOpened = false;
            clueSolved = false;

            if (cluePanel != null)
                cluePanel.SetActive(false);
        }
    }
}
