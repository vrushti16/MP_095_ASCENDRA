using System;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    public static class PuzzleEventBus
    {
        public static event Action<PuzzleData> OnPuzzleReceived;
        public static event Action<PuzzleEnvironmentPlan> OnPuzzleEnvironmentGenerating;
        public static event Action<PuzzleEnvironmentPlan> OnPuzzleEnvironmentReady;
        public static event Action<PuzzleElement> OnPuzzleElementInteracted;
        public static event Action<string> OnPuzzleSolved;
        public static event Action<string> OnPuzzleFailed;
        public static event Action OnPuzzleEnvironmentDestroyed;

        public static void TriggerPuzzleReceived(PuzzleData puzzle)
        {
            Debug.Log($"[PuzzleEventBus] OnPuzzleReceived: {puzzle?.puzzleId}");
            OnPuzzleReceived?.Invoke(puzzle);
        }

        public static void TriggerPuzzleEnvironmentGenerating(PuzzleEnvironmentPlan plan)
        {
            Debug.Log($"[PuzzleEventBus] OnPuzzleEnvironmentGenerating: {plan?.puzzleId}");
            OnPuzzleEnvironmentGenerating?.Invoke(plan);
        }

        public static void TriggerPuzzleEnvironmentReady(PuzzleEnvironmentPlan plan)
        {
            Debug.Log($"[PuzzleEventBus] OnPuzzleEnvironmentReady: {plan?.puzzleId}");
            OnPuzzleEnvironmentReady?.Invoke(plan);
        }

        public static void TriggerPuzzleElementInteracted(PuzzleElement element)
        {
            Debug.Log($"[PuzzleEventBus] OnPuzzleElementInteracted: {element?.elementId} (Value: {element?.value})");
            OnPuzzleElementInteracted?.Invoke(element);
        }

        public static void TriggerPuzzleSolved(string puzzleId)
        {
            Debug.Log($"[PuzzleEventBus] OnPuzzleSolved: {puzzleId}");
            OnPuzzleSolved?.Invoke(puzzleId);
        }

        public static void TriggerPuzzleFailed(string puzzleId)
        {
            Debug.Log($"[PuzzleEventBus] OnPuzzleFailed: {puzzleId}");
            OnPuzzleFailed?.Invoke(puzzleId);
        }

        public static void TriggerPuzzleEnvironmentDestroyed()
        {
            Debug.Log("[PuzzleEventBus] OnPuzzleEnvironmentDestroyed");
            OnPuzzleEnvironmentDestroyed?.Invoke();
        }

        public static void ClearAllSubscribers()
        {
            OnPuzzleReceived = null;
            OnPuzzleEnvironmentGenerating = null;
            OnPuzzleEnvironmentReady = null;
            OnPuzzleElementInteracted = null;
            OnPuzzleSolved = null;
            OnPuzzleFailed = null;
            OnPuzzleEnvironmentDestroyed = null;
        }
    }
}
