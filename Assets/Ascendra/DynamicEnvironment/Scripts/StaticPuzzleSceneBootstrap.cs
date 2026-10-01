using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Ascendra.DynamicEnvironment;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Runtime bootstrap for the static puzzle scene encounter.
    /// Implements the exact main scene camera setup (ThirdPersonCamera + Huscarl)
    /// while providing seamless switching to the dedicated isometric puzzle view.
    /// </summary>
    public class StaticPuzzleSceneBootstrap : MonoBehaviour
    {
        public static StaticPuzzleSceneBootstrap Instance { get; private set; }

        [Header("Puzzle Settings")]
        public TextAsset staticPuzzleJsonAsset;
        public string fallbackAnswer = "36";

        [Header("Lighting & Camera")]
        public Camera puzzleCamera;
        public ThirdPersonCamera thirdPersonCamera;
        public bool startInThirdPerson = true;

        [Header("Isometric Framing Target")]
        public Vector3 puzzleCameraPosition = new Vector3(-8.6f, 8.2f, -8.6f);
        public Vector3 puzzleCameraEuler = new Vector3(38f, 45f, 0f);
        public float puzzleCameraFov = 38f;
        public float explorationFov = 60f;

        [Header("Controls")]
        public KeyCode toggleViewKey = KeyCode.C;

        private bool isPuzzleViewActive = false;
        private Coroutine transitionCoroutine;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (puzzleCamera == null)
            {
                puzzleCamera = Camera.main;
            }

            if (thirdPersonCamera == null && puzzleCamera != null)
            {
                thirdPersonCamera = puzzleCamera.GetComponent<ThirdPersonCamera>();
            }
            if (thirdPersonCamera == null)
            {
                thirdPersonCamera = FindAnyObjectByType<ThirdPersonCamera>();
            }

            // Ensure Audio Synthesizer exists
            if (PuzzleAudioSynthesizer.Instance == null)
            {
                GameObject audioObj = new GameObject("PuzzleAudioSynthesizer");
                audioObj.AddComponent<PuzzleAudioSynthesizer>();
            }

            // Ensure Screen Fader exists
            PuzzleScreenFader.GetOrCreate();

            // Ensure Asset Library initialized
            PuzzleAssetLibrary.InitializeLibrary();
        }

        private void Start()
        {
            // Initialize camera to Third-Person Exploration by default (matching Main Scene)
            if (thirdPersonCamera != null && startInThirdPerson)
            {
                SetPuzzleView(false, 0f);
            }
            else
            {
                SetPuzzleView(true, 0f);
            }

            // Load and initialize puzzle data
            PuzzleData puzzleData = null;
            if (staticPuzzleJsonAsset != null && !string.IsNullOrEmpty(staticPuzzleJsonAsset.text))
            {
                puzzleData = PuzzleData.ParseJson(staticPuzzleJsonAsset.text);
            }
            else
            {
                TextAsset loaded = Resources.Load<TextAsset>("Puzzles/static_village_puzzle");
                if (loaded != null)
                {
                    puzzleData = PuzzleData.ParseJson(loaded.text);
                }
            }

            if (puzzleData == null)
            {
                puzzleData = new PuzzleData
                {
                    puzzleId = "PZ-VILLAGE-001",
                    title = "Whispering Monoliths of Ascendra Village",
                    answer = fallbackAnswer
                };
            }

            // Initialize Objective Validator
            if (PuzzleObjectiveValidator.Instance != null)
            {
                PuzzleObjectiveValidator.Instance.SetCurrentPuzzle(puzzleData);
            }

            // Enable 3D physical interaction
            if (PuzzleInteractionBinder.Instance != null)
            {
                PuzzleInteractionBinder.Instance.EnableInteraction(true);
            }

            Debug.Log($"[StaticPuzzleSceneBootstrap] Scene initialized for puzzle: '{puzzleData.title}'. Camera setup matching Main Scene active.");
        }

        private void Update()
        {
            // Toggle view mode on hotkey
            if (Input.GetKeyDown(toggleViewKey) || Input.GetKeyDown(KeyCode.V) || Input.GetKeyDown(KeyCode.Tab))
            {
                ToggleViewMode();
            }

            // Return to exploration on ESC if in puzzle view
            if (isPuzzleViewActive && Input.GetKeyDown(KeyCode.Escape))
            {
                SetPuzzleView(false, 0.6f);
            }
        }

        public void ToggleViewMode()
        {
            SetPuzzleView(!isPuzzleViewActive, 0.6f);
        }

        public void SetPuzzleView(bool active, float transitionDuration = 0.6f)
        {
            isPuzzleViewActive = active;

            if (puzzleCamera == null) puzzleCamera = Camera.main;
            if (puzzleCamera == null) return;

            if (thirdPersonCamera == null)
            {
                thirdPersonCamera = puzzleCamera.GetComponent<ThirdPersonCamera>();
            }

            if (transitionCoroutine != null) StopCoroutine(transitionCoroutine);

            if (active)
            {
                // Switch to Dedicated Isometric Puzzle View
                if (thirdPersonCamera != null)
                {
                    thirdPersonCamera.SetCameraActive(false);
                }

                Quaternion targetRot = Quaternion.Euler(puzzleCameraEuler);
                if (transitionDuration > 0.01f)
                {
                    transitionCoroutine = StartCoroutine(AnimateCamera(puzzleCameraPosition, targetRot, puzzleCameraFov, transitionDuration, false));
                }
                else
                {
                    puzzleCamera.transform.position = puzzleCameraPosition;
                    puzzleCamera.transform.rotation = targetRot;
                    puzzleCamera.fieldOfView = puzzleCameraFov;
                    Cursor.lockState = CursorLockMode.None;
                    Cursor.visible = true;
                }
            }
            else
            {
                // Switch back to Third-Person Exploration View
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;

                if (thirdPersonCamera != null)
                {
                    thirdPersonCamera.SetCameraActive(true);
                    puzzleCamera.fieldOfView = explorationFov;
                }
            }
        }

        private IEnumerator AnimateCamera(Vector3 targetPos, Quaternion targetRot, float targetFov, float duration, bool reenableThirdPerson)
        {
            Vector3 startPos = puzzleCamera.transform.position;
            Quaternion startRot = puzzleCamera.transform.rotation;
            float startFov = puzzleCamera.fieldOfView;

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.SmoothStep(0f, 1f, elapsed / duration);

                puzzleCamera.transform.position = Vector3.Lerp(startPos, targetPos, t);
                puzzleCamera.transform.rotation = Quaternion.Slerp(startRot, targetRot, t);
                puzzleCamera.fieldOfView = Mathf.Lerp(startFov, targetFov, t);

                yield return null;
            }

            puzzleCamera.transform.position = targetPos;
            puzzleCamera.transform.rotation = targetRot;
            puzzleCamera.fieldOfView = targetFov;

            if (reenableThirdPerson && thirdPersonCamera != null)
            {
                thirdPersonCamera.SetCameraActive(true);
            }
            else if (!reenableThirdPerson)
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
        }

        private void OnGUI()
        {
            // Subtle HUD prompt indicating current camera mode & toggle hotkey
            GUIStyle style = new GUIStyle(GUI.skin.box);
            style.fontSize = 13;
            style.alignment = TextAnchor.MiddleCenter;
            style.normal.textColor = Color.white;

            string modeLabel = isPuzzleViewActive ? "<color=#FFD54F>Puzzle Focus Mode</color>" : "<color=#80D8FF>Third-Person Exploration</color>";
            string buttonText = isPuzzleViewActive ? "Switch to 3rd Person [C]" : "Switch to Puzzle View [C]";

            GUILayout.BeginArea(new Rect(20, 20, 260, 75), GUI.skin.window);
            GUILayout.Label($"Camera: {modeLabel}", style);
            if (GUILayout.Button(buttonText, GUILayout.Height(28)))
            {
                ToggleViewMode();
            }
            GUILayout.EndArea();
        }
    }
}
