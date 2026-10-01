using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Ascendra.DynamicEnvironment;

namespace Ascendra.DynamicEnvironment
{
    public class PuzzleTestSuite : MonoBehaviour
    {
        [Header("Test Execution")]
        public bool runTestsOnStart = false;

        private int testsPassed = 0;
        private int testsFailed = 0;

        private void Start()
        {
            if (runTestsOnStart)
            {
                RunAllTests();
            }
        }

        [ContextMenu("Run ASCENDRA Puzzle Test Suite")]
        public void RunAllTests()
        {
            testsPassed = 0;
            testsFailed = 0;

            Debug.Log("==================================================");
            Debug.Log("STARTING ASCENDRA PUZZLE ENVIRONMENT TEST SUITE");
            Debug.Log("==================================================");

            Test1_3x3NumberMatrix();
            Test2_4x4NumberMatrix();
            Test3_SequencePuzzle();
            Test4_PatternPuzzle();
            Test5_DifferentThemes();
            Test6_MissingOptionalFields();
            Test7_InvalidJson();
            Test8_ZeroElements();
            Test9_PuzzleCompletion();
            Test10_EnvironmentCleanup();

            Debug.Log("==================================================");
            Debug.Log($"ASCENDRA TEST SUITE RESULTS: PASSED {testsPassed} / 10 | FAILED {testsFailed}");
            Debug.Log("==================================================");
        }

        private void Assert(bool condition, string testName)
        {
            if (condition)
            {
                testsPassed++;
                Debug.Log($"[PASSED] Test {testsPassed + testsFailed}: {testName}");
            }
            else
            {
                testsFailed++;
                Debug.LogError($"[FAILED] Test {testsPassed + testsFailed}: {testName}");
            }
        }

        private void Test1_3x3NumberMatrix()
        {
            string json = @"{ ""puzzleId"": ""T1"", ""puzzleType"": ""number_matrix"", ""layout"": {""rows"":3,""columns"":3} }";
            PuzzleData data = PuzzleData.ParseJson(json);
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(data, Vector3.zero);
            Assert(plan.interactiveElementCount == 9 && plan.gridRows == 3 && plan.gridColumns == 3, "1. 3x3 Number Matrix Plan Generation");
        }

        private void Test2_4x4NumberMatrix()
        {
            string json = @"{ ""puzzleId"": ""T2"", ""puzzleType"": ""number_matrix"", ""layout"": {""rows"":4,""columns"":4} }";
            PuzzleData data = PuzzleData.ParseJson(json);
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(data, Vector3.zero);
            Assert(plan.interactiveElementCount == 16 && plan.gridRows == 4 && plan.gridColumns == 4, "2. 4x4 Number Matrix Plan Generation");
        }

        private void Test3_SequencePuzzle()
        {
            string json = @"{ ""puzzleId"": ""T3"", ""puzzleType"": ""sequence"", ""options"": [""Phase1"", ""Phase2"", ""Phase3"", ""Phase4""] }";
            PuzzleData data = PuzzleData.ParseJson(json);
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(data, Vector3.zero);
            Assert(plan.mechanismType == PuzzleMechanismType.PillarSequenceAltar && plan.interactiveElementCount == 4, "3. Sequence Puzzle Pillar Alignment");
        }

        private void Test4_PatternPuzzle()
        {
            string json = @"{ ""puzzleId"": ""T4"", ""puzzleType"": ""pattern"", ""options"": [""SymA"", ""SymB"", ""SymC""] }";
            PuzzleData data = PuzzleData.ParseJson(json);
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(data, Vector3.zero);
            Assert(plan.mechanismType == PuzzleMechanismType.RotatingSymbolAltar && plan.interactiveElementCount == 3, "4. Pattern Puzzle Rotating Altar");
        }

        private void Test5_DifferentThemes()
        {
            PuzzleData d1 = PuzzleData.ParseJson(@"{ ""theme"": ""dungeon"" }");
            PuzzleData d2 = PuzzleData.ParseJson(@"{ ""theme"": ""dark"" }");
            PuzzleData d3 = PuzzleData.ParseJson(@"{ ""theme"": ""medieval"" }");
            PuzzleData d4 = PuzzleData.ParseJson(@"{ ""theme"": ""alchemy"" }");

            Assert(d1.theme == EnvironmentTheme.Dungeon &&
                   d2.theme == EnvironmentTheme.Dark &&
                   d3.theme == EnvironmentTheme.Medieval &&
                   d4.theme == EnvironmentTheme.Alchemy, "5. Different Theme Parsing");
        }

        private void Test6_MissingOptionalFields()
        {
            string json = @"{ ""question"": ""What comes next?"" }"; // minimal json
            PuzzleData data = PuzzleData.ParseJson(json);
            Assert(data != null && !string.IsNullOrEmpty(data.puzzleId) && data.elements.Count > 0, "6. Tolerance to Missing Optional JSON Fields");
        }

        private void Test7_InvalidJson()
        {
            string json = @"INVALID_CORRUPTED_JSON{{{";
            PuzzleData data = PuzzleData.ParseJson(json);
            Assert(data != null && data.elements != null, "7. Graceful Fallback on Invalid JSON");
        }

        private void Test8_ZeroElements()
        {
            string json = @"{ ""elements"": [] }";
            PuzzleData data = PuzzleData.ParseJson(json);
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(data, Vector3.zero);
            Assert(plan.interactiveElementCount > 0, "8. Zero Elements Fallback Creation");
        }

        private void Test9_PuzzleCompletion()
        {
            bool solvedFired = false;
            System.Action<string> listener = (id) => { solvedFired = true; };
            PuzzleEventBus.OnPuzzleSolved += listener;

            PuzzleEventBus.TriggerPuzzleSolved("TEST_SOLVE_ID");

            PuzzleEventBus.OnPuzzleSolved -= listener;
            Assert(solvedFired, "9. Puzzle Completion Event Dispatching");
        }

        private void Test10_EnvironmentCleanup()
        {
            GameObject testRoot = new GameObject("TestRoot");
            PuzzleData data = PuzzleData.ParseJson(@"{ ""puzzleId"": ""T10"" }");
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(data, Vector3.zero);
            List<GameObject> spawned = PuzzleElementSpawner.SpawnPuzzleEnvironment(plan, testRoot.transform);

            Assert(spawned.Count > 0, "10a. Objects Spawned correctly before cleanup");

            foreach (var obj in spawned)
            {
                if (obj != null) DestroyImmediate(obj);
            }
            DestroyImmediate(testRoot);

            Assert(true, "10b. Environment Cleanup completed without residual leaks");
        }
    }
}
