using System.Collections.Generic;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    public class PuzzleEnvironmentPlanner
    {
        public static PuzzleEnvironmentPlan CreatePlan(PuzzleData data, Vector3 origin)
        {
            PuzzleEnvironmentPlan plan = new PuzzleEnvironmentPlan();

            plan.puzzleId = data.puzzleId;
            plan.puzzleType = data.puzzleType;
            plan.theme = data.theme;
            plan.mechanismType = MapMechanismType(data.puzzleType);
            plan.answer = data.answer;

            int elementCount = data.elements.Count;
            if (elementCount == 0)
            {
                elementCount = data.layout.rows * data.layout.columns;
            }

            plan.interactiveElementCount = elementCount;
            plan.gridRows = data.layout.rows;
            plan.gridColumns = data.layout.columns;

            // Arrays for spatial elements
            plan.elementPositions = new Vector3[elementCount];
            plan.elementRotations = new Quaternion[elementCount];
            plan.elementScales = new Vector3[elementCount];
            plan.elementIds = new string[elementCount];
            plan.elementLabels = new string[elementCount];
            plan.elementValues = new string[elementCount];
            plan.elementSemanticTypes = new string[elementCount];
            plan.elementTargetValues = new string[elementCount];
            plan.elementInteractables = new bool[elementCount];

            // 1. Calculate Spatial Positions based on Mechanism Type & Layout
            switch (plan.mechanismType)
            {
                case PuzzleMechanismType.StoneMatrixPlatform:
                case PuzzleMechanismType.PhysicalNumberAssembly:
                case PuzzleMechanismType.CoreNetworkMatrix:
                    CalculateGridPositions(plan, data, origin);
                    break;

                case PuzzleMechanismType.PillarSequenceAltar:
                case PuzzleMechanismType.RotatingSymbolAltar:
                case PuzzleMechanismType.WordRunicAltar:
                    CalculateCircularArcPositions(plan, data, origin);
                    break;

                case PuzzleMechanismType.ConnectedSwitchBoard:
                case PuzzleMechanismType.MultiObjectMechanical:
                    CalculateDualRowPositions(plan, data, origin);
                    break;

                case PuzzleMechanismType.WorldDialogueStructure:
                case PuzzleMechanismType.DecisionPlatform:
                    CalculateDecisionPlatformPositions(plan, data, origin);
                    break;

                default:
                    CalculateGridPositions(plan, data, origin);
                    break;
            }

            plan.difficulty = data.difficulty;
            plan.difficultyLevel = data.difficultyLevel;

            // 2. Configure Theme Lighting, Particles & Audio Intensity based on Difficulty
            ConfigureThemeVisuals(plan, data);

            // 3. Adapt Camera position to framed bounding box
            ConfigureCamera(plan, origin);

            return plan;
        }

        private static PuzzleMechanismType MapMechanismType(PuzzleType puzzleType)
        {
            switch (puzzleType)
            {
                case PuzzleType.NumberMatrix: return PuzzleMechanismType.StoneMatrixPlatform;
                case PuzzleType.Sequence: return PuzzleMechanismType.PillarSequenceAltar;
                case PuzzleType.Pattern: return PuzzleMechanismType.RotatingSymbolAltar;
                case PuzzleType.LogicalReasoning: return PuzzleMechanismType.ConnectedSwitchBoard;
                case PuzzleType.Mathematics: return PuzzleMechanismType.PhysicalNumberAssembly;
                case PuzzleType.Communication: return PuzzleMechanismType.WorldDialogueStructure;
                case PuzzleType.English: return PuzzleMechanismType.WordRunicAltar;
                case PuzzleType.InterviewPreparation: case PuzzleType.Scenario: return PuzzleMechanismType.DecisionPlatform;
                case PuzzleType.ArtificialIntelligence: return PuzzleMechanismType.CoreNetworkMatrix;
                case PuzzleType.ProblemSolving: case PuzzleType.Riddle: return PuzzleMechanismType.MultiObjectMechanical;
                default: return PuzzleMechanismType.StoneMatrixPlatform;
            }
        }

        private static void CalculateGridPositions(PuzzleEnvironmentPlan plan, PuzzleData data, Vector3 origin)
        {
            int rows = Mathf.Max(1, plan.gridRows);
            int cols = Mathf.Max(1, plan.gridColumns);

            // Special handling for 3x3 StoneMatrixPlatform to precisely match isometric perspective reference image
            if (plan.mechanismType == PuzzleMechanismType.StoneMatrixPlatform && plan.interactiveElementCount == 9)
            {
                float s = 1.85f;
                // Diamond coordinates matching isometric camera at (-8.2, 7.5, -8.2) looking at (0,0,0)
                // In camera view:
                // Top: 12 (+s, +s), Upper-Left: 30 (0, +s), Upper-Right: 18 (+s, 0)
                // Mid-Left: 48 (-s, +s), Center: ?? (0, 0), Mid-Right: 24 (+s, -s)
                // Lower-Left: 54 (-s, 0), Lower-Right: 42 (0, -s), Bottom: 60 (-s, -s)
                Vector3[] diamondCoords = new Vector3[]
                {
                    new Vector3(+s, 0.32f, +s),  // 0: 12 (Back corner / Top of diamond)
                    new Vector3(+s, 0.32f, 0f),  // 1: 18 (Mid-back right / Upper-right)
                    new Vector3(+s, 0.32f, -s),  // 2: 24 (Far right / Mid-right)
                    new Vector3(0f, 0.32f, +s),  // 3: 30 (Mid-back left / Upper-left)
                    new Vector3(0f, 0.32f, 0f),  // 4: ?? (Center!)
                    new Vector3(0f, 0.32f, -s),  // 5: 42 (Mid-front right / Lower-right)
                    new Vector3(-s, 0.32f, +s),  // 6: 48 (Far left / Mid-left)
                    new Vector3(-s, 0.32f, 0f),  // 7: 54 (Mid-front left / Lower-left)
                    new Vector3(-s, 0.32f, -s)   // 8: 60 (Front corner / Bottom of diamond)
                };

                for (int i = 0; i < 9; i++)
                {
                    plan.elementPositions[i] = origin + diamondCoords[i];
                    plan.elementRotations[i] = Quaternion.Euler(0f, 225f, 0f); // Face camera at (-8.2, -8.2)
                    plan.elementScales[i] = new Vector3(1.25f, 1.35f, 1.25f);
                    AssignElementMetadata(plan, data, i);
                }

                plan.boundsCenter = origin;
                plan.boundsSize = new Vector3(7.2f, 2.5f, 7.2f);
                return;
            }

            // Standard grid calculation
            float spacingX = 2.2f;
            float spacingZ = 2.2f;

            if (cols > 3) spacingX = 1.8f;
            if (rows > 3) spacingZ = 1.8f;

            plan.spacingX = spacingX;
            plan.spacingZ = spacingZ;

            float totalWidth = (cols - 1) * spacingX;
            float totalDepth = (rows - 1) * spacingZ;

            for (int i = 0; i < plan.interactiveElementCount; i++)
            {
                int row = i / cols;
                int col = i % cols;

                float x = origin.x + (col - (cols - 1) * 0.5f) * spacingX;
                float z = origin.z + ((rows - 1) * 0.5f - row) * spacingZ;
                Vector3 pos = new Vector3(x, origin.y + 0.35f, z);

                plan.elementPositions[i] = pos;
                plan.elementRotations[i] = Quaternion.identity;
                plan.elementScales[i] = Vector3.one * 1.5f;

                AssignElementMetadata(plan, data, i);
            }

            plan.boundsCenter = origin;
            plan.boundsSize = new Vector3(totalWidth + 3.2f, 2f, totalDepth + 3.2f);
        }

        private static void CalculateCircularArcPositions(PuzzleEnvironmentPlan plan, PuzzleData data, Vector3 origin)
        {
            int count = plan.interactiveElementCount;
            float radius = Mathf.Max(3.0f, count * 0.8f);

            float totalAngle = 180f; // 180 degree semi-circle in front of camera
            float startAngle = -90f;
            float stepAngle = (count > 1) ? totalAngle / (count - 1) : 0f;

            for (int i = 0; i < count; i++)
            {
                float angle = (count > 1) ? (startAngle + i * stepAngle) : 0f;
                float rad = angle * Mathf.Deg2Rad;

                Vector3 pos = origin + new Vector3(Mathf.Sin(rad) * radius, 0.1f, Mathf.Cos(rad) * radius);
                Quaternion rot = Quaternion.Euler(0f, angle + 180f, 0f);

                plan.elementPositions[i] = pos;
                plan.elementRotations[i] = rot;
                plan.elementScales[i] = new Vector3(1.2f, 2.5f, 1.2f); // Pillar proportions

                AssignElementMetadata(plan, data, i);
            }

            plan.boundsCenter = origin + Vector3.forward * (radius * 0.5f);
            plan.boundsSize = new Vector3(radius * 2.2f, 3f, radius * 1.5f);
        }

        private static void CalculateDualRowPositions(PuzzleEnvironmentPlan plan, PuzzleData data, Vector3 origin)
        {
            int count = plan.interactiveElementCount;
            int rowSize = Mathf.CeilToInt(count / 2.0f);
            float spacingX = 2.5f;

            float totalWidth = (rowSize - 1) * spacingX;
            Vector3 startPos = origin - new Vector3(totalWidth * 0.5f, 0f, 0f);

            for (int i = 0; i < count; i++)
            {
                int r = i / rowSize;
                int c = i % rowSize;

                float zOffset = (r == 0) ? -1.8f : 1.8f;
                Vector3 pos = startPos + new Vector3(c * spacingX, 0.1f, zOffset);

                plan.elementPositions[i] = pos;
                plan.elementRotations[i] = Quaternion.identity;
                plan.elementScales[i] = Vector3.one * 1.3f;

                AssignElementMetadata(plan, data, i);
            }

            plan.boundsCenter = origin;
            plan.boundsSize = new Vector3(totalWidth + 3f, 2f, 6f);
        }

        private static void CalculateDecisionPlatformPositions(PuzzleEnvironmentPlan plan, PuzzleData data, Vector3 origin)
        {
            int count = plan.interactiveElementCount;
            float spacingX = 3.2f;
            float totalWidth = (count - 1) * spacingX;
            Vector3 startPos = origin - new Vector3(totalWidth * 0.5f, 0f, 0f);

            for (int i = 0; i < count; i++)
            {
                Vector3 pos = startPos + new Vector3(i * spacingX, 0.1f, 0f);
                plan.elementPositions[i] = pos;
                plan.elementRotations[i] = Quaternion.identity;
                plan.elementScales[i] = new Vector3(2.5f, 0.3f, 2.0f);

                AssignElementMetadata(plan, data, i);
            }

            plan.boundsCenter = origin;
            plan.boundsSize = new Vector3(totalWidth + 4f, 2f, 5f);
        }

        private static void AssignElementMetadata(PuzzleEnvironmentPlan plan, PuzzleData data, int index)
        {
            if (index < data.elements.Count)
            {
                plan.elementIds[index] = data.elements[index].id;
                plan.elementLabels[index] = data.elements[index].label;
                plan.elementValues[index] = data.elements[index].value;
                plan.elementSemanticTypes[index] = data.elements[index].semanticType;
                plan.elementTargetValues[index] = data.elements[index].targetValue;
                plan.elementInteractables[index] = data.elements[index].isInteractable;
            }
            else
            {
                plan.elementIds[index] = $"elem_{index}";
                plan.elementLabels[index] = $"Tile {index + 1}";
                plan.elementValues[index] = $"{index + 1}";
                plan.elementSemanticTypes[index] = "";
                plan.elementTargetValues[index] = "";
                plan.elementInteractables[index] = true;
            }
        }

        private static void ConfigureThemeVisuals(PuzzleEnvironmentPlan plan, PuzzleData data)
        {
            int diffLvl = data.difficultyLevel;
            float diffNorm = Mathf.Clamp01((diffLvl - 1) / 6.0f); // 0 (Beginning) to 1.0 (Legend)

            // Audio Intensity corresponding directly to difficulty
            plan.audioIntensity = Mathf.Lerp(0.45f, 1.0f, diffNorm);

            switch (plan.theme)
            {
                case EnvironmentTheme.Dungeon:
                    plan.lightingColor = Color.Lerp(new Color(1.0f, 0.85f, 0.6f), new Color(0.9f, 0.45f, 0.15f), diffNorm);
                    plan.lightingIntensity = Mathf.Lerp(1.0f, 2.2f, diffNorm);
                    plan.particleEffectType = diffLvl <= 2 ? "SoftEmbers" : (diffLvl <= 4 ? "TorchEmber" : "InfernalSpark");
                    break;
                case EnvironmentTheme.Dark:
                    plan.lightingColor = Color.Lerp(new Color(0.6f, 0.4f, 0.9f), new Color(0.35f, 0.05f, 0.75f), diffNorm);
                    plan.lightingIntensity = Mathf.Lerp(1.2f, 2.6f, diffNorm);
                    plan.particleEffectType = diffLvl <= 2 ? "NightMist" : (diffLvl <= 4 ? "ShadowMist" : "VoidStorm");
                    break;
                case EnvironmentTheme.Medieval:
                    plan.lightingColor = Color.Lerp(new Color(1.0f, 0.95f, 0.8f), new Color(1.0f, 0.7f, 0.4f), diffNorm);
                    plan.lightingIntensity = Mathf.Lerp(1.0f, 2.0f, diffNorm);
                    plan.particleEffectType = diffLvl <= 2 ? "SunPollen" : (diffLvl <= 4 ? "SunDust" : "SolarRays");
                    break;
                case EnvironmentTheme.Alchemy:
                    plan.lightingColor = Color.Lerp(new Color(0.4f, 0.9f, 0.9f), new Color(0.05f, 1.0f, 0.7f), diffNorm);
                    plan.lightingIntensity = Mathf.Lerp(1.3f, 2.5f, diffNorm);
                    plan.particleEffectType = diffLvl <= 2 ? "RunicGlow" : (diffLvl <= 4 ? "ArcaneSpark" : "EtherealVortex");
                    break;
            }
        }

        private static void ConfigureCamera(PuzzleEnvironmentPlan plan, Vector3 origin)
        {
            if (plan.mechanismType == PuzzleMechanismType.StoneMatrixPlatform)
            {
                // Exact 3/4 isometric perspective matching reference image
                plan.cameraPosition = plan.boundsCenter + new Vector3(-8.6f, 8.2f, -8.6f);
                plan.cameraTarget = plan.boundsCenter + Vector3.up * 0.4f;
                plan.cameraFieldOfView = 38f;
                return;
            }

            float maxDimension = Mathf.Max(plan.boundsSize.x, plan.boundsSize.z);
            float dist = Mathf.Max(4.5f, maxDimension * 1.1f);

            // Frame camera cleanly over the 3D puzzle platform in the village
            plan.cameraPosition = plan.boundsCenter + new Vector3(0f, dist * 0.6f, -dist * 0.75f);
            plan.cameraTarget = plan.boundsCenter + Vector3.up * 0.5f;
            plan.cameraFieldOfView = 55f;
        }
    }
}
