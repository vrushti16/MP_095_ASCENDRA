using System;
using System.Collections.Generic;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    [Serializable]
    public class PuzzleEnvironmentPlan
    {
        [Header("Puzzle Identity & Strategy")]
        public string puzzleId;
        public PuzzleType puzzleType;
        public EnvironmentTheme theme;
        public PuzzleMechanismType mechanismType;
        public string difficulty = "medium";
        public int difficultyLevel = 3;
        public float audioIntensity = 0.7f;
        public string answer = "";

        [Header("Environment Structure")]
        public Vector3 environmentScale = Vector3.one;
        public bool floorRequirement = true;
        public bool wallRequirement = false; // Note: NO fixed room wall requirement by default!
        public bool decorationRequirement = true;

        [Header("Interactive Elements")]
        public int interactiveElementCount;
        public Vector3[] elementPositions;
        public Quaternion[] elementRotations;
        public Vector3[] elementScales;
        public string[] elementLabels;
        public string[] elementValues;
        public string[] elementIds;
        public string[] elementSemanticTypes;
        public string[] elementTargetValues;
        public bool[] elementInteractables;

        [Header("Camera Configuration")]
        public Vector3 cameraPosition;
        public Vector3 cameraTarget;
        public float cameraFieldOfView = 60f;

        [Header("Lighting & Visual Effects")]
        public Color lightingColor = Color.white;
        public float lightingIntensity = 1.2f;
        public string particleEffectType = "MysticGlow";

        [Header("Grid & Layout Metrics")]
        public int gridRows;
        public int gridColumns;
        public float spacingX = 2.0f;
        public float spacingZ = 2.0f;
        public Vector3 boundsCenter;
        public Vector3 boundsSize;

        public void DebugPrintPlan()
        {
            Debug.Log($"[ASCENDRA PUZZLE PLAN]\n" +
                      $"ID: {puzzleId}\n" +
                      $"Type: {puzzleType}\n" +
                      $"Theme: {theme}\n" +
                      $"Mechanism: {mechanismType}\n" +
                      $"Grid: {gridRows}x{gridColumns}\n" +
                      $"Interactive Elements: {interactiveElementCount}\n" +
                      $"Camera Pos: {cameraPosition}, LookTarget: {cameraTarget}");
        }
    }
}
