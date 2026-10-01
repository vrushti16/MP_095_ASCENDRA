using System;
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    public enum ElementInteractionMode
    {
        RotateDial,        // Clicks rotate stone dial and cycle values (e.g. number wheels, matrix tiles)
        PressStep,         // Clicks depress stone into floor (e.g. sequence steps, plates)
        RotateAlignment    // Clicks rotate 90 degrees to align symbols/runes
    }

    /// <summary>
    /// Represents an individual physical 3D puzzle element in the dedicated puzzle encounter.
    /// Provides hover highlighting, direct physical manipulation (rotation, stepping),
    /// dynamic real-time state updates, and subtle in-world feedback without quiz UI.
    /// </summary>
    public class PuzzleElement : MonoBehaviour
    {
        [Header("Identity")]
        public string elementId;
        public string puzzleId;
        public string elementType;
        public string value;
        public string label;
        public int index;

        [Header("Interaction State")]
        public bool isInteractable = true;
        public bool isHovered = false;
        public bool isSelected = false;
        public bool isLocked = false;
        public ElementInteractionMode interactionMode = ElementInteractionMode.RotateDial;

        [Header("Dial / Candidate Values")]
        public List<string> candidateValues = new List<string>();
        public int currentCandidateIndex = 0;
        public float currentRotationY = 0f;

        [Header("Visual References")]
        [SerializeField] private List<MeshRenderer> meshRenderers = new List<MeshRenderer>();
        [SerializeField] private TextMeshPro labelTextMesh;
        [SerializeField] private Light glowLight;

        private List<Material> originalMaterials = new List<Material>();
        private List<Color> originalColors = new List<Color>();
        private Vector3 initialPosition;
        private Vector3 initialScale;
        private Coroutine animateCoroutine;
        private Coroutine flashCoroutine;
        private Transform playerTransform;
        private GameObject interactionPromptObj;
        private TextMeshPro promptTextMesh;

        private void Awake()
        {
            FindRenderers();

            if (labelTextMesh == null)
                labelTextMesh = GetComponentInChildren<TextMeshPro>();

            if (glowLight == null)
                glowLight = GetComponentInChildren<Light>();

            initialPosition = transform.localPosition;
            initialScale = transform.localScale;
        }

        private void Start()
        {
            ResolvePlayer();
            CreateInteractionPrompt();
        }

        private void ResolvePlayer()
        {
            if (playerTransform == null)
            {
                GameObject p = GameObject.FindWithTag("Player");
                if (p == null) p = GameObject.Find("Huscarl");
                if (p == null) p = GameObject.Find("PlayerRoot");
                if (p != null) playerTransform = p.transform;
            }
        }

        private void CreateInteractionPrompt()
        {
            if (!isInteractable) return;
            if (interactionPromptObj != null) return;

            interactionPromptObj = new GameObject("InteractionPrompt3D");
            interactionPromptObj.transform.SetParent(transform, false);
            float promptY = (value == "??" || elementId == "t5") ? 1.45f : 2.2f;
            interactionPromptObj.transform.localPosition = Vector3.up * promptY;
            interactionPromptObj.transform.rotation = Quaternion.Euler(38f, 45f, 0f);

            promptTextMesh = interactionPromptObj.AddComponent<TextMeshPro>();
            promptTextMesh.text = "<size=80%><color=#FFEB3B><b>[Click]</b></color> or <color=#00E676><b>[E]</b></color> <color=#FFFFFF>Choose Answer</color></size>";
            promptTextMesh.fontSize = 3.2f;
            promptTextMesh.alignment = TextAlignmentOptions.Center;
            promptTextMesh.outlineColor = new Color32(10, 10, 15, 255);
            promptTextMesh.outlineWidth = 0.25f;

            RectTransform rt = interactionPromptObj.GetComponent<RectTransform>();
            if (rt != null) rt.sizeDelta = new Vector2(4.5f, 1.2f);

            interactionPromptObj.SetActive(false);
        }

        private void Update()
        {
            if (!isInteractable || isLocked)
            {
                if (interactionPromptObj != null && interactionPromptObj.activeSelf)
                    interactionPromptObj.SetActive(false);
                return;
            }

            if (playerTransform == null) ResolvePlayer();

            bool playerNear = false;
            if (playerTransform != null)
            {
                float dist = Vector3.Distance(transform.position, playerTransform.position);
                if (dist <= 8.0f)
                {
                    playerNear = true;
                }
            }

            bool showPrompt = isHovered || playerNear;
            if (interactionPromptObj != null)
            {
                if (interactionPromptObj.activeSelf != showPrompt)
                    interactionPromptObj.SetActive(showPrompt);

                if (showPrompt && Camera.main != null)
                {
                    interactionPromptObj.transform.rotation = Camera.main.transform.rotation;
                }
            }

            // Direct keyboard trigger when standing near the element or hovering
            if ((playerNear || isHovered) && (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Space)))
            {
                Interact();
            }
        }

        // Direct Unity mouse event handlers
        private void OnMouseDown()
        {
            if (isInteractable && !isLocked)
            {
                Interact();
            }
        }

        private void OnMouseEnter()
        {
            if (isInteractable && !isLocked)
            {
                SetHovered(true);
            }
        }

        private void OnMouseExit()
        {
            if (isInteractable && !isLocked)
            {
                SetHovered(false);
            }
        }

        private void FindRenderers()
        {
            meshRenderers.Clear();
            originalMaterials.Clear();
            originalColors.Clear();

            MeshRenderer[] found = GetComponentsInChildren<MeshRenderer>();
            if (found != null)
            {
                foreach (var mr in found)
                {
                    if (mr != null && mr.GetComponent<TextMeshPro>() == null)
                    {
                        meshRenderers.Add(mr);
                        Material mat = Application.isPlaying ? mr.material : mr.sharedMaterial;
                        if (mat != null)
                        {
                            originalMaterials.Add(mat);
                            originalColors.Add(mat.HasProperty("_Color") ? mat.color : Color.white);
                        }
                    }
                }
            }
        }

        public void Initialize(string elemId, string puzId, string elemType, string val, string lbl, int idx)
        {
            elementId = elemId;
            puzzleId = puzId;
            elementType = elemType;
            value = val;
            label = !string.IsNullOrEmpty(val) ? val : lbl;
            index = idx;

            FindRenderers();
            if (labelTextMesh == null) labelTextMesh = GetComponentInChildren<TextMeshPro>();
            UpdateLabelText();

            // Setup default candidate values for rotating dials if applicable
            if (candidateValues.Count == 0)
            {
                candidateValues = new List<string> { "24", "30", "36", "40", "42" };
                currentCandidateIndex = candidateValues.IndexOf(value);
                if (currentCandidateIndex < 0) currentCandidateIndex = -1;
            }

            // Create dedicated subtle rune glow light if missing
            if (glowLight == null)
            {
                GameObject lightObj = new GameObject("RuneGlowLight");
                lightObj.transform.SetParent(transform, false);
                lightObj.transform.localPosition = Vector3.up * 1.2f;
                glowLight = lightObj.AddComponent<Light>();
                glowLight.type = LightType.Point;
                glowLight.range = 3.5f;
                glowLight.intensity = isInteractable ? 1.4f : 0.6f;
                glowLight.color = (value == "??" || isInteractable) ? new Color(1.0f, 0.75f, 0.2f) : new Color(0.2f, 0.7f, 1.0f);
            }
        }

        public void SetCandidateValues(List<string> candidates, string initialVal)
        {
            if (candidates != null && candidates.Count > 0)
            {
                candidateValues = new List<string>(candidates);
                candidateValues.RemoveAll(c => c == "??"); // Player chooses from numbers only

                if (initialVal == "??")
                {
                    currentCandidateIndex = -1; // Next cycle starts at index 0
                    SetValue("??");
                }
                else
                {
                    currentCandidateIndex = candidateValues.IndexOf(initialVal);
                    if (currentCandidateIndex < 0) currentCandidateIndex = 0;
                    SetValue(candidateValues[currentCandidateIndex]);
                }
            }
        }

        public void SetValue(string newVal)
        {
            value = newVal;
            label = newVal;
            UpdateLabelText();
        }

        public void UpdateLabelText()
        {
            string display = !string.IsNullOrEmpty(value) ? value : label;
            if (labelTextMesh != null)
            {
                labelTextMesh.text = display;
                if (isPillarSuccess)
                    labelTextMesh.color = new Color(0.2f, 1.0f, 0.35f);
                else if (isPillarError)
                    labelTextMesh.color = new Color(1.0f, 0.25f, 0.25f);
                else
                    labelTextMesh.color = (display == "??") ? new Color(1.0f, 0.85f, 0.25f) : new Color(0.98f, 0.98f, 0.94f);
            }
            else
            {
                var tm = GetComponentInChildren<TextMesh>();
                if (tm != null) tm.text = display;
            }
        }

        [Header("Pillar State")]
        public bool isPillarSuccess = false;
        public bool isPillarError = false;

        public void SetPillarColor(Color color, float intensity = 2.5f, bool isSuccess = false)
        {
            isPillarSuccess = isSuccess;
            isPillarError = !isSuccess;

            for (int i = 0; i < meshRenderers.Count; i++)
            {
                if (meshRenderers[i] != null && meshRenderers[i].material != null)
                {
                    if (meshRenderers[i].material.HasProperty("_BaseColor"))
                        meshRenderers[i].material.SetColor("_BaseColor", color);
                    if (meshRenderers[i].material.HasProperty("_Color"))
                        meshRenderers[i].material.SetColor("_Color", color);
                    meshRenderers[i].material.color = color;
                }
            }

            if (glowLight != null)
            {
                glowLight.color = color;
                glowLight.intensity = intensity;
            }

            UpdateLabelText();
        }

        // ==========================================
        // Hover Highlighting
        // ==========================================

        public void SetHovered(bool hovered)
        {
            if (isLocked || !isInteractable) return;
            if (isHovered == hovered) return;

            isHovered = hovered;
            UpdateVisualFeedback();
        }

        public void SetSelected(bool selected)
        {
            if (isLocked) return;
            isSelected = selected;
            UpdateVisualFeedback();
        }

        public void ToggleSelect()
        {
            SetSelected(!isSelected);
        }

        private void UpdateVisualFeedback()
        {
            Color activeColor;
            float lightBoost = 1.0f;

            if (isPillarSuccess)
            {
                activeColor = new Color(0.2f, 1.0f, 0.35f); // Vibrant emerald green
                lightBoost = 3.5f;
            }
            else if (isPillarError)
            {
                activeColor = new Color(1.0f, 0.18f, 0.18f); // Warning red
                lightBoost = 2.5f;
            }
            else if (isSelected)
            {
                activeColor = new Color(0.3f, 1.0f, 0.5f); // Solved/selected emerald
                lightBoost = 2.2f;
            }
            else if (isHovered)
            {
                activeColor = new Color(1.0f, 0.9f, 0.35f); // Warm golden focus highlight
                lightBoost = 2.5f;
            }
            else if (isInteractable)
            {
                activeColor = (value == "??") ? new Color(1.0f, 0.75f, 0.2f) : new Color(0.4f, 0.8f, 1.0f);
                lightBoost = 1.2f;
            }
            else
            {
                activeColor = Color.white;
                lightBoost = 0.6f;
            }

            for (int i = 0; i < meshRenderers.Count; i++)
            {
                if (meshRenderers[i] != null && meshRenderers[i].material != null)
                {
                    if (isPillarSuccess || isPillarError || isHovered || isSelected)
                    {
                        meshRenderers[i].material.color = activeColor;
                    }
                    else
                    {
                        if (i < originalColors.Count)
                            meshRenderers[i].material.color = originalColors[i];
                        else
                            meshRenderers[i].material.color = Color.white;
                    }
                }
            }

            if (glowLight != null)
            {
                glowLight.color = activeColor;
                glowLight.intensity = lightBoost;
            }
        }

        // ==========================================
        // Direct Physical Manipulation
        // ==========================================

        /// <summary>
        /// Directly called when the player clicks or manipulates the 3D element in the world.
        /// </summary>
        public void Interact()
        {
            if (!isInteractable || isLocked) return;

            Debug.Log($"[PuzzleElement] Physical manipulation on element '{elementId}'. Mode: {interactionMode}");

            switch (interactionMode)
            {
                case ElementInteractionMode.RotateDial:
                    CycleDialValue();
                    break;

                case ElementInteractionMode.PressStep:
                    TriggerPressStep();
                    PuzzleEventBus.TriggerPuzzleElementInteracted(this);
                    break;

                case ElementInteractionMode.RotateAlignment:
                    RotateStep(90f);
                    PuzzleEventBus.TriggerPuzzleElementInteracted(this);
                    break;
            }
        }

        public void OpenChoiceSelection()
        {
            if (candidateValues == null || candidateValues.Count == 0) return;

            PuzzleChoiceDialog dialog = PuzzleChoiceDialog.GetOrCreate();
            if (dialog != null)
            {
                dialog.Show(candidateValues, OnOptionSelected);
            }
        }

        private void OnOptionSelected(string chosenValue)
        {
            Debug.Log($"[PuzzleElement] Player selected option '{chosenValue}' on '{elementId}'");

            currentCandidateIndex = candidateValues.IndexOf(chosenValue);
            SetValue(chosenValue);

            // Smooth physical 60-degree rotation of the dial/monument
            currentRotationY = (currentRotationY + 60f) % 360f;
            if (animateCoroutine != null) StopCoroutine(animateCoroutine);
            animateCoroutine = StartCoroutine(AnimateDialRotation(Quaternion.Euler(0f, currentRotationY, 0f)));

            // Play stone grinding audio + crisp mechanical click
            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayStoneRotate();
                PuzzleAudioSynthesizer.Instance.PlayMechanicalClick();
            }

            // Notify objective validator to evaluate selected answer
            PuzzleEventBus.TriggerPuzzleElementInteracted(this);
        }

        private void CycleDialValue()
        {
            if (candidateValues != null && candidateValues.Count > 0)
            {
                currentCandidateIndex = (currentCandidateIndex + 1) % candidateValues.Count;
                SetValue(candidateValues[currentCandidateIndex]);
            }

            // Smooth physical 60-degree rotation of the dial/monument
            currentRotationY = (currentRotationY + 60f) % 360f;
            if (animateCoroutine != null) StopCoroutine(animateCoroutine);
            animateCoroutine = StartCoroutine(AnimateDialRotation(Quaternion.Euler(0f, currentRotationY, 0f)));

            // Play stone grinding audio + crisp mechanical click
            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayStoneRotate();
                PuzzleAudioSynthesizer.Instance.PlayMechanicalClick();
            }

            // Notify objective validator to evaluate selected answer immediately
            PuzzleEventBus.TriggerPuzzleElementInteracted(this);
        }

        private void TriggerPressStep()
        {
            ToggleSelect();

            if (animateCoroutine != null) StopCoroutine(animateCoroutine);
            animateCoroutine = StartCoroutine(AnimateDepressPlate(isSelected));

            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayMechanicalClick();
            }
        }

        private void RotateStep(float angle)
        {
            currentRotationY = (currentRotationY + angle) % 360f;
            if (animateCoroutine != null) StopCoroutine(animateCoroutine);
            animateCoroutine = StartCoroutine(AnimateDialRotation(Quaternion.Euler(0f, currentRotationY, 0f)));

            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayStoneRotate();
            }
        }

        // ==========================================
        // Subtle In-World Feedback & Fanfare (No Quiz UI)
        // ==========================================

        /// <summary>
        /// Subtle in-world visual/audio feedback when an action is incorrect.
        /// Gentle amber/crimson flicker with no intrusive quiz UI.
        /// </summary>
        public void FlashSubtleError()
        {
            if (flashCoroutine != null) StopCoroutine(flashCoroutine);
            flashCoroutine = StartCoroutine(AnimateSubtleError());

            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlaySubtleError();
            }
        }

        /// <summary>
        /// Grand in-world fanfare when the element or whole puzzle solves.
        /// </summary>
        public void PlaySuccessCelebration()
        {
            isLocked = true;
            isSelected = true;

            if (flashCoroutine != null) StopCoroutine(flashCoroutine);
            flashCoroutine = StartCoroutine(AnimateSuccessFlare());

            if (PuzzleAudioSynthesizer.Instance != null)
            {
                PuzzleAudioSynthesizer.Instance.PlayVictoryFanfare();
            }
        }

        private IEnumerator AnimateSubtleError()
        {
            Color errorColor = new Color(0.95f, 0.28f, 0.28f); // Soft crimson/amber warning
            for (int i = 0; i < meshRenderers.Count; i++)
            {
                if (meshRenderers[i] != null) meshRenderers[i].material.color = errorColor;
            }

            if (glowLight != null)
            {
                glowLight.color = errorColor;
                glowLight.intensity = 2.0f;
            }

            // Gentle micro-shudder
            Vector3 shakeOffset = Vector3.right * 0.05f;
            transform.localPosition = initialPosition + shakeOffset;
            yield return new WaitForSeconds(0.06f);
            transform.localPosition = initialPosition - shakeOffset;
            yield return new WaitForSeconds(0.06f);
            transform.localPosition = initialPosition;

            yield return new WaitForSeconds(0.25f);
            UpdateVisualFeedback();
        }

        private IEnumerator AnimateSuccessFlare()
        {
            Color goldSolveColor = new Color(1.0f, 0.88f, 0.3f);
            for (int i = 0; i < meshRenderers.Count; i++)
            {
                if (meshRenderers[i] != null) meshRenderers[i].material.color = goldSolveColor;
            }

            if (glowLight != null)
            {
                glowLight.color = goldSolveColor;
                glowLight.intensity = 4.0f;
            }

            // Punch scale burst
            Vector3 burstScale = initialScale * 1.15f;
            float elapsed = 0f;
            float duration = 0.25f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                transform.localScale = Vector3.Lerp(initialScale, burstScale, elapsed / duration);
                yield return null;
            }

            elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                transform.localScale = Vector3.Lerp(burstScale, initialScale, elapsed / duration);
                yield return null;
            }

            transform.localScale = initialScale;
        }

        private IEnumerator AnimateDialRotation(Quaternion targetRot)
        {
            Quaternion startRot = transform.localRotation;
            float duration = 0.2f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.SmoothStep(0f, 1f, elapsed / duration);
                transform.localRotation = Quaternion.Slerp(startRot, targetRot, t);
                yield return null;
            }

            transform.localRotation = targetRot;
        }

        private IEnumerator AnimateDepressPlate(bool isDown)
        {
            Vector3 targetPos = isDown ? initialPosition - new Vector3(0f, 0.16f, 0f) : initialPosition;
            Vector3 startPos = transform.localPosition;
            float duration = 0.12f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                transform.localPosition = Vector3.Lerp(startPos, targetPos, elapsed / duration);
                yield return null;
            }

            transform.localPosition = targetPos;
        }
    }
}
