using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using Ascendra.Audio;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Orchestrates the dedicated adventure puzzle encounter lifecycle:
    /// 1. Seamless fade transition upon entering puzzle trigger.
    /// 2. Hides main-world objects, NPCs, terrain, environment, and unrelated UI.
    /// 3. Saves exact player position and camera state.
    /// 4. Places player in front of the 3D puzzle with cinematic inspection framing.
    /// 5. Enables direct 3D physical manipulation and hover highlighting.
    /// 6. Validates in-world state with subtle feedback (no quiz UI).
    /// 7. On solve: plays fanfare, restores main world, returns player to exact spot, and resumes exploration.
    /// </summary>
    public class PuzzleEncounterManager : MonoBehaviour
    {
        public static PuzzleEncounterManager Instance { get; private set; }

        [Header("Staging Settings")]
        [Tooltip("Isolated staging origin high above or secluded from the main world.")]
        public Vector3 dedicatedStagingOrigin = new Vector3(0f, 60f, 0f);

        [Header("Timing")]
        public float fadeDuration = 0.45f;
        public float solveCelebrationDelay = 1.8f;

        [Header("State")]
        public bool isInEncounter = false;

        private Vector3 savedPlayerPosition;
        private Quaternion savedPlayerRotation;
        private Vector3 savedCameraPosition;
        private Quaternion savedCameraRotation;
        private float savedCameraFov;

        private List<GameObject> isolatedWorldObjects = new List<GameObject>();
        private List<Canvas> isolatedCanvases = new List<Canvas>();

        private Transform playerTransform;
        private MonoBehaviour playerMovementScript;
        private CharacterController playerController;
        private Camera targetCamera;

        private PuzzleData activePuzzleData;
        private PuzzleEnvironmentPlan activePlan;
        private Transform puzzleContainer;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            ResolveReferences();
        }

        private void OnEnable()
        {
            PuzzleEventBus.OnPuzzleSolved += OnPuzzleCompleted;
        }

        private void OnDisable()
        {
            PuzzleEventBus.OnPuzzleSolved -= OnPuzzleCompleted;
        }

        private void ResolveReferences()
        {
            if (targetCamera == null) targetCamera = Camera.main;

            if (playerTransform == null)
            {
                GameObject player = GameObject.FindWithTag("Player");
                if (player == null) player = GameObject.Find("Huscarl");
                if (player == null) player = GameObject.Find("PlayerRoot");
                if (player != null)
                {
                    CharacterController cc = player.GetComponent<CharacterController>() ?? player.GetComponentInChildren<CharacterController>();
                    if (cc != null)
                    {
                        playerTransform = cc.transform;
                        playerController = cc;
                    }
                    else
                    {
                        playerTransform = player.transform;
                        playerController = player.GetComponent<CharacterController>();
                    }
                    playerMovementScript = (playerTransform.GetComponent<PlayerMovement>() ?? playerTransform.GetComponentInChildren<PlayerMovement>() ?? playerTransform.GetComponentInParent<PlayerMovement>()) as MonoBehaviour;
                }
            }

            // Ensure Audio Synthesizer and Screen Fader exist
            if (PuzzleAudioSynthesizer.Instance == null)
            {
                gameObject.AddComponent<PuzzleAudioSynthesizer>();
            }

            PuzzleScreenFader.GetOrCreate();
        }

        /// <summary>
        /// Entry point: Starts the dedicated puzzle encounter from raw JSON or parsed data.
        /// </summary>
        public void StartEncounter(string puzzleJson, GameObject playerObj = null, Vector3? overridePlayerPos = null, Quaternion? overridePlayerRot = null)
        {
            if (string.IsNullOrEmpty(puzzleJson)) return;
            PuzzleData data = PuzzleData.ParseJson(puzzleJson);
            StartEncounter(data, playerObj, overridePlayerPos, overridePlayerRot);
        }

        /// <summary>
        /// Initiates the seamless dedicated puzzle encounter.
        /// </summary>
        public void StartEncounter(PuzzleData data, GameObject playerObj = null, Vector3? overridePlayerPos = null, Quaternion? overridePlayerRot = null)
        {
            if (isInEncounter || data == null) return;
            isInEncounter = true;
            activePuzzleData = data;

            if (playerObj != null)
            {
                CharacterController cc = playerObj.GetComponent<CharacterController>() ?? playerObj.GetComponentInChildren<CharacterController>();
                if (cc != null)
                {
                    playerTransform = cc.transform;
                    playerController = cc;
                }
                else
                {
                    playerTransform = playerObj.transform;
                    playerController = playerObj.GetComponent<CharacterController>();
                }
                playerMovementScript = (playerTransform.GetComponent<PlayerMovement>() ?? playerTransform.GetComponentInChildren<PlayerMovement>() ?? playerTransform.GetComponentInParent<PlayerMovement>()) as MonoBehaviour;
            }
            else
            {
                ResolveReferences();
            }

            if (overridePlayerPos.HasValue)
            {
                savedPlayerPosition = overridePlayerPos.Value;
                savedPlayerRotation = overridePlayerRot ?? (playerTransform != null ? playerTransform.rotation : Quaternion.identity);
            }
            else if (playerTransform != null)
            {
                savedPlayerPosition = playerTransform.position;
                savedPlayerRotation = playerTransform.rotation;
            }
            Debug.Log($"[PuzzleEncounter] SAVED exact player exploration position: {savedPlayerPosition}");

            StartCoroutine(EnterEncounterSequence());
        }

        private IEnumerator EnterEncounterSequence()
        {
            Debug.Log("[PuzzleEncounter] >>> Entering Dedicated Puzzle Encounter <<<");

            // 1. Lock controls immediately
            if (playerMovementScript != null) playerMovementScript.enabled = false;

            // 2. Save Exploration Camera
            if (targetCamera == null) targetCamera = Camera.main;
            if (targetCamera != null)
            {
                savedCameraPosition = targetCamera.transform.position;
                savedCameraRotation = targetCamera.transform.rotation;
                savedCameraFov = targetCamera.fieldOfView;
            }

            // 3. Seamless Fade Out (Fade to Black)
            PuzzleScreenFader fader = PuzzleScreenFader.GetOrCreate();
            yield return fader.FadeOut(fadeDuration);

            // 4. Temporarily Hide Main-World Objects & Unrelated UI
            IsolateMainWorld();

            // 5. Generate Dedicated 3D Puzzle Environment at Staging Origin
            BuildDedicatedPuzzleEnvironment();

            // 6. Position Player Directly in Front of the 3D Puzzle
            PositionPlayerInFrontOfPuzzle();

            // 7. Position Cinematic Camera Framing
            PositionCinematicCamera();

            // 8. Play Dedicated Puzzle Audio State
            if (BackgroundMusicManager.Instance != null)
            {
                BackgroundMusicManager.Instance.SetState(MusicState.Puzzle, fadeDuration: 1.0f);
            }

            // 9. Initialize In-World Objective Validator
            if (PuzzleObjectiveValidator.Instance != null)
            {
                PuzzleObjectiveValidator.Instance.SetCurrentPuzzle(activePuzzleData);
            }

            // 10. Fade Screen In to Reveal the Dedicated Encounter
            yield return fader.FadeIn(fadeDuration);

            // 11. Enable 3D Physical Interaction and Cursor
            if (PuzzleInteractionBinder.Instance != null)
            {
                PuzzleInteractionBinder.Instance.EnableInteraction(true);
            }

            Debug.Log("[PuzzleEncounter] Dedicated puzzle encounter active and interactable.");
        }

        private void IsolateMainWorld()
        {
            isolatedWorldObjects.Clear();
            isolatedCanvases.Clear();

            Scene activeScene = SceneManager.GetActiveScene();
            GameObject[] rootObjects = activeScene.GetRootGameObjects();

            foreach (var root in rootObjects)
            {
                if (root == null) continue;
                string rootName = root.name;

                // Never hide vital infrastructure, cameras, sky, or player hierarchy
                if (rootName == "Directional Light" ||
                    rootName.Contains("Camera") ||
                    rootName == "Sky" ||
                    rootName.Contains("Sky") ||
                    rootName == "PlayerRoot" ||
                    rootName.Contains("Player") ||
                    rootName.Contains("Huscarl") ||
                    rootName == "EventSystem" ||
                    rootName == "BackgroundMusicManager" ||
                    rootName == "QuestManager" ||
                    rootName == "PuzzleScreenFader" ||
                    rootName == "PuzzleEnvironmentSystem" ||
                    rootName == "PuzzleContainer_Dedicated" ||
                    root.CompareTag("Player") ||
                    (playerTransform != null && (root.transform == playerTransform || root.transform == playerTransform.root)))
                {
                    continue;
                }

                // Hide main world scenery, terrain, NPCs, props, village structures
                if (root.activeSelf)
                {
                    isolatedWorldObjects.Add(root);
                    root.SetActive(false);
                }
            }

            // Hide unrelated UI Canvases (like InteractionUI, LearningUI, QuestHUD)
            Canvas[] allCanvases = FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach (var canvas in allCanvases)
            {
                if (canvas != null && canvas.gameObject.name != "PuzzleScreenFader" && canvas.gameObject.activeSelf)
                {
                    isolatedCanvases.Add(canvas);
                    canvas.gameObject.SetActive(false);
                }
            }

            Debug.Log($"[PuzzleEncounter] Isolated {isolatedWorldObjects.Count} main-world objects and {isolatedCanvases.Count} UI canvases.");
        }

        private void RestoreMainWorld()
        {
            // Restore hidden main-world objects
            foreach (var obj in isolatedWorldObjects)
            {
                if (obj != null) obj.SetActive(true);
            }
            isolatedWorldObjects.Clear();

            // Restore hidden UI Canvases
            foreach (var c in isolatedCanvases)
            {
                if (c != null) c.gameObject.SetActive(true);
            }
            isolatedCanvases.Clear();

            Debug.Log("[PuzzleEncounter] Main-world objects, environment, NPCs, and UI fully restored.");
        }

        private void BuildDedicatedPuzzleEnvironment()
        {
            // Clear any old puzzle staging container
            if (puzzleContainer != null)
            {
                Destroy(puzzleContainer.gameObject);
            }

            GameObject containerObj = new GameObject("PuzzleContainer_Dedicated");
            containerObj.transform.position = dedicatedStagingOrigin;
            puzzleContainer = containerObj.transform;

            // Initialize Puzzle Asset Library
            PuzzleAssetLibrary.InitializeLibrary();

            // 1. Natural courtyard ground base underneath the dais so player and platform don't float over an empty void
            GameObject groundRoot = new GameObject("CourtyardGround");
            groundRoot.transform.SetParent(puzzleContainer, false);
#if UNITY_EDITOR
            GameObject sandPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Nature/Terrain/rpgpp_lt_terrain_sand_01.prefab");
            if (sandPrefab != null)
            {
                GameObject groundSand = Instantiate(sandPrefab, groundRoot.transform, false);
                groundSand.name = "CourtyardGroundSand";
                groundSand.transform.localPosition = new Vector3(0f, -0.05f, 0f);
                groundSand.transform.localScale = new Vector3(4.5f, 1f, 4.5f);
            }
            else
            {
                GameObject groundMesh = GameObject.CreatePrimitive(PrimitiveType.Plane);
                groundMesh.name = "GroundBase";
                groundMesh.transform.SetParent(groundRoot.transform, false);
                groundMesh.transform.localPosition = new Vector3(0f, -0.05f, 0f);
                groundMesh.transform.localScale = new Vector3(3.5f, 1f, 3.5f);
            }
#else
            GameObject groundMesh = GameObject.CreatePrimitive(PrimitiveType.Plane);
            groundMesh.name = "GroundBase";
            groundMesh.transform.SetParent(groundRoot.transform, false);
            groundMesh.transform.localPosition = new Vector3(0f, -0.05f, 0f);
            groundMesh.transform.localScale = new Vector3(3.5f, 1f, 3.5f);
#endif

            // 2. Warm golden directional sun light & ambient lighting at staging area
            GameObject sunObj = new GameObject("DedicatedSunLight");
            sunObj.transform.SetParent(puzzleContainer, false);
            Light sun = sunObj.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1.0f, 0.90f, 0.74f);
            sun.intensity = 1.45f;
            sun.shadows = LightShadows.Soft;
            sunObj.transform.rotation = Quaternion.Euler(44f, -36f, 0f);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.65f, 0.58f, 0.48f);
#if UNITY_EDITOR
            Material skyMat = UnityEditor.AssetDatabase.LoadAssetAtPath<Material>("Assets/RPGPP_LT/Materials/rpgpp_lt_sky_a.mat");
            if (skyMat != null) RenderSettings.skybox = skyMat;
#endif
            if (targetCamera != null) targetCamera.clearFlags = CameraClearFlags.Skybox;

            // 3. Create Spatial Plan
            activePlan = PuzzleEnvironmentPlanner.CreatePlan(activePuzzleData, dedicatedStagingOrigin);

            // 4. Spawn 3D Puzzle Platform & Elements
            PuzzleElementSpawner.SpawnPuzzleEnvironment(activePlan, puzzleContainer);

            // 5. Add Relative Background (fences, pine trees, barrel clusters, crate stacks, scattered rocks)
            SpawnStagingPerimeter(puzzleContainer, dedicatedStagingOrigin);

            // 6. Ensure PuzzleInteractionBinder and PuzzleObjectiveValidator exist and are active
            if (containerObj.GetComponent<PuzzleInteractionBinder>() == null)
            {
                containerObj.AddComponent<PuzzleInteractionBinder>();
            }
            PuzzleObjectiveValidator validator = containerObj.GetComponent<PuzzleObjectiveValidator>();
            if (validator == null)
            {
                validator = containerObj.AddComponent<PuzzleObjectiveValidator>();
            }
            validator.SetCurrentPuzzle(activePuzzleData);
        }

        private void SpawnStagingPerimeter(Transform parent, Vector3 center)
        {
            GameObject decorRoot = new GameObject("StagingBackgroundDecor");
            decorRoot.transform.SetParent(parent, false);

            GameObject fencePrefab = Resources.Load<GameObject>("PuzzlePrefabs/Gate") ?? Resources.Load<GameObject>("PuzzlePrefabs/Pillar");
#if UNITY_EDITOR
            fencePrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Exterior/Wood_path/rpgpp_lt_fence_wood_01a.prefab")
                ?? UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/LowPolyMedievalPropsLite/Prefabs/Fence_01.prefab")
                ?? fencePrefab;
            GameObject treePrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Nature/Vegetation/Trees/rpgpp_lt_tree_pine_01.prefab");
            GameObject cratePrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Props/Containers/rpgpp_lt_crate_01.prefab")
                ?? UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/LowPolyMedievalPropsLite/Prefabs/Box_01.prefab");
            GameObject barrelPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Props/Containers/rpgpp_lt_barrel_01.prefab")
                ?? UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/LowPolyMedievalPropsLite/Prefabs/Barrel_01.prefab");
            GameObject rockPrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Nature/Rocks/rpgpp_lt_rock_small_01.prefab");
#else
            GameObject treePrefab = null;
            GameObject cratePrefab = Resources.Load<GameObject>("PuzzlePrefabs/Crate");
            GameObject barrelPrefab = Resources.Load<GameObject>("PuzzlePrefabs/Barrel");
            GameObject rockPrefab = null;
#endif

            // Wooden Boundary Fences
            if (fencePrefab != null)
            {
                for (int i = -2; i <= 2; i++)
                {
                    GameObject f = Instantiate(fencePrefab, decorRoot.transform, false);
                    f.transform.position = center + new Vector3(i * 2.2f, 0f, 4.8f);
                    f.transform.rotation = Quaternion.identity;
                }
                for (int i = 1; i <= 2; i++)
                {
                    GameObject f = Instantiate(fencePrefab, decorRoot.transform, false);
                    f.transform.position = center + new Vector3(-4.8f, 0f, i * 2.2f);
                    f.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
                }
                for (int i = 0; i <= 2; i++)
                {
                    GameObject f = Instantiate(fencePrefab, decorRoot.transform, false);
                    f.transform.position = center + new Vector3(4.8f, 0f, i * 2.2f);
                    f.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
                }
            }

            // Distant Pine Trees
            if (treePrefab != null)
            {
                Vector3[] treePositions = new Vector3[]
                {
                    new Vector3(-5.2f, 0f, 6.2f),
                    new Vector3(-2.6f, 0f, 6.5f),
                    new Vector3(0.0f, 0f, 6.6f),
                    new Vector3(2.6f, 0f, 6.5f),
                    new Vector3(5.2f, 0f, 6.2f),
                    new Vector3(-6.8f, 0f, 4.5f),
                    new Vector3(-7.2f, 0f, 2.2f),
                    new Vector3(6.8f, 0f, 4.5f),
                    new Vector3(7.2f, 0f, 2.2f)
                };
                for (int t = 0; t < treePositions.Length; t++)
                {
                    GameObject tree = Instantiate(treePrefab, decorRoot.transform, false);
                    tree.transform.position = center + treePositions[t];
                    tree.transform.localScale = Vector3.one * (1.1f + ((t % 3) * 0.15f));
                    tree.transform.rotation = Quaternion.Euler(0f, t * 53f, 0f);
                }
            }

            // Foreground Crates & Barrels
            if (cratePrefab != null)
            {
                GameObject c1 = Instantiate(cratePrefab, decorRoot.transform, false);
                c1.transform.position = center + new Vector3(-5.2f, 0f, -2.8f);
                GameObject c2 = Instantiate(cratePrefab, decorRoot.transform, false);
                c2.transform.position = center + new Vector3(-5.2f, 0.65f, -2.8f);
            }
            if (barrelPrefab != null)
            {
                GameObject b1 = Instantiate(barrelPrefab, decorRoot.transform, false);
                b1.transform.position = center + new Vector3(4.4f, 0f, -1.8f);
                GameObject b2 = Instantiate(barrelPrefab, decorRoot.transform, false);
                b2.transform.position = center + new Vector3(-1.4f, 0f, 4.4f);
            }
            if (rockPrefab != null)
            {
                Vector3[] rockPositions = new Vector3[]
                {
                    new Vector3(-4.2f, 0f, -2.2f),
                    new Vector3(3.6f, 0f, -3.4f),
                    new Vector3(3.8f, 0f, 3.6f)
                };
                for (int r = 0; r < rockPositions.Length; r++)
                {
                    GameObject rk = Instantiate(rockPrefab, decorRoot.transform, false);
                    rk.transform.position = center + rockPositions[r];
                    rk.transform.localScale = Vector3.one * 0.5f;
                }
            }
        }

        private void PositionPlayerInFrontOfPuzzle()
        {
            if (playerTransform == null)
            {
                ResolveReferences();
            }
            if (playerTransform == null) return;

            // Ensure player hierarchy and GameObject are active
            if (!playerTransform.gameObject.activeSelf) playerTransform.gameObject.SetActive(true);
            if (!playerTransform.root.gameObject.activeSelf) playerTransform.root.gameObject.SetActive(true);

            if (playerController != null) playerController.enabled = false;

            // Place player at front-left perimeter of dais, clear of corner brazier
            // Foundation step sits at Y = 0.34m, so position player at Y = 0.35m
            Vector3 targetPlayerPos = dedicatedStagingOrigin + new Vector3(-3.6f, 0.35f, -1.2f);

            playerTransform.position = targetPlayerPos;
            playerTransform.rotation = Quaternion.Euler(0f, 55f, 0f);
            Physics.SyncTransforms();

            if (playerController != null) playerController.enabled = true;
            if (playerMovementScript != null) playerMovementScript.enabled = true;

            Debug.Log($"[PuzzleEncounter] Positioned player character '{playerTransform.name}' at {playerTransform.position} (active: {playerTransform.gameObject.activeInHierarchy})");
        }

        private void PositionCinematicCamera()
        {
            if (targetCamera == null) targetCamera = Camera.main;
            if (targetCamera == null) return;

            ThirdPersonCamera tpCam = targetCamera.GetComponent<ThirdPersonCamera>();
            if (tpCam != null)
            {
                tpCam.enabled = false;
            }

            // High-angle 3/4 isometric perspective framing entire 3x3 diamond dais, runes, braziers, and surroundings
            Vector3 camPos = dedicatedStagingOrigin + new Vector3(-8.6f, 8.2f, -8.6f);
            targetCamera.transform.position = camPos;
            targetCamera.transform.rotation = Quaternion.Euler(38f, 45f, 0f);
            targetCamera.fieldOfView = 38f;
            targetCamera.clearFlags = CameraClearFlags.Skybox;

            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            Debug.Log($"[PuzzleEncounter] Cinematic isometric camera positioned at {camPos} facing puzzle platform.");
        }

        private void OnPuzzleCompleted(string puzzleId)
        {
            if (!isInEncounter) return;

            Debug.Log($"[PuzzleEncounter] Puzzle Solved event received for '{puzzleId}'. Starting victory restoration routine.");
            StartCoroutine(ExitEncounterSequence());
        }

        private IEnumerator ExitEncounterSequence()
        {
            // 1. Disable 3D mouse interaction
            if (PuzzleInteractionBinder.Instance != null)
            {
                PuzzleInteractionBinder.Instance.EnableInteraction(false);
            }

            // 2. Play Victory Music
            if (BackgroundMusicManager.Instance != null)
            {
                BackgroundMusicManager.Instance.SetState(MusicState.Victory, fadeDuration: 0.8f);
            }

            // 3. Allow player to witness the solved physical mechanism in-world
            yield return new WaitForSeconds(solveCelebrationDelay);

            // 4. Fade Screen Out
            PuzzleScreenFader fader = PuzzleScreenFader.GetOrCreate();
            yield return fader.FadeOut(fadeDuration);

            // 5. Clean up dedicated puzzle staging
            if (puzzleContainer != null)
            {
                Destroy(puzzleContainer.gameObject);
                puzzleContainer = null;
            }

            // 6. Restore Main-World Environment, NPCs, Props, and UI
            RestoreMainWorld();

            // 7. Return Player to Exact Saved Exploration Position
            if (playerTransform != null)
            {
                if (playerController != null) playerController.enabled = false;
                if (playerMovementScript != null) playerMovementScript.enabled = false;

                playerTransform.position = savedPlayerPosition;
                playerTransform.rotation = savedPlayerRotation;
                Physics.SyncTransforms();

                if (playerController != null) playerController.enabled = true;
                if (playerMovementScript != null) playerMovementScript.enabled = true;

                Debug.Log($"[PuzzleEncounter] Successfully restored player to saved exploration position: {playerTransform.position}");
            }

            // 8. Restore Exploration Camera & Snap ThirdPersonCamera
            if (targetCamera != null)
            {
                ThirdPersonCamera tpCam = targetCamera.GetComponent<ThirdPersonCamera>();
                if (tpCam != null)
                {
                    tpCam.enabled = true;
                    tpCam.SnapToTarget();
                }
                else
                {
                    targetCamera.transform.position = savedCameraPosition;
                    targetCamera.transform.rotation = savedCameraRotation;
                    targetCamera.fieldOfView = savedCameraFov;
                }
            }

            // 9. Restore Exploration Music
            if (BackgroundMusicManager.Instance != null)
            {
                BackgroundMusicManager.Instance.SetState(MusicState.Exploration, fadeDuration: 1.5f);
                BackgroundMusicManager.Instance.SetVolume(0.5f);
            }

            // 10. Update Quest & Notify FirstClue
            if (QuestManager.Instance != null)
            {
                QuestManager.Instance.UpdateObjective("Follow the clue to the next location");
            }

            FirstClue firstClue = FindFirstObjectByType<FirstClue>();
            if (firstClue != null)
            {
                firstClue.PuzzleSolved();
            }

            SecondClue secondClue = FindFirstObjectByType<SecondClue>();
            if (secondClue != null)
            {
                secondClue.PuzzleSolved();
            }

            ThirdClue thirdClue = FindFirstObjectByType<ThirdClue>();
            if (thirdClue != null)
            {
                thirdClue.PuzzleSolved();
            }

            // 11. Fade Screen In to Return to Exploration
            yield return fader.FadeIn(fadeDuration);

            isInEncounter = false;
            Debug.Log("[PuzzleEncounter] Returned seamlessly to main world exploration.");
        }
    }
}
