using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Ascendra.Audio;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Main Runtime Controller for ASCENDRA JSON-Driven 3D Puzzle Environment System.
    /// Manages the full lifecycle: API JSON parsing -> spatial environment planning -> 3D asset generation -> 
    /// player staging -> 3D physical interaction -> validation -> cleanup -> exploration restoration.
    /// </summary>
    public class PuzzleEnvironmentRuntime : MonoBehaviour
    {
        public static PuzzleEnvironmentRuntime Instance { get; private set; }

        [Header("Generated Environment")]
        [SerializeField]
        private Transform generatedPuzzleEnvironment;

        [Header("Puzzle World / Staging")]
        [SerializeField]
        private Transform puzzleStagingPoint;

        [Header("Player")]
        [SerializeField]
        private Transform playerTransform;

        [Header("Camera")]
        [SerializeField]
        private Camera puzzleCamera;

        [Header("Existing Systems")]
        [SerializeField]
        private PuzzleThemeEngine themeEngine;

        [Header("Generation Settings")]
        [SerializeField]
        private bool autoGenerateFromClue = true;
        public bool AutoGenerateFromClue => autoGenerateFromClue;

        [SerializeField]
        private bool clearPreviousPuzzle = true;

        [SerializeField]
        private bool isolatePuzzleEnvironment = true;

        [SerializeField]
        private bool returnToExplorationAfterCompletion = true;

        [SerializeField]
        private bool autoPositionCamera = true;

        [Header("Static Village Puzzle Settings")]
        [SerializeField]
        private bool autoGenerateStaticOnStart = true;

        [SerializeField]
        private Vector3 villageDefaultStagingPos = new Vector3(75.0f, 21.63f, 53.0f);

        [Header("Debug")]
        [SerializeField]
        private bool enableDebugLogs = true;

        // Runtime Saved State (Temporary)
        private Vector3 savedPlayerPosition;
        private Quaternion savedPlayerRotation;
        private MonoBehaviour playerMovementScript;
        private bool isPuzzleActive = false;
        private PuzzleData activePuzzleData;
        private PuzzleEnvironmentPlan activePlan;
        private List<GameObject> runtimeSpawnedObjects = new List<GameObject>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            ValidateComponents();
        }

        private void Start()
        {
            if (autoGenerateStaticOnStart)
            {
                if (generatedPuzzleEnvironment == null || generatedPuzzleEnvironment.childCount == 0)
                {
                    LoadAndGenerateStaticVillagePuzzle();
                }
            }
        }

        public void LoadAndGenerateStaticVillagePuzzle()
        {
            TextAsset asset = Resources.Load<TextAsset>("Puzzles/static_village_puzzle");
            if (asset != null && !string.IsNullOrEmpty(asset.text))
            {
                if (enableDebugLogs) Debug.Log("[PuzzleEnvironmentRuntime] Auto-generating static village puzzle in scene on Start...");
                GenerateFromPuzzleJson(asset.text);
            }
        }

        private void OnEnable()
        {
            PuzzleEventBus.OnPuzzleSolved += OnPuzzleCompleted;
        }

        private void OnDisable()
        {
            PuzzleEventBus.OnPuzzleSolved -= OnPuzzleCompleted;
        }

        private void ValidateComponents()
        {
            if (generatedPuzzleEnvironment == null)
            {
                GameObject genObj = GameObject.Find("PuzzleEnvironmentRoot");
                if (genObj == null)
                {
                    genObj = GameObject.Find("GeneratedPuzzleEnvironment");
                }
                if (genObj == null)
                {
                    genObj = new GameObject("PuzzleEnvironmentRoot");
                    genObj.transform.SetParent(transform, false);
                }
                else
                {
                    genObj.name = "PuzzleEnvironmentRoot";
                }
                generatedPuzzleEnvironment = genObj.transform;
            }
            else
            {
                generatedPuzzleEnvironment.gameObject.name = "PuzzleEnvironmentRoot";
            }

            if (puzzleStagingPoint == null)
            {
                GameObject stagingObj = GameObject.Find("PuzzleStagingPoint");
                if (stagingObj == null)
                {
                    stagingObj = new GameObject("PuzzleStagingPoint");
                    stagingObj.transform.position = new Vector3(0f, 50f, 0f); // Elevated staging isolated from village
                }
                puzzleStagingPoint = stagingObj.transform;
            }

            if (playerTransform == null)
            {
                GameObject playerObj = GameObject.FindWithTag("Player");
                if (playerObj != null)
                {
                    playerTransform = playerObj.transform;
                }
                else
                {
                    if (enableDebugLogs) Debug.LogWarning("[PuzzleEnvironment] Missing Player Transform.");
                }
            }

            if (puzzleCamera == null)
            {
                puzzleCamera = Camera.main;
            }

            if (themeEngine == null)
            {
                themeEngine = PuzzleThemeEngine.Instance;
            }
        }

        /// <summary>
        /// Generates a dynamic 3D puzzle environment from raw API JSON.
        /// </summary>
        public void GenerateFromPuzzleJson(string json)
        {
            if (string.IsNullOrEmpty(json))
            {
                Debug.LogError("[PuzzleEnvironment] Invalid or empty puzzle JSON string.");
                return;
            }

            PuzzleData data = PuzzleData.ParseJson(json);
            GeneratePuzzle(data);
        }

        /// <summary>
        /// Core runtime generator receiving PuzzleData.
        /// </summary>
        public void GeneratePuzzle(PuzzleData data)
        {
            if (data == null)
            {
                Debug.LogError("[PuzzleEnvironment] Null PuzzleData provided.");
                return;
            }

            if (enableDebugLogs)
            {
                Debug.Log($"[PuzzleEnvironment] Received puzzle: {data.puzzleId}");
                Debug.Log($"[PuzzleEnvironment] Puzzle type: {data.puzzleType}");
                Debug.Log($"[PuzzleEnvironment] Theme: {data.theme}");
                Debug.Log($"[PuzzleEnvironment] Mechanism: {PuzzleEnvironmentPlanner.CreatePlan(data, Vector3.zero).mechanismType}");
            }

            if (clearPreviousPuzzle)
            {
                ClearGeneratedPuzzleEnvironment();
            }

            activePuzzleData = data;
            isPuzzleActive = true;

            // 1. Save Exploration Player & Controls state
            SaveExplorationState();

            // 2. Create Spatial Plan via Planner in front of player in village
            Vector3 stagingOrigin;
            if (playerTransform != null)
            {
                stagingOrigin = playerTransform.position + playerTransform.forward * 4.5f;
                stagingOrigin.y = playerTransform.position.y;
            }
            else if (puzzleStagingPoint != null && puzzleStagingPoint.position.z > -100f)
            {
                stagingOrigin = puzzleStagingPoint.position;
            }
            else
            {
                stagingOrigin = villageDefaultStagingPos;
            }

            activePlan = PuzzleEnvironmentPlanner.CreatePlan(activePuzzleData, stagingOrigin);

            if (enableDebugLogs)
            {
                Debug.Log($"[PuzzleEnvironment] Plan created: {activePlan.gridRows}x{activePlan.gridColumns} at village origin {stagingOrigin}");
                Debug.Log("[PuzzleEnvironment] Generating environment...");
            }

            PuzzleEventBus.TriggerPuzzleReceived(activePuzzleData);
            PuzzleEventBus.TriggerPuzzleEnvironmentGenerating(activePlan);

            // 3. Spawn 3D Puzzle Environment GameObjects
            List<GameObject> spawned = PuzzleElementSpawner.SpawnPuzzleEnvironment(activePlan, generatedPuzzleEnvironment);
            if (spawned != null)
            {
                runtimeSpawnedObjects.AddRange(spawned);
            }

            if (enableDebugLogs)
            {
                Debug.Log($"[PuzzleEnvironment] Puzzle generation complete. Spawned {runtimeSpawnedObjects.Count} objects.");
            }

            // 4. Turn Player to face puzzle in village
            if (playerTransform != null)
            {
                Vector3 lookTarget = activePlan.boundsCenter;
                lookTarget.y = playerTransform.position.y;
                if ((lookTarget - playerTransform.position).sqrMagnitude > 0.01f)
                {
                    playerTransform.rotation = Quaternion.LookRotation(lookTarget - playerTransform.position);
                }
            }


            // 5. Position Camera & Frame Puzzle
            if (autoPositionCamera)
            {
                if (PuzzleCameraController.Instance != null)
                {
                    PuzzleCameraController.Instance.FocusOnPuzzle(activePlan);
                }
                else
                {
                    if (puzzleCamera == null) puzzleCamera = Camera.main;
                    if (puzzleCamera != null)
                    {
                        puzzleCamera.transform.position = activePlan.cameraPosition;
                        puzzleCamera.transform.rotation = Quaternion.LookRotation(activePlan.cameraTarget - activePlan.cameraPosition);
                        puzzleCamera.fieldOfView = activePlan.cameraFieldOfView;
                        if (enableDebugLogs) Debug.Log($"[PuzzleEnvironment] Framed camera on puzzle plan at {activePlan.cameraPosition}");
                    }
                }
            }

            // 6. Set Music State to Puzzle & adjust intensity to match difficulty
            if (BackgroundMusicManager.Instance != null)
            {
                BackgroundMusicManager.Instance.SetState(MusicState.Puzzle);
                if (activePlan != null)
                {
                    BackgroundMusicManager.Instance.SetVolume(activePlan.audioIntensity);
                }
            }

            // 7. Enable Physical 3D Interaction & Validator
            if (PuzzleInteractionBinder.Instance != null)
            {
                PuzzleInteractionBinder.Instance.EnableInteraction(true);
            }

            if (PuzzleObjectiveValidator.Instance != null)
            {
                PuzzleObjectiveValidator.Instance.SetCurrentPuzzle(activePuzzleData);
            }

            PuzzleEventBus.TriggerPuzzleEnvironmentReady(activePlan);
        }

        private void SaveExplorationState()
        {
            if (playerTransform != null)
            {
                savedPlayerPosition = playerTransform.position;
                savedPlayerRotation = playerTransform.rotation;

                // Disable player movement controller during puzzle mode
                playerMovementScript = (playerTransform.GetComponent<PlayerMovement>() ?? playerTransform.GetComponentInChildren<PlayerMovement>()) as MonoBehaviour;
                if (playerMovementScript != null)
                {
                    playerMovementScript.enabled = false;
                }
            }
        }

        /// <summary>
        /// Handles puzzle completion flow upon validation success.
        /// </summary>
        public void OnPuzzleCompleted(string puzzleId)
        {
            if (!isPuzzleActive) return;

            if (enableDebugLogs)
            {
                Debug.Log($"[PuzzleEnvironment] Puzzle completed: {puzzleId}");
            }

            StartCoroutine(PuzzleCompletionRoutine());
        }

        private IEnumerator PuzzleCompletionRoutine()
        {
            // Disable interactions
            if (PuzzleInteractionBinder.Instance != null)
            {
                PuzzleInteractionBinder.Instance.EnableInteraction(false);
            }

            // Play Victory Music state
            if (BackgroundMusicManager.Instance != null)
            {
                BackgroundMusicManager.Instance.SetState(MusicState.Victory, fadeDuration: 1.0f);
            }

            yield return new WaitForSeconds(1.5f);

            if (returnToExplorationAfterCompletion)
            {
                if (enableDebugLogs)
                {
                    Debug.Log("[PuzzleEnvironment] Clearing generated environment.");
                }

                ClearGeneratedPuzzleEnvironment();

                if (enableDebugLogs)
                {
                    Debug.Log("[PuzzleEnvironment] Returning player to exploration.");
                }

                // Restore Player Transform
                if (playerTransform != null)
                {
                    CharacterController cc = playerTransform.GetComponent<CharacterController>();
                    if (cc != null) cc.enabled = false;

                    playerTransform.position = savedPlayerPosition;
                    playerTransform.rotation = savedPlayerRotation;

                    if (cc != null) cc.enabled = true;

                    if (playerMovementScript != null)
                    {
                        playerMovementScript.enabled = true;
                    }
                }

                // Restore Exploration Camera
                if (PuzzleCameraController.Instance != null)
                {
                    PuzzleCameraController.Instance.RestoreExplorationCamera();
                }

                // Restore Exploration Music
                if (BackgroundMusicManager.Instance != null)
                {
                    BackgroundMusicManager.Instance.SetState(MusicState.Exploration, fadeDuration: 1.5f);
                    BackgroundMusicManager.Instance.SetVolume(0.5f);
                }

                // Update Quest System
                if (QuestManager.Instance != null)
                {
                    QuestManager.Instance.UpdateObjective("Follow the clue to the next location");
                }
            }

            isPuzzleActive = false;
        }

        /// <summary>
        /// Clears and destroys all generated runtime puzzle GameObjects.
        /// </summary>
        public void ClearGeneratedPuzzleEnvironment()
        {
            if (generatedPuzzleEnvironment != null)
            {
                for (int i = generatedPuzzleEnvironment.childCount - 1; i >= 0; i--)
                {
                    Transform child = generatedPuzzleEnvironment.GetChild(i);
                    if (child != null)
                    {
                        Destroy(child.gameObject);
                    }
                }
            }

            runtimeSpawnedObjects.Clear();
            activePuzzleData = null;
            activePlan = null;

            PuzzleEventBus.TriggerPuzzleEnvironmentDestroyed();
        }

        /// <summary>
        /// Development editor test runner method.
        /// </summary>
        [ContextMenu("Generate From Test JSON")]
        public void GenerateFromTestJson()
        {
            string testJson = @"{
                ""puzzleId"": ""TEST_MATRIX_001"",
                ""puzzleType"": ""number_matrix"",
                ""difficulty"": ""medium"",
                ""theme"": ""dungeon"",
                ""question"": ""Complete the 3x3 stone tile matrix series."",
                ""layout"": { ""rows"": 3, ""columns"": 3 },
                ""elements"": [
                    { ""id"": ""tile_1"", ""value"": ""2"", ""label"": ""2"" },
                    { ""id"": ""tile_2"", ""value"": ""4"", ""label"": ""4"" },
                    { ""id"": ""tile_3"", ""value"": ""6"", ""label"": ""6"" },
                    { ""id"": ""tile_4"", ""value"": ""8"", ""label"": ""8"" },
                    { ""id"": ""tile_5"", ""value"": ""??"", ""label"": ""??"" },
                    { ""id"": ""tile_6"", ""value"": ""12"", ""label"": ""12"" },
                    { ""id"": ""tile_7"", ""value"": ""14"", ""label"": ""14"" },
                    { ""id"": ""tile_8"", ""value"": ""16"", ""label"": ""16"" },
                    { ""id"": ""tile_9"", ""value"": ""18"", ""label"": ""18"" }
                ],
                ""answer"": ""??""
            }";

            GenerateFromPuzzleJson(testJson);
        }
    }
}
