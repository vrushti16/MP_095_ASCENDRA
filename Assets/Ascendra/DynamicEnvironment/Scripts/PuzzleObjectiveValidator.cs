using System;
using System.Collections.Generic;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Evaluates 3D physical puzzle manipulation directly in the scene.
    /// Eliminates multiple-choice options, quiz cards, and UI popups.
    /// Provides subtle in-world feedback on incorrect actions and grand celebration on success.
    /// </summary>
    [ExecuteAlways]
    public class PuzzleObjectiveValidator : MonoBehaviour
    {
        public static PuzzleObjectiveValidator Instance { get; private set; }

        private PuzzleData currentPuzzle;
        private List<string> selectedSequence = new List<string>();
        private bool isSolved = false;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                if (Application.isPlaying)
                    Destroy(this);
                else
                    DestroyImmediate(this);
                return;
            }
            Instance = this;
        }

        public void RegisterListeners()
        {
            PuzzleEventBus.OnPuzzleReceived -= SetCurrentPuzzle;
            PuzzleEventBus.OnPuzzleReceived += SetCurrentPuzzle;
            PuzzleEventBus.OnPuzzleElementInteracted -= HandleElementInteracted;
            PuzzleEventBus.OnPuzzleElementInteracted += HandleElementInteracted;
        }

        public void UnregisterListeners()
        {
            PuzzleEventBus.OnPuzzleReceived -= SetCurrentPuzzle;
            PuzzleEventBus.OnPuzzleElementInteracted -= HandleElementInteracted;
        }

        private void OnEnable()
        {
            RegisterListeners();
        }

        private void OnDisable()
        {
            UnregisterListeners();
        }

        public void SetCurrentPuzzle(PuzzleData puzzle)
        {
            RegisterListeners();
            currentPuzzle = puzzle;
            selectedSequence.Clear();
            isSolved = false;
            Debug.Log($"[PuzzleObjectiveValidator] Initialized validation for puzzle: {puzzle?.puzzleId}. Target Answer: '{puzzle?.answer}'");
        }

        private void HandleElementInteracted(PuzzleElement element)
        {
            if (isSolved || currentPuzzle == null || element == null) return;

            Debug.Log($"[PuzzleObjectiveValidator] Evaluating element '{element.elementId}' with current state value: '{element.value}' against expected: '{currentPuzzle.answer}'");

            // Evaluate according to interaction mode
            if (element.interactionMode == ElementInteractionMode.RotateDial)
            {
                EvaluateDialValue(element);
            }
            else if (element.interactionMode == ElementInteractionMode.PressStep)
            {
                EvaluateSequenceStep(element);
            }
            else
            {
                EvaluateDialValue(element);
            }
        }

        private void EvaluateDialValue(PuzzleElement dialElement)
        {
            string expected = "36";
            if (currentPuzzle != null && !string.IsNullOrEmpty(currentPuzzle.answer) && currentPuzzle.answer != "??")
            {
                expected = currentPuzzle.answer.Trim();
            }
            else if (currentPuzzle != null && !string.IsNullOrEmpty(currentPuzzle.solution) && currentPuzzle.solution != "??")
            {
                expected = currentPuzzle.solution.Trim();
            }

            string currentVal = dialElement.value?.Trim();
            if (string.IsNullOrEmpty(currentVal) || currentVal == "??")
            {
                return;
            }

            bool isMatch = string.Equals(currentVal, expected, StringComparison.OrdinalIgnoreCase);

            PuzzleElement[] allPillars = FindObjectsByType<PuzzleElement>(FindObjectsSortMode.None);

            if (isMatch)
            {
                Debug.Log($"[PuzzleObjectiveValidator] CORRECT! Value '{currentVal}' matches expected. Setting all pillars to GREEN!");

                Color greenColor = new Color(0.2f, 1.0f, 0.35f);
                foreach (var pillar in allPillars)
                {
                    pillar.SetPillarColor(greenColor, 3.5f, isSuccess: true);
                }

                Light[] allLights = FindObjectsByType<Light>(FindObjectsSortMode.None);
                foreach (var lt in allLights)
                {
                    if (lt != null && (lt.name.Contains("Brazier") || lt.name.Contains("Atmosphere")))
                    {
                        lt.color = greenColor;
                    }
                }

                MarkSolved(dialElement);
            }
            else
            {
                Debug.Log($"[PuzzleObjectiveValidator] INCORRECT! Value '{currentVal}' (expected '{expected}'). Setting all pillars to RED!");

                Color redColor = new Color(1.0f, 0.18f, 0.18f);
                foreach (var pillar in allPillars)
                {
                    pillar.SetPillarColor(redColor, 2.5f, isSuccess: false);
                }

                Light[] allLights = FindObjectsByType<Light>(FindObjectsSortMode.None);
                foreach (var lt in allLights)
                {
                    if (lt != null && (lt.name.Contains("Brazier") || lt.name.Contains("Atmosphere")))
                    {
                        lt.color = redColor;
                    }
                }

                if (PuzzleAudioSynthesizer.Instance != null)
                {
                    PuzzleAudioSynthesizer.Instance.PlaySubtleError();
                }
            }
        }

        private void EvaluateSequenceStep(PuzzleElement stepElement)
        {
            if (stepElement.isSelected)
            {
                selectedSequence.Add(stepElement.value);
            }
            else
            {
                selectedSequence.Remove(stepElement.value);
            }

            // For sequence order puzzles
            int requiredCount = Mathf.Min(3, currentPuzzle.elements != null ? currentPuzzle.elements.Count : 3);
            if (selectedSequence.Count >= requiredCount)
            {
                MarkSolved(stepElement);
            }
        }

        private void MarkSolved(PuzzleElement primaryElement)
        {
            if (isSolved) return;
            isSolved = true;

            Debug.Log($"[PuzzleObjectiveValidator] *** PUZZLE SOLVED: {currentPuzzle?.puzzleId} ***");

            // Celebrate on primary element
            if (primaryElement != null)
            {
                primaryElement.PlaySuccessCelebration();
            }

            // Lock all elements
            PuzzleElement[] allElements = FindObjectsByType<PuzzleElement>(FindObjectsSortMode.None);
            foreach (var elem in allElements)
            {
                elem.isLocked = true;
            }

            // Fire solved event on bus
            PuzzleEventBus.TriggerPuzzleSolved(currentPuzzle?.puzzleId);
        }
    }
}
