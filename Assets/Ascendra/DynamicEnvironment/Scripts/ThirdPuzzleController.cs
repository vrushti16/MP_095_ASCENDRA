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
    /// Runtime interactive controller for the Third Static Puzzle Scene:
    /// Task 5 - Message Reconstruction Puzzle (English / Communication).
    /// 
    /// Mechanism:
    /// 6 floating word tablets: "come", "at", "tower", "the", "sunset", "to".
    /// Altar with 6 carved stone sockets labeled 1, 2, 3, 4, 5, 6.
    /// Correct reconstruction: "come to the tower at sunset".
    /// Upon successful reconstruction, the ancient celestial crystal activates with radiant light,
    /// particle emissions, and audio fanfare, unlocking the path forward.
    /// </summary>
    public class ThirdPuzzleController : MonoBehaviour
    {
        public static ThirdPuzzleController Instance { get; private set; }

        [System.Serializable]
        public class WordFragment
        {
            public string word;
            public Transform tabletTransform;
            public Vector3 initialFloatingPos;
            public Quaternion initialFloatingRot;
            public Renderer tabletRenderer;
            public TextMeshPro textMesh;
            public int targetSlotIndex = -1; // 0 to 5
            public int currentSlotIndex = -1; // -1 if floating
            public bool isSelected = false;
        }

        [Header("Word Fragments")]
        public List<WordFragment> fragments = new List<WordFragment>();
        public readonly string[] targetWords = new string[] { "come", "to", "the", "tower", "at", "sunset" };

        [Header("Altar Sockets (Slots 1 to 6)")]
        public Transform[] socketTransforms = new Transform[6];
        public TextMeshPro[] socketLabels = new TextMeshPro[6];
        private int[] socketAssignments = new int[] { -1, -1, -1, -1, -1, -1 }; // stores fragment index in each slot

        [Header("Central Magic Crystal")]
        public Transform centralCrystalTransform;
        public Light centralCrystalLight;
        public ParticleSystem crystalParticles;
        public Material crystalMaterial;

        [Header("Camera & View")]
        public Camera puzzleCamera;
        public Vector3 frontalCameraPosition = new Vector3(0f, 2.75f, -6.40f);
        public Vector3 frontalCameraEuler = new Vector3(6f, 0f, 0f);
        public float frontalCameraFov = 52f;

        [Header("UI Canvas & Feedback")]
        public Canvas puzzleCanvas;
        public GameObject victoryPanel;
        public TextMeshProUGUI statusText;
        public TextMeshProUGUI sentencePreviewText;
        public Button confirmBtn;
        public Button resetBtn;
        public Button returnBtn;

        [Header("Selection & Navigation State")]
        public int selectedFragmentIndex = 0;
        private bool isPuzzleSolved = false;
        private AudioSource audioSource;

        private float crystalBaseLightIntensity = 1.8f;
        private float crystalBaseY = 0f;
        private Color crystalBaseColor = new Color(0f, 0.85f, 1f);

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

            // Clear black screen fade immediately
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

            // Record initial crystal state
            if (centralCrystalTransform != null)
            {
                crystalBaseY = centralCrystalTransform.position.y;
            }

            if (centralCrystalLight != null)
            {
                crystalBaseLightIntensity = centralCrystalLight.intensity;
            }

            // Initialize fragment targets
            for (int i = 0; i < fragments.Count; i++)
            {
                var frag = fragments[i];
                if (frag.tabletTransform != null)
                {
                    frag.initialFloatingPos = frag.tabletTransform.position;
                    frag.initialFloatingRot = frag.tabletTransform.rotation;
                }

                // Determine target slot index for this word
                for (int t = 0; t < targetWords.Length; t++)
                {
                    if (string.Equals(frag.word, targetWords[t], StringComparison.OrdinalIgnoreCase))
                    {
                        frag.targetSlotIndex = t;
                        break;
                    }
                }
            }

            // Wire UI buttons
            if (confirmBtn != null) confirmBtn.onClick.AddListener(CheckSentenceCompletion);
            if (resetBtn != null) resetBtn.onClick.AddListener(ResetAllSlots);
            if (returnBtn != null) returnBtn.onClick.AddListener(ReturnToVillage);

            if (puzzleCanvas != null)
            {
                puzzleCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            }

            if (victoryPanel != null) victoryPanel.SetActive(false);

            UpdateSelectionHighlight();
            UpdateSentencePreview();
            UpdateStatusDisplay("Select a floating fragment and choose a numbered altar slot [1-6].");

            // Smooth fade in
            PuzzleScreenFader fader = PuzzleScreenFader.GetOrCreate();
            if (fader != null)
            {
                fader.FadeIn(0.6f);
            }

            Debug.Log("[ThirdPuzzleController] Initialized for Task 5: Message Reconstruction Puzzle ('come to the tower at sunset').");
        }

        private void Update()
        {
            // Crystal gentle floating animation
            AnimateCrystal();

            // Tablet smooth movement animation
            AnimateTablets();

            // Check mouse clicks for 3D picking
            HandleMouseInteraction();

            // Keyboard navigation & controls
            HandleKeyboardInput();
        }

        private void AnimateCrystal()
        {
            if (centralCrystalTransform == null) return;

            float rotSpeed = isPuzzleSolved ? 40f : 15f;
            centralCrystalTransform.Rotate(Vector3.up * rotSpeed * Time.deltaTime, Space.World);

            float bobSpeed = isPuzzleSolved ? 3.0f : 1.5f;
            float bobAmp = isPuzzleSolved ? 0.25f : 0.12f;
            float newY = crystalBaseY + Mathf.Sin(Time.time * bobSpeed) * bobAmp;
            Vector3 pos = centralCrystalTransform.position;
            pos.y = newY;
            centralCrystalTransform.position = pos;

            if (centralCrystalLight != null)
            {
                float pulse = Mathf.PingPong(Time.time * (isPuzzleSolved ? 4f : 1.2f), 1f);
                float targetIntensity = isPuzzleSolved ? (6.0f + pulse * 2.5f) : (crystalBaseLightIntensity + pulse * 0.6f);
                centralCrystalLight.intensity = Mathf.Lerp(centralCrystalLight.intensity, targetIntensity, Time.deltaTime * 6f);
            }
        }

        private void AnimateTablets()
        {
            for (int i = 0; i < fragments.Count; i++)
            {
                var frag = fragments[i];
                if (frag.tabletTransform == null) continue;

                Vector3 targetPos;
                Quaternion targetRot;

                if (frag.currentSlotIndex >= 0 && frag.currentSlotIndex < socketTransforms.Length)
                {
                    // Docked in socket
                    Transform socket = socketTransforms[frag.currentSlotIndex];
                    targetPos = socket.position + socket.up * 0.05f;
                    targetRot = socket.rotation;
                }
                else
                {
                    // Floating in upper pool with gentle bobbing
                    float bobOffset = Mathf.Sin(Time.time * 2f + i * 0.9f) * 0.08f;
                    targetPos = frag.initialFloatingPos + Vector3.up * bobOffset;
                    targetRot = frag.initialFloatingRot;

                    // If selected, lift slightly forward towards camera
                    if (i == selectedFragmentIndex && !isPuzzleSolved)
                    {
                        targetPos += Vector3.forward * -0.2f + Vector3.up * 0.15f;
                    }
                }

                frag.tabletTransform.position = Vector3.Lerp(frag.tabletTransform.position, targetPos, Time.deltaTime * 10f);
                frag.tabletTransform.rotation = Quaternion.Slerp(frag.tabletTransform.rotation, targetRot, Time.deltaTime * 10f);
            }
        }

        private void HandleMouseInteraction()
        {
            if (isPuzzleSolved) return;

            if (Input.GetMouseButtonDown(0))
            {
                Ray ray = Camera.main != null ? Camera.main.ScreenPointToRay(Input.mousePosition) : puzzleCamera.ScreenPointToRay(Input.mousePosition);
                if (Physics.Raycast(ray, out RaycastHit hit, 50f))
                {
                    // 1. Check if clicked a word tablet
                    for (int i = 0; i < fragments.Count; i++)
                    {
                        if (hit.transform == fragments[i].tabletTransform || hit.transform.IsChildOf(fragments[i].tabletTransform))
                        {
                            OnTabletClicked(i);
                            return;
                        }
                    }

                    // 2. Check if clicked a socket
                    for (int s = 0; s < socketTransforms.Length; s++)
                    {
                        if (hit.transform == socketTransforms[s] || hit.transform.IsChildOf(socketTransforms[s]))
                        {
                            OnSocketClicked(s);
                            return;
                        }
                    }
                }
            }
        }

        private void HandleKeyboardInput()
        {
            // Escape to return
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                ReturnToVillage();
                return;
            }

            if (isPuzzleSolved)
            {
                if (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return))
                {
                    ReturnToVillage();
                }
                return;
            }

            // Cycle selected fragment
            if (Input.GetKeyDown(KeyCode.A) || Input.GetKeyDown(KeyCode.LeftArrow))
            {
                CycleSelectedFragment(-1);
            }
            else if (Input.GetKeyDown(KeyCode.D) || Input.GetKeyDown(KeyCode.RightArrow))
            {
                CycleSelectedFragment(1);
            }

            // Direct numeric slot assignment: Keys 1 to 6
            if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1)) PlaceSelectedFragmentIntoSlot(0);
            if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2)) PlaceSelectedFragmentIntoSlot(1);
            if (Input.GetKeyDown(KeyCode.Alpha3) || Input.GetKeyDown(KeyCode.Keypad3)) PlaceSelectedFragmentIntoSlot(2);
            if (Input.GetKeyDown(KeyCode.Alpha4) || Input.GetKeyDown(KeyCode.Keypad4)) PlaceSelectedFragmentIntoSlot(3);
            if (Input.GetKeyDown(KeyCode.Alpha5) || Input.GetKeyDown(KeyCode.Keypad5)) PlaceSelectedFragmentIntoSlot(4);
            if (Input.GetKeyDown(KeyCode.Alpha6) || Input.GetKeyDown(KeyCode.Keypad6)) PlaceSelectedFragmentIntoSlot(5);

            // Confirm sentence
            if (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.Space))
            {
                CheckSentenceCompletion();
            }

            // Reset slots
            if (Input.GetKeyDown(KeyCode.R) || Input.GetKeyDown(KeyCode.Backspace))
            {
                ResetAllSlots();
            }
        }

        public void OnTabletClicked(int fragmentIndex)
        {
            if (fragmentIndex < 0 || fragmentIndex >= fragments.Count) return;

            var frag = fragments[fragmentIndex];

            // If already in a slot, clicking it recalls it back to the floating pool
            if (frag.currentSlotIndex >= 0)
            {
                RemoveFragmentFromSlot(fragmentIndex);
                selectedFragmentIndex = fragmentIndex;
                UpdateSelectionHighlight();
                UpdateSentencePreview();
                if (PuzzleAudioSynthesizer.Instance != null) PuzzleAudioSynthesizer.Instance.PlayMechanicalClick();
                return;
            }

            // Otherwise select it
            selectedFragmentIndex = fragmentIndex;
            UpdateSelectionHighlight();
            if (PuzzleAudioSynthesizer.Instance != null) PuzzleAudioSynthesizer.Instance.PlayMechanicalClick();
            UpdateStatusDisplay($"Selected '{frag.word}'. Click an altar slot [1-6] to place.");
        }

        public void OnSocketClicked(int slotIndex)
        {
            if (slotIndex < 0 || slotIndex >= socketTransforms.Length) return;

            // If a fragment is selected and not yet placed, place it in this slot
            if (selectedFragmentIndex >= 0 && selectedFragmentIndex < fragments.Count)
            {
                PlaceSelectedFragmentIntoSlot(slotIndex);
            }
            else
            {
                // If clicked an occupied socket with no fragment selected, recall that fragment
                int occupant = socketAssignments[slotIndex];
                if (occupant >= 0)
                {
                    RemoveFragmentFromSlot(occupant);
                    selectedFragmentIndex = occupant;
                    UpdateSelectionHighlight();
                    UpdateSentencePreview();
                    if (PuzzleAudioSynthesizer.Instance != null) PuzzleAudioSynthesizer.Instance.PlayMechanicalClick();
                }
            }
        }

        public void CycleSelectedFragment(int delta)
        {
            if (fragments.Count == 0) return;

            int prev = selectedFragmentIndex;
            for (int step = 0; step < fragments.Count; step++)
            {
                selectedFragmentIndex = (selectedFragmentIndex + delta + fragments.Count) % fragments.Count;
                // Prefer selecting an unplaced fragment, but allow any
                if (fragments[selectedFragmentIndex].currentSlotIndex < 0)
                {
                    break;
                }
            }

            UpdateSelectionHighlight();
            if (PuzzleAudioSynthesizer.Instance != null) PuzzleAudioSynthesizer.Instance.PlayMechanicalClick();
            UpdateStatusDisplay($"Selected '{fragments[selectedFragmentIndex].word}'. Press [1-6] to place in slot.");
        }

        public void PlaceSelectedFragmentIntoSlot(int slotIndex)
        {
            if (slotIndex < 0 || slotIndex >= socketTransforms.Length) return;
            if (selectedFragmentIndex < 0 || selectedFragmentIndex >= fragments.Count) return;

            var frag = fragments[selectedFragmentIndex];

            // If this slot is already occupied by another fragment, recall that occupant
            int currentOccupant = socketAssignments[slotIndex];
            if (currentOccupant >= 0 && currentOccupant != selectedFragmentIndex)
            {
                fragments[currentOccupant].currentSlotIndex = -1;
            }

            // If the fragment was previously in another slot, clear that slot
            if (frag.currentSlotIndex >= 0)
            {
                socketAssignments[frag.currentSlotIndex] = -1;
            }

            // Assign fragment to slot
            frag.currentSlotIndex = slotIndex;
            socketAssignments[slotIndex] = selectedFragmentIndex;

            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayStoneRotate();
            }

            // Move selection to the next unplaced fragment automatically
            SelectNextUnplacedFragment();

            UpdateSelectionHighlight();
            UpdateSentencePreview();

            // Check if all 6 slots are filled, auto-validate or prompt to confirm
            if (AreAllSlotsFilled())
            {
                UpdateStatusDisplay("All slots placed! Press [E] or Confirm to verify the ancient message.");
            }
            else
            {
                UpdateStatusDisplay($"Placed '{frag.word}' into slot {slotIndex + 1}.");
            }
        }

        private void RemoveFragmentFromSlot(int fragmentIndex)
        {
            var frag = fragments[fragmentIndex];
            if (frag.currentSlotIndex >= 0)
            {
                socketAssignments[frag.currentSlotIndex] = -1;
                frag.currentSlotIndex = -1;
            }
        }

        public void ResetAllSlots()
        {
            if (isPuzzleSolved) return;

            for (int i = 0; i < fragments.Count; i++)
            {
                fragments[i].currentSlotIndex = -1;
            }

            for (int s = 0; s < socketAssignments.Length; s++)
            {
                socketAssignments[s] = -1;
            }

            selectedFragmentIndex = 0;
            UpdateSelectionHighlight();
            UpdateSentencePreview();
            UpdateStatusDisplay("All slots cleared. Arrange fragments in order to activate the crystal.");

            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayStoneRotate();
            }
        }

        private void SelectNextUnplacedFragment()
        {
            for (int i = 0; i < fragments.Count; i++)
            {
                if (fragments[i].currentSlotIndex < 0)
                {
                    selectedFragmentIndex = i;
                    return;
                }
            }
        }

        private bool AreAllSlotsFilled()
        {
            for (int s = 0; s < socketAssignments.Length; s++)
            {
                if (socketAssignments[s] < 0) return false;
            }
            return true;
        }

        public void CheckSentenceCompletion()
        {
            if (isPuzzleSolved) return;

            if (!AreAllSlotsFilled())
            {
                if (PuzzleAudioSynthesizer.Instance != null) PuzzleAudioSynthesizer.Instance.PlaySubtleError();
                UpdateStatusDisplay("Incomplete! Place all 6 fragments into the altar sockets.");
                return;
            }

            // Check word order: "come", "to", "the", "tower", "at", "sunset"
            bool matches = true;
            for (int s = 0; s < socketAssignments.Length; s++)
            {
                int fragIdx = socketAssignments[s];
                if (fragIdx < 0 || !string.Equals(fragments[fragIdx].word, targetWords[s], StringComparison.OrdinalIgnoreCase))
                {
                    matches = false;
                    break;
                }
            }

            if (matches)
            {
                SolvePuzzle();
            }
            else
            {
                if (PuzzleAudioSynthesizer.Instance != null)
                {
                    PuzzleAudioSynthesizer.Instance.PlaySubtleError();
                }
                UpdateStatusDisplay("The sentence does not make sense. Hint: Where and when are you being summoned?");
            }
        }

        private void SolvePuzzle()
        {
            isPuzzleSolved = true;

            // Audio Fanfare
            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayVictoryFanfare();
            }

            // Activate Crystal
            if (centralCrystalLight != null)
            {
                centralCrystalLight.color = new Color(0.2f, 0.95f, 1.0f);
                centralCrystalLight.intensity = 8.5f;
            }

            if (crystalParticles != null)
            {
                crystalParticles.Play();
            }

            if (crystalMaterial != null)
            {
                crystalMaterial.SetColor("_EmissionColor", new Color(0.2f, 0.95f, 1.0f) * 6.0f);
            }

            // Notify EventBus & ThirdClue
            PuzzleEventBus.TriggerPuzzleSolved("PZ-TASK5-MESSAGE-001");

            if (ThirdClue.Instance != null)
            {
                ThirdClue.Instance.PuzzleSolved();
            }

            if (QuestManager.Instance != null)
            {
                QuestManager.Instance.UpdateObjective("Deciphered Message: 'Come to the tower at sunset'. Proceed to the Tower.");
            }

            UpdateSentencePreview();
            UpdateStatusDisplay("★ CELESTIAL CRYSTAL ACTIVATED! ★ 'Come to the tower at sunset'");

            if (victoryPanel != null)
            {
                victoryPanel.SetActive(true);
            }

            Debug.Log("[ThirdPuzzleController] Puzzle SOLVED! Message reconstructed: 'come to the tower at sunset'.");
        }

        private void UpdateSelectionHighlight()
        {
            for (int i = 0; i < fragments.Count; i++)
            {
                var frag = fragments[i];
                bool isSel = (i == selectedFragmentIndex) && !isPuzzleSolved;
                frag.isSelected = isSel;

                if (frag.textMesh != null)
                {
                    if (isSel)
                    {
                        frag.textMesh.color = new Color(1f, 0.95f, 0.4f); // Golden glow for selected
                    }
                    else if (frag.currentSlotIndex >= 0)
                    {
                        frag.textMesh.color = new Color(0.3f, 1f, 0.6f); // Soft emerald green when locked in slot
                    }
                    else
                    {
                        frag.textMesh.color = new Color(0f, 0.92f, 1f); // Vibrant cyan in pool
                    }
                }
            }
        }

        private void UpdateSentencePreview()
        {
            if (sentencePreviewText == null) return;

            string assembled = "";
            for (int s = 0; s < socketAssignments.Length; s++)
            {
                int fragIdx = socketAssignments[s];
                if (fragIdx >= 0)
                {
                    assembled += $"<color=#00E5FF>[ {fragments[fragIdx].word} ]</color> ";
                }
                else
                {
                    assembled += $"<color=#778899>[ {s + 1}: _ ]</color> ";
                }
            }

            sentencePreviewText.text = "<b>Current Altar Message:</b> " + assembled;
        }

        private void UpdateStatusDisplay(string msg)
        {
            if (statusText != null)
            {
                statusText.text = msg;
            }
        }

        public void ReturnToVillage()
        {
            Debug.Log("[ThirdPuzzleController] Returning to Village exploration scene...");
            StartCoroutine(ReturnRoutine());
        }

        private IEnumerator ReturnRoutine()
        {
            PuzzleScreenFader fader = PuzzleScreenFader.GetOrCreate();
            if (fader != null)
            {
                yield return fader.FadeOut(0.5f);
            }
            else
            {
                yield return new WaitForSeconds(0.2f);
            }

            SceneManager.LoadScene("Stage_1_1_Village");
        }
    }
}
