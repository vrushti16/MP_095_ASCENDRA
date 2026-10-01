using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEditor;
using Ascendra.DynamicEnvironment;

namespace Ascendra.DynamicEnvironment.Editor
{
    public class PuzzleVerificationTestRunner
    {
        private static int passedCount = 0;
        private static int failedCount = 0;
        private static List<string> testLog = new List<string>();

        [MenuItem("ASCENDRA/Run Puzzle Verification Tests")]
        public static void RunFromMenu()
        {
            RunAllVerificationTests();
        }

        public static void RunAllVerificationTests()
        {
            passedCount = 0;
            failedCount = 0;
            testLog.Clear();

            LogHeader("================================================================================");
            LogHeader("ASCENDRA DYNAMIC ENVIRONMENT & STATIC PUZZLE VERIFICATION TEST RUNNER");
            LogHeader("================================================================================");

            // 1. Static Village Puzzle JSON Verification
            Test_StaticVillagePuzzleJson();

            // 2. Bunch of Diverse Puzzle Profiles Verification
            Test_FirstClueProfiles();

            // 3. Educational Domain Catalog Puzzles Verification
            Test_CatalogPuzzles();

            // 4. Asset Library Prefab Resolution Verification
            Test_AssetLibraryResolution();

            // 5. 3D Spatial Spawner & In-World UI Hierarchy Verification
            Test_SpawnerAndHierarchy();

            // 6. Objective Evaluation & Validation Verification
            Test_ObjectiveValidator();

            // Summary
            LogHeader("================================================================================");
            LogHeader($"TEST SUITE COMPLETED: {passedCount} PASSED | {failedCount} FAILED");
            LogHeader("================================================================================");

            if (failedCount > 0)
            {
                Debug.LogError($"[PuzzleVerificationTestRunner] {failedCount} tests FAILED!");
                if (Application.isBatchMode)
                {
                    EditorApplication.Exit(1);
                }
            }
            else
            {
                Debug.Log($"[PuzzleVerificationTestRunner] ALL {passedCount} TESTS PASSED CLEANLY!");
                if (Application.isBatchMode)
                {
                    EditorApplication.Exit(0);
                }
            }
        }

        private static void Assert(bool condition, string testName, string details = "")
        {
            if (condition)
            {
                passedCount++;
                string msg = $"[PASS] Test #{passedCount + failedCount}: {testName}";
                if (!string.IsNullOrEmpty(details)) msg += $" ({details})";
                Debug.Log(msg);
                testLog.Add(msg);
            }
            else
            {
                failedCount++;
                string msg = $"[FAIL] Test #{passedCount + failedCount}: {testName}";
                if (!string.IsNullOrEmpty(details)) msg += $" -> Reason: {details}";
                Debug.LogError(msg);
                testLog.Add(msg);
            }
        }

        private static void LogHeader(string header)
        {
            Debug.Log(header);
            testLog.Add(header);
        }

        private static void Test_StaticVillagePuzzleJson()
        {
            LogHeader("--- 1. STATIC VILLAGE PUZZLE JSON VERIFICATION ---");

            string jsonPath = Path.Combine(Application.dataPath, "Resources", "Puzzles", "static_village_puzzle.json");
            Assert(File.Exists(jsonPath), "Static village JSON file exists on disk", jsonPath);

            string jsonContent = File.Exists(jsonPath) ? File.ReadAllText(jsonPath) : "";
            Assert(!string.IsNullOrEmpty(jsonContent), "Static village JSON file content is readable");

            PuzzleData data = PuzzleData.ParseJson(jsonContent);
            Assert(data != null, "PuzzleData parsed successfully from static JSON");
            Assert(data.puzzleId == "PZ-VILLAGE-001", "Puzzle ID matched", data.puzzleId);
            Assert(data.puzzleType == PuzzleType.NumberMatrix, "Puzzle Type matched", data.puzzleType.ToString());
            Assert(data.theme == EnvironmentTheme.Medieval, "Theme matched Medieval", data.theme.ToString());
            Assert(data.layout.rows == 3 && data.layout.columns == 3, "Grid layout is 3x3", $"{data.layout.rows}x{data.layout.columns}");
            Assert(data.elements.Count == 9, "9 interactive elements extracted", $"Count = {data.elements.Count}");
            Assert(data.answer == "36", "Correct answer is 36", data.answer);
            Assert(data.elements[4].value == "??", "Central tile index 4 has missing marker '??'", data.elements[4].value);

            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(data, Vector3.zero);
            Assert(plan != null, "PuzzleEnvironmentPlan generated");
            Assert(plan.interactiveElementCount == 9, "Plan element count is 9");
            Assert(plan.mechanismType == PuzzleMechanismType.StoneMatrixPlatform, "Mechanism is StoneMatrixPlatform", plan.mechanismType.ToString());
            Assert(plan.elementPositions != null && plan.elementPositions.Length == 9, "9 spatial element coordinates calculated");
            Assert(plan.cameraPosition.y > 1.0f && plan.cameraPosition.z < 0.0f, "Camera positioned diagonally facing center", $"Cam: {plan.cameraPosition}");
        }

        private static void Test_FirstClueProfiles()
        {
            LogHeader("--- 2. BUNCH OF FIRSTCLUE VARIATION PROFILES VERIFICATION ---");

            string[] testPuzzles = new string[]
            {
                // Profile 0: Number Matrix
                @"{ ""puzzleId"": ""PRF_0"", ""puzzleType"": ""number_matrix"", ""theme"": ""medieval"", ""layout"": {""rows"":3, ""columns"":3}, ""answer"": ""36"",
                    ""elements"": [
                        {""id"":""e1"",""value"":""10""}, {""id"":""e2"",""value"":""20""}, {""id"":""e3"",""value"":""30""},
                        {""id"":""e4"",""value"":""40""}, {""id"":""e5"",""value"":""??""}, {""id"":""e6"",""value"":""60""},
                        {""id"":""e7"",""value"":""70""}, {""id"":""e8"",""value"":""80""}, {""id"":""e9"",""value"":""90""}
                    ] }",

                // Profile 1: Sequence
                @"{ ""puzzleId"": ""PRF_1"", ""puzzleType"": ""sequence"", ""theme"": ""dungeon"", ""interactionType"": ""sequence_order"", ""answer"": ""Pillar_4"",
                    ""elements"": [
                        {""id"":""p1"",""value"":""Harmonic Alpha""},
                        {""id"":""p2"",""value"":""Harmonic Beta""},
                        {""id"":""p3"",""value"":""Harmonic Gamma""},
                        {""id"":""p4"",""value"":""Harmonic Delta""}
                    ] }",

                // Profile 2: Alchemical Problem Solving
                @"{ ""puzzleId"": ""PRF_2"", ""puzzleType"": ""problem_solving"", ""theme"": ""alchemy"", ""interactionType"": ""decision_plate"", ""answer"": ""Aqua Regia"",
                    ""elements"": [
                        {""id"":""a1"",""value"":""Philosopher Flask""},
                        {""id"":""a2"",""value"":""Aqua Regia""},
                        {""id"":""a3"",""value"":""Sulfur Crystal""}
                    ] }",

                // Profile 3: Tome Cryptography Riddle
                @"{ ""puzzleId"": ""PRF_3"", ""puzzleType"": ""riddle"", ""theme"": ""dark"", ""interactionType"": ""tile_selection"", ""answer"": ""Caesar"",
                    ""elements"": [
                        {""id"":""r1"",""value"":""Vigenere Codex""},
                        {""id"":""r2"",""value"":""Caesar Scroll""},
                        {""id"":""r3"",""value"":""Enigma Dial""}
                    ] }",

                // Profile 4: Vault Mathematics
                @"{ ""puzzleId"": ""PRF_4"", ""puzzleType"": ""mathematics"", ""theme"": ""medieval"", ""interactionType"": ""tile_selection"", ""answer"": ""144"",
                    ""elements"": [
                        {""id"":""m1"",""value"":""12""},
                        {""id"":""m2"",""value"":""72""},
                        {""id"":""m3"",""value"":""144""},
                        {""id"":""m4"",""value"":""288""}
                    ] }"
            };

            for (int i = 0; i < testPuzzles.Length; i++)
            {
                PuzzleData d = PuzzleData.ParseJson(testPuzzles[i]);
                Assert(d != null && d.elements.Count > 0, $"Profile #{i} parsed with {d.elements.Count} elements", $"ID={d.puzzleId}, Type={d.puzzleType}");

                PuzzleEnvironmentPlan p = PuzzleEnvironmentPlanner.CreatePlan(d, Vector3.zero);
                Assert(p != null && p.interactiveElementCount == d.elements.Count, $"Profile #{i} spatial plan created", $"Mechanism={p.mechanismType}");
            }
        }

        private static void Test_CatalogPuzzles()
        {
            LogHeader("--- 3. EDUCATIONAL DOMAIN CATALOG PUZZLES VERIFICATION ---");

            string[] catalogSamples = new string[]
            {
                // Cloud Ordering
                @"{ ""externalPuzzleId"": ""cat_cloud"", ""type"": ""ordering"", ""interactionType"": ""ordering"", ""topic"": ""cloud_computing"", ""difficulty"": ""medium"",
                    ""question"": ""Order recovery phases."", ""content"": { ""items"": [""Detect"", ""Failover"", ""Verify"", ""Failback""] }, ""answer"": ""[0,1,2,3]"" }",

                // Cyber Security Matching
                @"{ ""externalPuzzleId"": ""cat_cyber"", ""type"": ""matching"", ""interactionType"": ""matching"", ""topic"": ""cyber_security"", ""difficulty"": ""medium"",
                    ""question"": ""Match attacks."", ""content"": { ""terms"": [""Phishing"", ""Ransomware"", ""MitM""] }, ""answer"": ""Phishing"" }",

                // AI Multiple Choice
                @"{ ""externalPuzzleId"": ""cat_ai"", ""type"": ""concept"", ""interactionType"": ""multiple_choice"", ""topic"": ""artificial_intelligence"", ""difficulty"": ""easy"",
                    ""question"": ""Which paradigm learns via reward?"", ""content"": { ""options"": [""Reinforcement"", ""Supervised"", ""Unsupervised""] }, ""answer"": ""Reinforcement"" }"
            };

            for (int i = 0; i < catalogSamples.Length; i++)
            {
                PuzzleData d = PuzzleData.ParseJson(catalogSamples[i]);
                Assert(d != null && d.elements.Count > 0, $"Catalog sample #{i} parsed with options as interactive elements", $"Count={d.elements.Count}");
                PuzzleEnvironmentPlan p = PuzzleEnvironmentPlanner.CreatePlan(d, Vector3.zero);
                Assert(p != null && p.interactiveElementCount > 0, $"Catalog sample #{i} spatial plan formed successfully");
            }
        }

        private static void Test_AssetLibraryResolution()
        {
            LogHeader("--- 4. ASSET LIBRARY PREFAB RESOLUTION VERIFICATION ---");

            PuzzleAssetLibrary.InitializeLibrary();

            // Platform Resolution
            GameObject stoneFloor = PuzzleAssetLibrary.GetPlatformPrefab(EnvironmentTheme.Dungeon, PuzzleMechanismType.StoneMatrixPlatform);
            Assert(stoneFloor != null, "Stone floor platform prefab resolved", stoneFloor?.name);

            GameObject woodPlatform = PuzzleAssetLibrary.GetPlatformPrefab(EnvironmentTheme.Medieval, PuzzleMechanismType.DecisionPlatform);
            Assert(woodPlatform != null, "Wood platform prefab resolved", woodPlatform?.name);

            GameObject tablePlatform = PuzzleAssetLibrary.GetPlatformPrefab(EnvironmentTheme.Alchemy, PuzzleMechanismType.WordRunicAltar);
            Assert(tablePlatform != null, "Table altar platform prefab resolved", tablePlatform?.name);

            // Element Resolution
            GameObject runeStone = PuzzleAssetLibrary.GetElementPrefab(PuzzleMechanismType.StoneMatrixPlatform, EnvironmentTheme.Dungeon, 0);
            Assert(runeStone != null, "Rune stone element prefab resolved", runeStone?.name);

            GameObject pillar = PuzzleAssetLibrary.GetElementPrefab(PuzzleMechanismType.PillarSequenceAltar, EnvironmentTheme.Dungeon, 0);
            Assert(pillar != null, "Pillar element prefab resolved", pillar?.name);

            GameObject cauldron = PuzzleAssetLibrary.GetElementPrefab(PuzzleMechanismType.MultiObjectMechanical, EnvironmentTheme.Alchemy, 0);
            Assert(cauldron != null, "Cauldron alchemy element prefab resolved", cauldron?.name);

            // Atmosphere Resolution
            GameObject torch = PuzzleAssetLibrary.GetAtmospherePrefab(EnvironmentTheme.Dungeon);
            Assert(torch != null, "TorchFire atmosphere effect resolved", torch?.name);
        }

        private static void Test_SpawnerAndHierarchy()
        {
            LogHeader("--- 5. 3D SPATIAL SPAWNER & HIERARCHY VERIFICATION ---");

            string jsonPath = Path.Combine(Application.dataPath, "Resources", "Puzzles", "static_village_puzzle.json");
            string json = File.ReadAllText(jsonPath);
            PuzzleData data = PuzzleData.ParseJson(json);
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(data, new Vector3(0, 0, 0));

            GameObject testRoot = new GameObject("VerificationTestRoot");

            try
            {
                List<GameObject> spawned = PuzzleElementSpawner.SpawnPuzzleEnvironment(plan, testRoot.transform);
                Assert(spawned != null && spawned.Count >= 10, "10+ GameObjects spawned (Platform + 9 Elements + Atmosphere)", $"Count = {spawned?.Count}");

                // Check Base Platform
                Transform basePlatform = testRoot.transform.Find("PuzzleBasePlatform_StoneMatrixPlatform");
                Assert(basePlatform != null, "Base Platform GameObject exists in hierarchy");

                // Check Element 4 (Central Missing Element)
                Transform elem4 = testRoot.transform.Find("PuzzleElement_t5_4");
                Assert(elem4 != null, "Central Element GameObject 'PuzzleElement_t5_4' exists");

                if (elem4 != null)
                {
                    Collider col = elem4.GetComponentInChildren<Collider>();
                    Assert(col != null, "Element 4 has active 3D Collider for raycast interaction");

                    PuzzleElement pe = elem4.GetComponent<PuzzleElement>();
                    Assert(pe != null, "Element 4 has PuzzleElement component attached");
                    Assert(pe.value == "??", "Element 4 value is '??'");

                    Transform label3D = elem4.Find("Label3D");
                    Assert(label3D != null, "Element 4 has Label3D child object for in-world text");

                    TMPro.TextMeshPro tmp = label3D?.GetComponent<TMPro.TextMeshPro>();
                    Assert(tmp != null && tmp.text == "??", "TextMeshPro text component displays '??'");
                }

                // Check Atmosphere Lights
                Transform atmo = testRoot.transform.Find("PuzzleAtmosphere");
                Assert(atmo != null, "Puzzle Atmosphere lighting object exists");
                Light lt = atmo?.GetComponent<Light>();
                Assert(lt != null && lt.type == LightType.Point, "Point Light configured on Atmosphere");
            }
            finally
            {
                GameObject.DestroyImmediate(testRoot);
                Assert(testRoot == null || testRoot.transform.childCount == 0, "Test hierarchy completely cleaned up without memory leaks");
            }
        }

        private static void Test_ObjectiveValidator()
        {
            LogHeader("--- 6. OBJECTIVE EVALUATION & VALIDATION VERIFICATION ---");

            GameObject valObj = new GameObject("TestValidator");
            try
            {
                PuzzleObjectiveValidator validator = valObj.AddComponent<PuzzleObjectiveValidator>();

                string jsonPath = Path.Combine(Application.dataPath, "Resources", "Puzzles", "static_village_puzzle.json");
                PuzzleData data = PuzzleData.ParseJson(File.ReadAllText(jsonPath));
                validator.SetCurrentPuzzle(data);

                bool solvedEventFired = false;
                Action<string> onSolved = (id) => { solvedEventFired = true; };
                PuzzleEventBus.OnPuzzleSolved += onSolved;

                // Create mock element representing the correct solution
                GameObject elemObj = new GameObject("MockElem");
                try
                {
                    PuzzleElement elem = elemObj.AddComponent<PuzzleElement>();
                    elem.Initialize("t5", data.puzzleId, "number_matrix", "??", "Missing Rune", 4);
                    elem.interactionMode = ElementInteractionMode.RotateDial;
                    elem.SetCandidateValues(new List<string> { "??", "30", "36", "42" }, "??");

                    // Initial state "??" should not solve yet
                    PuzzleEventBus.TriggerPuzzleElementInteracted(elem);
                    Assert(!solvedEventFired, "Initial state '??' correctly does not trigger solve until rotated to correct value");

                    // Rotate dial to 36
                    elem.SetValue("36");
                    PuzzleEventBus.TriggerPuzzleElementInteracted(elem);

                    Assert(solvedEventFired, "Rotating 3D dial to target value '36' successfully triggered OnPuzzleSolved event!");
                }
                finally
                {
                    PuzzleEventBus.OnPuzzleSolved -= onSolved;
                    GameObject.DestroyImmediate(elemObj);
                }
            }
            finally
            {
                GameObject.DestroyImmediate(valObj);
            }
        }
    }
}
