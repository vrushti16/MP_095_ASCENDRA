using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TMPro;
using Ascendra.Audio;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Runtime interactive controller for the Second Static Puzzle Scene:
    /// Task 4 - Symbol Alignment Puzzle (Data Science / Pattern Recognition).
    /// Focuses purely on the concentric rotating stone ring mechanism with
    /// the pattern deduction tablet:
    /// [ ○ -> △ | □ -> ☾ ]
    /// [ ○ -> △ | ? -> ☾ ]
    /// Hint: Follow the pattern shown above. Find the missing symbol.
    /// </summary>
    public class SecondPuzzleController : MonoBehaviour
    {
        public static SecondPuzzleController Instance { get; private set; }

        [Header("Concentric Ring Mechanism")]
        [Tooltip("Transform of the outer rotating symbol ring.")]
        public Transform outerRingTransform;
        [Tooltip("Transform of the inner rotating symbol ring.")]
        public Transform innerRingTransform;
        [Tooltip("Central magic crystal transform.")]
        public Transform centralCrystalTransform;
        [Tooltip("Point light illuminating the central crystal.")]
        public Light centralCrystalLight;

        [Header("Symbols & Targets")]
        public string[] outerSymbols = new string[] { "Circle", "Triangle", "Square", "Moon", "Wave", "Diamond" };
        public int currentOuterIndex = 0;
        public int currentInnerIndex = 0;
        public int targetSolvedOuterIndex = 2; // Index 2 is "Square" (the missing symbol from pattern deduction)

        [Header("Audio & Audio Feedback")]
        public AudioSource audioSource;

        [Header("Camera & View")]
        public Camera puzzleCamera;
        public Vector3 frontalCameraPosition = new Vector3(0f, 2.85f, -4.6f);
        public Vector3 frontalCameraEuler = new Vector3(3f, 0f, 0f);
        public float frontalCameraFov = 44f;

        [Header("UI Canvas & Feedback")]
        public Canvas puzzleCanvas;
        public GameObject victoryPanel;
        public TextMeshProUGUI statusText;
        public Button rotateLeftBtn;
        public Button rotateRightBtn;
        public Button confirmBtn;

        private float targetOuterAngle = 0f;
        private float currentOuterAngle = 0f;
        private float targetInnerAngle = 0f;
        private float currentInnerAngle = 0f;
        private bool isPuzzleSolved = false;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (puzzleCamera == null)
                puzzleCamera = Camera.main;

            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
                audioSource.playOnAwake = false;
            }

            // Ensure Audio Synthesizer exists
            if (PuzzleAudioSynthesizer.Instance == null)
            {
                GameObject audioObj = new GameObject("PuzzleAudioSynthesizer");
                audioObj.AddComponent<PuzzleAudioSynthesizer>();
            }

            // Ensure screen is visible and clears black immediately
            PuzzleScreenFader fader = PuzzleScreenFader.GetOrCreate();
            if (fader != null)
            {
                fader.InstantClear();
            }
        }

        private void Start()
        {
            // Position camera in frontal framed perspective
            if (puzzleCamera != null)
            {
                puzzleCamera.transform.position = frontalCameraPosition;
                puzzleCamera.transform.rotation = Quaternion.Euler(frontalCameraEuler);
                puzzleCamera.fieldOfView = frontalCameraFov;
            }

            // Wire UI buttons if assigned
            if (rotateLeftBtn != null) rotateLeftBtn.onClick.AddListener(() => RotateOuterRing(-1));
            if (rotateRightBtn != null) rotateRightBtn.onClick.AddListener(() => RotateOuterRing(1));
            if (confirmBtn != null) confirmBtn.onClick.AddListener(ConfirmAlignment);

            if (victoryPanel != null) victoryPanel.SetActive(false);
            UpdateStatusDisplay();

            // Smooth fade-in to reveal the scene
            PuzzleScreenFader fader = PuzzleScreenFader.GetOrCreate();
            if (fader != null)
            {
                fader.FadeIn(0.5f);
            }

            Debug.Log("[SecondPuzzleController] Initialized for Task 4: Symbol Alignment Puzzle (Pattern: [○->△|□->☾], [○->△|?->☾]).");
        }

        private void Update()
        {
            // Smooth ring rotation interpolation
            if (outerRingTransform != null)
            {
                currentOuterAngle = Mathf.Lerp(currentOuterAngle, targetOuterAngle, Time.deltaTime * 9f);
                outerRingTransform.localRotation = Quaternion.Euler(0f, 0f, currentOuterAngle);
            }

            if (innerRingTransform != null)
            {
                currentInnerAngle = Mathf.Lerp(currentInnerAngle, targetInnerAngle, Time.deltaTime * 9f);
                innerRingTransform.localRotation = Quaternion.Euler(0f, 0f, currentInnerAngle);
            }

            // Escape key returns to village exploration anytime
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                ReturnToVillage();
                return;
            }

            // Keyboard Controls (matching reference image: "Use A / D to rotate rings [E] to confirm")
            if (!isPuzzleSolved)
            {
                if (Input.GetKeyDown(KeyCode.A) || Input.GetKeyDown(KeyCode.LeftArrow))
                {
                    RotateOuterRing(-1);
                }
                else if (Input.GetKeyDown(KeyCode.D) || Input.GetKeyDown(KeyCode.RightArrow))
                {
                    RotateOuterRing(1);
                }
                else if (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.Space))
                {
                    ConfirmAlignment();
                }
                else if (Input.GetKeyDown(KeyCode.Q))
                {
                    RotateInnerRing(-1);
                }
                else if (Input.GetKeyDown(KeyCode.W))
                {
                    RotateInnerRing(1);
                }
            }
            else
            {
                // After puzzle is solved, press E, Space, Return, or Esc to return to village
                if (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return))
                {
                    ReturnToVillage();
                }
            }

            // Central Crystal gentle breathing pulse
            if (centralCrystalLight != null && !isPuzzleSolved)
            {
                centralCrystalLight.intensity = 2.4f + Mathf.Sin(Time.time * 2.8f) * 0.4f;
            }
        }

        public void ReturnToVillage()
        {
            StartCoroutine(TransitionBackToVillage());
        }

        private IEnumerator TransitionBackToVillage()
        {
            PuzzleScreenFader fader = PuzzleScreenFader.GetOrCreate();
            if (fader != null)
            {
                yield return fader.FadeOut(0.5f);
            }
            SceneManager.LoadScene("Stage_1_1_Village");
        }

        public void RotateOuterRing(int direction)
        {
            if (isPuzzleSolved) return;

            // 6 symbols = 60 degrees per step
            currentOuterIndex = (currentOuterIndex + direction + 6) % 6;
            targetOuterAngle += direction * 60f;

            PlayMechanicalStoneClick();
            UpdateStatusDisplay();
        }

        public void RotateInnerRing(int direction)
        {
            if (isPuzzleSolved) return;

            currentInnerIndex = (currentInnerIndex + direction + 6) % 6;
            targetInnerAngle += direction * 60f;

            PlayMechanicalStoneClick();
        }

        public void ConfirmAlignment()
        {
            if (isPuzzleSolved) return;

            Debug.Log($"[SecondPuzzleController] Checking alignment. Current Outer Symbol: '{outerSymbols[currentOuterIndex]}' (Index {currentOuterIndex}), Target: '{outerSymbols[targetSolvedOuterIndex]}'");

            // Index 2 is "Square" (□), which satisfies the pattern:
            // [ ○ -> △ | □ -> ☾ ]
            // [ ○ -> △ | ? -> ☾ ] -> Missing symbol is Square (□)
            if (currentOuterIndex == targetSolvedOuterIndex)
            {
                SolvePuzzle();
            }
            else
            {
                PlayRejectRumble();
                if (statusText != null)
                {
                    statusText.text = $"<color=#FFB74D>Misaligned ({outerSymbols[currentOuterIndex]}). Hint: Observe [○->△|□->☾] and [○->△|?->☾] above!</color>";
                }
            }
        }

        private void SolvePuzzle()
        {
            isPuzzleSolved = true;
            Debug.Log("[SecondPuzzleController] Puzzle Solved! Square (□) aligned to top focus!");

            // 1. Audio Fanfare
            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayVictoryFanfare();
            }

            // 2. Flare Central Crystal with celestial radiance
            StartCoroutine(AnimateCrystalActivation());

            // 3. Update UI Status & Victory Banner
            if (statusText != null)
            {
                statusText.text = "<color=#00E5FF>★ PATTERN COMPLETE: MISSING SYMBOL [SQUARE] RESTORED! ★</color>";
            }

            if (victoryPanel != null)
            {
                victoryPanel.SetActive(true);
            }

            // 4. Update Quest Manager
            if (QuestManager.Instance != null)
            {
                QuestManager.Instance.UpdateObjective("Symbol Alignment Puzzle Solved! Missing Rune [Square] activated.");
            }

            // 5. Notify Event Bus & Clue
            PuzzleEventBus.TriggerPuzzleSolved("PZ-SYMBOL-004");
            if (SecondClue.Instance != null)
            {
                SecondClue.Instance.PuzzleSolved();
            }
        }

        private IEnumerator AnimateCrystalActivation()
        {
            float elapsed = 0f;
            float duration = 2.2f;
            float startIntensity = centralCrystalLight != null ? centralCrystalLight.intensity : 2.5f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                if (centralCrystalLight != null)
                {
                    centralCrystalLight.intensity = Mathf.Lerp(startIntensity, 6.8f, Mathf.Sin(t * Mathf.PI));
                    centralCrystalLight.color = Color.Lerp(new Color(0f, 0.9f, 1f), new Color(0.85f, 0.98f, 1f), t);
                }

                if (centralCrystalTransform != null)
                {
                    centralCrystalTransform.Rotate(Vector3.forward * 90f * Time.deltaTime, Space.Self);
                }
                yield return null;
            }

            if (centralCrystalLight != null)
            {
                centralCrystalLight.intensity = 4.2f;
            }
        }

        private void PlayMechanicalStoneClick()
        {
            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayMechanicalClick();
            }
        }

        private void PlayRejectRumble()
        {
            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlaySubtleError();
            }
        }

        private void UpdateStatusDisplay()
        {
            if (statusText != null && !isPuzzleSolved)
            {
                statusText.text = $"Aligned Symbol: <b><color=#00E5FF>{outerSymbols[currentOuterIndex]}</color></b>   |   Use <b>[A] / [D]</b> to rotate rings   |   <b>[E]</b> to confirm";
            }
        }
    }
}
