using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;
using TMPro;
using Ascendra.DynamicEnvironment;

namespace Ascendra.DynamicEnvironment.Editor
{
    [InitializeOnLoad]
    public class StaticPuzzleSceneBuilder
    {
        // Improved open courtyard clearing coordinates in Stage_1_1_Village, avoiding bridges & boulders
        public static readonly Vector3 VillageDefaultOrigin = new Vector3(75.0f, 22.1f, 53.0f);
        public static readonly string DedicatedScenePath = "Assets/Scenes/Gameplay/StaticVillagePuzzleScene.unity";
        public static readonly string VillageScenePath = "Assets/Scenes/Gameplay/Stage_1_1_Village.unity";
        public static readonly string ArtifactDir = @"C:\Users\DELL\.gemini\antigravity-ide\brain\2a77d1cc-3461-4a03-a22b-bb76fc15a40e";

        static StaticPuzzleSceneBuilder()
        {
            EditorApplication.update += CheckAutoTrigger;
        }

        [InitializeOnLoadMethod]
        private static void OnProjectLoaded()
        {
            EditorApplication.delayCall += CheckPendingBuildOrTrigger;
        }

        private static void CheckPendingBuildOrTrigger()
        {
            CheckAutoTrigger();
        }

        private static void CheckAutoTrigger()
        {
            string triggerPath = Path.Combine(Application.dataPath, "..", "Temp", "trigger_puzzle_build.txt");
            string secondTriggerPath = Path.Combine(Application.dataPath, "..", "Temp", "trigger_second_puzzle_build.txt");
            string thirdTriggerPath = Path.Combine(Application.dataPath, "..", "Temp", "trigger_third_puzzle_build.txt");

            if (File.Exists(thirdTriggerPath))
            {
                if (EditorApplication.isPlaying)
                {
                    EditorApplication.isPlaying = false;
                    return;
                }
                if (EditorApplication.isCompiling) return;
                try { File.Delete(thirdTriggerPath); } catch { }
                Debug.Log("[StaticPuzzleSceneBuilder] Third puzzle trigger detected! Executing BuildThirdPuzzleSceneAndRender...");
                AssetDatabase.Refresh(ImportAssetOptions.ForceUpdate);
                StaticThirdPuzzleSceneBuilder.BuildThirdPuzzleSceneAndRender();
                return;
            }

            if (File.Exists(secondTriggerPath))
            {
                if (EditorApplication.isPlaying)
                {
                    EditorApplication.isPlaying = false;
                    return;
                }
                if (EditorApplication.isCompiling) return;
                try { File.Delete(secondTriggerPath); } catch { }
                Debug.Log("[StaticPuzzleSceneBuilder] Second puzzle trigger detected! Executing BuildSecondPuzzleSceneAndRender...");
                AssetDatabase.Refresh(ImportAssetOptions.ForceUpdate);
                StaticSecondPuzzleSceneBuilder.BuildSecondPuzzleSceneAndRender();
                return;
            }

            if (File.Exists(triggerPath))
            {
                if (EditorApplication.isCompiling)
                {
                    EditorApplication.update -= WaitForCompilationAndBuild;
                    EditorApplication.update += WaitForCompilationAndBuild;
                    return;
                }

                try
                {
                    File.Delete(triggerPath);
                }
                catch { }

                Debug.Log("[StaticPuzzleSceneBuilder] Auto-trigger detected! Executing BuildBothScenesAndRender immediately...");
                BuildBothScenesAndRender();
            }
        }

        private static void WaitForCompilationAndBuild()
        {
            if (EditorApplication.isCompiling) return;
            EditorApplication.update -= WaitForCompilationAndBuild;
            Debug.Log("[StaticPuzzleSceneBuilder] Compilation verified! Running BuildBothScenesAndRender with latest code...");
            BuildBothScenesAndRender();
        }

        [MenuItem("ASCENDRA/Build Both Scenes and Capture")]
        public static void BuildBothScenesAndRender()
        {
            Debug.Log("[StaticPuzzleSceneBuilder] Starting full build for both static puzzle scenes...");
            
            // 1. Generate dedicated static village puzzle scene
            GenerateDedicatedStaticPuzzleScene();

            // 2. Place in Stage_1_1_Village courtyard
            PlaceStaticPuzzleInVillageScene();

            // 3. Generate second static puzzle scene (Task 4 & Task 5) and render!
            StaticSecondPuzzleSceneBuilder.BuildSecondPuzzleSceneAndRender();

            Debug.Log("[StaticPuzzleSceneBuilder] Successfully generated and captured all scenes!");
        }

        [MenuItem("ASCENDRA/Generate Dedicated Static Puzzle Scene")]
        public static void GenerateDedicatedStaticPuzzleScene()
        {
            PuzzleData puzzleData = LoadStaticPuzzleData();
            if (puzzleData == null) return;

            Debug.Log($"[StaticPuzzleSceneBuilder] Building Dedicated Static Puzzle Scene for '{puzzleData.title}'...");

            // Create a fresh scene
            Scene dedicatedScene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 1. Directional Sun Light (Warm golden sunlight matching target preview)
            GameObject sunObj = new GameObject("Directional Light");
            Light sun = sunObj.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1.0f, 0.90f, 0.74f);
            sun.intensity = 1.45f;
            sun.shadows = LightShadows.Soft;
            sunObj.transform.rotation = Quaternion.Euler(44f, -36f, 0f);

            // 2. Ambient Lighting & Stylized Sky
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.65f, 0.58f, 0.48f);
            Material skyMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/RPGPP_LT/Materials/rpgpp_lt_sky_a.mat");
            if (skyMat != null) RenderSettings.skybox = skyMat;

            // 3. Root Environment Container
            GameObject envSystem = new GameObject("PuzzleEnvironmentSystem");
            envSystem.transform.position = Vector3.zero;

            // 4. Courtyard Ground Foundation
            GameObject groundRoot = new GameObject("CourtyardGround");
            groundRoot.transform.SetParent(envSystem.transform, false);

            // Natural courtyard terrain base using RPGPP stylized sand/earth asset
            GameObject sandPrefab = LoadPrefab("rpgpp_lt_terrain_sand_01");
            if (sandPrefab != null)
            {
                GameObject groundSand = UnityEngine.Object.Instantiate(sandPrefab, groundRoot.transform, false);
                groundSand.name = "CourtyardGroundSand";
                groundSand.transform.localPosition = new Vector3(0f, -0.05f, 0f);
                groundSand.transform.localScale = new Vector3(4.5f, 1f, 4.5f);
            }
            else
            {
                // Fallback plane with native RPGPP Lit material
                GameObject groundMesh = GameObject.CreatePrimitive(PrimitiveType.Plane);
                groundMesh.name = "CourtyardGroundPlane";
                groundMesh.transform.SetParent(groundRoot.transform, false);
                groundMesh.transform.localPosition = new Vector3(0f, -0.05f, 0f);
                groundMesh.transform.localScale = new Vector3(3.2f, 1f, 3.2f);
                Material rpgppMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/RPGPP_LT/Materials/rpgpp_lt_mat_a.mat");
                if (rpgppMat != null)
                {
                    groundMesh.GetComponent<MeshRenderer>().sharedMaterial = rpgppMat;
                }
            }

            // 5. Create Spatial Plan at Origin (0,0,0)
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(puzzleData, Vector3.zero);
            PuzzleAssetLibrary.InitializeLibrary();

            // 6. Spawn 3D Puzzle Elements (Stepped stone dais, standing rune stones, 4 flanking fire braziers, clue tablet)
            GameObject puzzleRoot = new GameObject("PuzzleEnvironmentRoot");
            puzzleRoot.transform.SetParent(envSystem.transform, false);
            List<GameObject> spawned = PuzzleElementSpawner.SpawnPuzzleEnvironment(plan, puzzleRoot.transform);

            // 7. Add Courtyard Ruins Perimeter (Fences, pine trees, barrels, crates, scattered rocks)
            SpawnCourtyardRuinsPerimeter(envSystem.transform, Vector3.zero, plan.boundsSize);

            // 8. Wire System Components
            WireSystemComponents(envSystem, puzzleData);

            // 9. Main Camera Setup (Identical to Main Scene Stage_1_1_Village)
            GameObject camObj = new GameObject("Main Camera");
            Camera cam = camObj.AddComponent<Camera>();
            camObj.tag = "MainCamera";
            cam.fieldOfView = 60f;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 1000f;
            cam.clearFlags = CameraClearFlags.Skybox;
            camObj.AddComponent<AudioListener>();

            // Universal Additional Camera Data (URP)
            var uacData = camObj.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();
            uacData.renderShadows = true;

            // Puzzle Camera Controller
            PuzzleCameraController pcc = camObj.AddComponent<PuzzleCameraController>();

            // 10. Playable Character (Huscarl) identical to Main Scene
            ThirdPersonCamera tpCam = null;
            GameObject playerPrefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Huscarl/Prefabs/Huscarl.prefab");
            if (playerPrefab != null)
            {
                GameObject player = UnityEngine.Object.Instantiate(playerPrefab);
                player.name = "Huscarl";
                player.tag = "Player";
                player.transform.position = new Vector3(-3.6f, 0.15f, -1.2f);
                player.transform.rotation = Quaternion.Euler(0f, 55f, 0f);

                CharacterController cc = player.GetComponent<CharacterController>();
                if (cc == null) cc = player.AddComponent<CharacterController>();
                cc.center = new Vector3(0f, 0.9f, 0f);
                cc.height = 1.8f;
                cc.radius = 0.4f;

                PlayerMovement pm = player.GetComponent<PlayerMovement>();
                if (pm == null) pm = player.AddComponent<PlayerMovement>();
                pm.moveSpeed = 5f;
                pm.rotationSpeed = 10f;
                pm.gravity = -20f;
                pm.cameraTransform = cam.transform;

                // Attach ThirdPersonCamera with exact Main Scene tuning
                tpCam = camObj.AddComponent<ThirdPersonCamera>();
                tpCam.Target = player.transform;
                tpCam.Distance = 6f;
                tpCam.Height = 2.5f;
                tpCam.MouseSensitivity = 5f;
                tpCam.MinPitch = -15f;
                tpCam.MaxPitch = 50f;
                tpCam.MouseSmoothTime = 0.05f;
                tpCam.PositionSmoothTime = 0.06f;
                tpCam.RotationSmoothSpeed = 15f;
                tpCam.ZoomSpeed = 2f;
                tpCam.MinDistance = 3f;
                tpCam.MaxDistance = 9f;
                tpCam.SnapToTarget();
            }

            // 11. Render High-Resolution Camera Capture from Isometric Perspective
            Vector3 origCamPos = camObj.transform.position;
            Quaternion origCamRot = camObj.transform.rotation;
            float origFov = cam.fieldOfView;

            camObj.transform.position = new Vector3(-8.6f, 8.2f, -8.6f);
            camObj.transform.rotation = Quaternion.Euler(38f, 45f, 0f);
            cam.fieldOfView = 38f;
            string renderPath = Path.Combine(Application.dataPath, "Resources", "Puzzles", "dedicated_puzzle_scene_render.png");
            RenderCameraToFile(cam, renderPath);

            // Restore Main Scene Third-Person Camera setup for gameplay
            cam.fieldOfView = origFov;
            if (tpCam != null)
            {
                tpCam.SnapToTarget();
            }
            else
            {
                camObj.transform.position = origCamPos;
                camObj.transform.rotation = origCamRot;
            }

            // Ensure directory exists and save scene
            string sceneDir = Path.GetDirectoryName(DedicatedScenePath);
            if (!Directory.Exists(sceneDir)) Directory.CreateDirectory(sceneDir);
            EditorSceneManager.SaveScene(dedicatedScene, DedicatedScenePath);
            Debug.Log($"[StaticPuzzleSceneBuilder] Dedicated scene saved with Main Scene camera setup to: {DedicatedScenePath}");

            // Frame scene view
            if (SceneView.lastActiveSceneView != null)
            {
                SceneView.lastActiveSceneView.Frame(new Bounds(Vector3.up * 1.5f, new Vector3(9f, 5f, 9f)), false);
            }

            Selection.activeGameObject = envSystem;
        }

        [MenuItem("ASCENDRA/Place Static Village Puzzle in Village Scene")]
        public static void PlaceStaticPuzzleInVillageScene()
        {
            if (!File.Exists(VillageScenePath))
            {
                Debug.LogError($"[StaticPuzzleSceneBuilder] Village scene not found at: {VillageScenePath}");
                return;
            }

            // Open Stage_1_1_Village scene
            Scene villageScene = EditorSceneManager.OpenScene(VillageScenePath, OpenSceneMode.Single);

            PuzzleData puzzleData = LoadStaticPuzzleData();
            if (puzzleData == null) return;

            Debug.Log($"[StaticPuzzleSceneBuilder] Placing Static Village Puzzle in '{VillageScenePath}' at {VillageDefaultOrigin}...");

            // Resolve or create PuzzleEnvironmentSystem
            GameObject sysObj = GameObject.Find("PuzzleEnvironmentSystem");
            if (sysObj == null)
            {
                sysObj = new GameObject("PuzzleEnvironmentSystem");
                Undo.RegisterCreatedObjectUndo(sysObj, "Create PuzzleEnvironmentSystem");
            }
            sysObj.SetActive(true);

            Transform rootTransform = FindOrCreateRoot(sysObj);
            ClearChildren(rootTransform);

            // Create Spatial Plan at open clearing
            PuzzleEnvironmentPlan plan = PuzzleEnvironmentPlanner.CreatePlan(puzzleData, VillageDefaultOrigin);
            PuzzleAssetLibrary.InitializeLibrary();

            // Spawn 3D Puzzle Environment (Stepped stone dais, rune stones, 4 flanking braziers, clue slab)
            List<GameObject> spawned = PuzzleElementSpawner.SpawnPuzzleEnvironment(plan, rootTransform);

            // Add Courtyard Ruins Perimeter around the sanctuary
            SpawnCourtyardRuinsPerimeter(rootTransform, VillageDefaultOrigin, plan.boundsSize);

            // Wire encounter components
            WireSystemComponents(sysObj, puzzleData);

            // Mark Scene Dirty and Save
            EditorSceneManager.MarkSceneDirty(villageScene);
            EditorSceneManager.SaveScene(villageScene);

            // Frame Scene View camera on the newly created puzzle
            if (SceneView.lastActiveSceneView != null)
            {
                SceneView.lastActiveSceneView.Frame(new Bounds(VillageDefaultOrigin + Vector3.up * 1.5f, new Vector3(10f, 5f, 10f)), false);
            }

            // Capture rendered view from dedicated or main camera
            Camera renderCam = Camera.main;
            bool createdTempCam = false;
            if (renderCam == null)
            {
                GameObject tempCamObj = new GameObject("TempCaptureCamera");
                renderCam = tempCamObj.AddComponent<Camera>();
                createdTempCam = true;
            }

            Vector3 origCamPos = renderCam.transform.position;
            Quaternion origCamRot = renderCam.transform.rotation;
            float origFov = renderCam.fieldOfView;

            renderCam.transform.position = VillageDefaultOrigin + new Vector3(-8.6f, 8.2f, -8.6f);
            renderCam.transform.rotation = Quaternion.Euler(38f, 45f, 0f);
            renderCam.fieldOfView = 38f;

            string renderPath = Path.Combine(Application.dataPath, "Resources", "Puzzles", "village_puzzle_scene_render.png");
            RenderCameraToFile(renderCam, renderPath);

            if (createdTempCam)
            {
                UnityEngine.Object.DestroyImmediate(renderCam.gameObject);
            }
            else
            {
                renderCam.transform.position = origCamPos;
                renderCam.transform.rotation = origCamRot;
                renderCam.fieldOfView = origFov;
            }

            Selection.activeGameObject = rootTransform.gameObject;
            Debug.Log($"[ASCENDRA] Static Village Puzzle ('{puzzleData.title}') successfully placed in Stage_1_1_Village at {VillageDefaultOrigin}!");
        }

        private static void SpawnCourtyardRuinsPerimeter(Transform parent, Vector3 center, Vector3 boundsSize)
        {
            GameObject ruinsDecor = new GameObject("CourtyardRuinsDecor");
            ruinsDecor.transform.SetParent(parent, false);

            float halfX = boundsSize.x * 0.5f;
            float halfZ = boundsSize.z * 0.5f;

            // 1. Wood Fences framing back, left flank, and right flank
            GameObject fencePrefab = LoadPrefab("rpgpp_lt_fence_wood_01a") ?? LoadPrefab("Fence_01");
            if (fencePrefab != null)
            {
                // Back boundary fence line (Z = +4.8)
                for (int i = -2; i <= 2; i++)
                {
                    GameObject f = UnityEngine.Object.Instantiate(fencePrefab, ruinsDecor.transform, false);
                    f.name = $"BackFence_{i}";
                    f.transform.position = center + new Vector3(i * 2.2f, 0f, 4.8f);
                    f.transform.rotation = Quaternion.identity;
                }

                // Left flank fence line (X = -4.8, only behind the dais Z >= 2.2m)
                for (int i = 1; i <= 2; i++)
                {
                    GameObject f = UnityEngine.Object.Instantiate(fencePrefab, ruinsDecor.transform, false);
                    f.name = $"LeftFence_{i}";
                    f.transform.position = center + new Vector3(-4.8f, 0f, i * 2.2f);
                    f.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
                }

                // Right flank fence line (X = +4.8)
                for (int i = 0; i <= 2; i++)
                {
                    GameObject f = UnityEngine.Object.Instantiate(fencePrefab, ruinsDecor.transform, false);
                    f.name = $"RightFence_{i}";
                    f.transform.position = center + new Vector3(4.8f, 0f, i * 2.2f);
                    f.transform.rotation = Quaternion.Euler(0f, 90f, 0f);
                }
            }

            // 2. Barrels & Crates in corner clusters matching reference image
            GameObject cratePrefab = LoadPrefab("Box_01") ?? LoadPrefab("rpgpp_lt_crate_01") ?? LoadPrefab("Crate");
            GameObject barrelPrefab = LoadPrefab("Barrel_01") ?? LoadPrefab("rpgpp_lt_barrel_01") ?? LoadPrefab("Barrel");

            // Front-left crate cluster (prominent stack in foreground left, framing corner)
            if (cratePrefab != null)
            {
                GameObject c1 = UnityEngine.Object.Instantiate(cratePrefab, ruinsDecor.transform, false);
                c1.transform.position = center + new Vector3(-5.2f, 0f, -2.8f);
                c1.transform.rotation = Quaternion.Euler(0f, 15f, 0f);

                GameObject c2 = UnityEngine.Object.Instantiate(cratePrefab, ruinsDecor.transform, false);
                c2.transform.position = center + new Vector3(-5.2f, 0.65f, -2.8f);
                c2.transform.rotation = Quaternion.Euler(0f, 38f, 0f);

                GameObject c3 = UnityEngine.Object.Instantiate(cratePrefab, ruinsDecor.transform, false);
                c3.transform.position = center + new Vector3(-5.8f, 0f, -3.1f);
                c3.transform.rotation = Quaternion.Euler(0f, 52f, 0f);

                GameObject c4 = UnityEngine.Object.Instantiate(cratePrefab, ruinsDecor.transform, false);
                c4.transform.position = center + new Vector3(-4.8f, 0f, -3.4f);
                c4.transform.rotation = Quaternion.Euler(0f, -12f, 0f);
            }

            // Back-left cluster (crates)
            if (cratePrefab != null)
            {
                GameObject c5 = UnityEngine.Object.Instantiate(cratePrefab, ruinsDecor.transform, false);
                c5.transform.position = center + new Vector3(-4.6f, 0f, 4.2f);
                c5.transform.rotation = Quaternion.Euler(0f, 20f, 0f);
            }

            // Back center-right barrels
            if (barrelPrefab != null)
            {
                GameObject b1 = UnityEngine.Object.Instantiate(barrelPrefab, ruinsDecor.transform, false);
                b1.transform.position = center + new Vector3(-1.2f, 0f, 4.4f);
                b1.transform.rotation = Quaternion.Euler(0f, 15f, 0f);

                GameObject b2 = UnityEngine.Object.Instantiate(barrelPrefab, ruinsDecor.transform, false);
                b2.transform.position = center + new Vector3(-1.8f, 0f, 4.5f);
                b2.transform.rotation = Quaternion.Euler(0f, -25f, 0f);

                // Right flank barrels
                GameObject b3 = UnityEngine.Object.Instantiate(barrelPrefab, ruinsDecor.transform, false);
                b3.transform.position = center + new Vector3(4.4f, 0f, -1.8f);
                b3.transform.rotation = Quaternion.Euler(0f, 40f, 0f);

                GameObject b4 = UnityEngine.Object.Instantiate(barrelPrefab, ruinsDecor.transform, false);
                b4.transform.position = center + new Vector3(4.5f, 0f, -2.4f);
                b4.transform.rotation = Quaternion.Euler(0f, -10f, 0f);
            }

            // 3. Lush Background & Distant Side Pine Trees framing the scene (outside camera foreground)
            GameObject treePrefab = LoadPrefab("rpgpp_lt_tree_pine_01") ?? LoadPrefab("rpgpp_lt_tree_01");
            if (treePrefab != null)
            {
                Vector3[] treePositions = new Vector3[]
                {
                    // Back forest boundary line
                    new Vector3(-5.2f, 0f, 6.2f),
                    new Vector3(-2.6f, 0f, 6.5f),
                    new Vector3(0.0f, 0f, 6.6f),
                    new Vector3(2.6f, 0f, 6.5f),
                    new Vector3(5.2f, 0f, 6.2f),
                    // Distant left flank
                    new Vector3(-6.8f, 0f, 4.5f),
                    new Vector3(-7.2f, 0f, 2.2f),
                    // Distant right flank
                    new Vector3(6.8f, 0f, 4.5f),
                    new Vector3(7.2f, 0f, 2.2f),
                    new Vector3(6.8f, 0f, -0.2f)
                };

                for (int t = 0; t < treePositions.Length; t++)
                {
                    GameObject tree = UnityEngine.Object.Instantiate(treePrefab, ruinsDecor.transform, false);
                    tree.transform.position = center + treePositions[t];
                    float scaleVar = 1.1f + ((t % 3) * 0.15f);
                    tree.transform.localScale = Vector3.one * scaleVar;
                    tree.transform.rotation = Quaternion.Euler(0f, t * 53f, 0f);
                }
            }

            // 4. Scattered low-poly pebbles and rocks matching reference concept image
            GameObject rockPrefab = LoadPrefab("rpgpp_lt_rock_small_01") ?? LoadPrefab("rpgpp_lt_rocks_tiny_01") ?? LoadPrefab("Stone_01");
            if (rockPrefab != null)
            {
                Vector3[] rockPositions = new Vector3[]
                {
                    new Vector3(-4.2f, 0f, -2.2f),
                    new Vector3(-3.2f, 0f, -3.8f),
                    new Vector3(-2.6f, 0f, -4.2f),
                    new Vector3(3.6f, 0f, -3.4f),
                    new Vector3(4.2f, 0f, -0.8f),
                    new Vector3(3.8f, 0f, 3.6f),
                    new Vector3(-3.6f, 0f, 3.8f)
                };
                for (int r = 0; r < rockPositions.Length; r++)
                {
                    GameObject rk = UnityEngine.Object.Instantiate(rockPrefab, ruinsDecor.transform, false);
                    rk.transform.position = center + rockPositions[r];
                    rk.transform.localScale = Vector3.one * (0.4f + (r % 3) * 0.2f);
                    rk.transform.rotation = Quaternion.Euler(0f, r * 47f, 0f);
                }
            }
        }

        private static void SpawnOverheadBanner(Transform parent, Vector3 center, Vector3 boundsSize, string title, string description)
        {
            GameObject bannerObj = new GameObject("CourtyardTitleBanner");
            bannerObj.transform.SetParent(parent, false);
            bannerObj.transform.position = center + new Vector3(0f, 4.1f, boundsSize.z * 0.52f);
            bannerObj.transform.rotation = Quaternion.Euler(20f, 0f, 0f);

            TextMeshPro tmp = bannerObj.AddComponent<TextMeshPro>();
            tmp.text = $"<color=#FFD54F><b>{title.ToUpper()}</b></color>\n<size=70%><color=#E0F7FA>Select the missing rune (??) completing the +6 harmonic progression.</color></size>";
            tmp.fontSize = 3.6f;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.outlineColor = new Color32(5, 10, 20, 255);
            tmp.outlineWidth = 0.25f;

            RectTransform rt = bannerObj.GetComponent<RectTransform>();
            if (rt != null)
            {
                rt.sizeDelta = new Vector2(10f, 3f);
            }
        }

        private static void WireSystemComponents(GameObject sysObj, PuzzleData puzzleData)
        {
            if (sysObj.GetComponent<PuzzleObjectiveValidator>() == null)
            {
                Undo.AddComponent<PuzzleObjectiveValidator>(sysObj);
            }
            if (sysObj.GetComponent<PuzzleInteractionBinder>() == null)
            {
                Undo.AddComponent<PuzzleInteractionBinder>(sysObj);
            }
            if (sysObj.GetComponent<PuzzleAudioSynthesizer>() == null)
            {
                Undo.AddComponent<PuzzleAudioSynthesizer>(sysObj);
            }
            if (sysObj.GetComponent<PuzzleScreenFader>() == null)
            {
                Undo.AddComponent<PuzzleScreenFader>(sysObj);
            }

            StaticPuzzleSceneBootstrap bootstrap = sysObj.GetComponent<StaticPuzzleSceneBootstrap>();
            if (bootstrap == null)
            {
                bootstrap = Undo.AddComponent<StaticPuzzleSceneBootstrap>(sysObj);
            }
            bootstrap.fallbackAnswer = puzzleData.answer;

            // Initialize validator directly
            PuzzleObjectiveValidator validator = sysObj.GetComponent<PuzzleObjectiveValidator>();
            if (validator != null)
            {
                validator.SetCurrentPuzzle(puzzleData);
            }
        }

        public static void RenderCameraToFile(Camera cam, string outputPath)
        {
            if (cam == null)
            {
                Debug.LogWarning("[StaticPuzzleSceneBuilder] RenderCameraToFile failed: Camera is null.");
                return;
            }

            int width = 1920;
            int height = 1080;
            RenderTexture rt = new RenderTexture(width, height, 24);
            RenderTexture prevRt = cam.targetTexture;
            RenderTexture prevActive = RenderTexture.active;

            // Pre-warm and simulate particle systems (flame particles, smoke, embers) so they are fully captured in the render snapshot
            ParticleSystem[] allParticles = UnityEngine.Object.FindObjectsByType<ParticleSystem>(FindObjectsSortMode.None);
            if (allParticles != null)
            {
                for (int i = 0; i < allParticles.Length; i++)
                {
                    if (allParticles[i] != null)
                    {
                        allParticles[i].Simulate(2.0f, true, true);
                    }
                }
            }

            cam.targetTexture = rt;
            cam.Render();

            RenderTexture.active = rt;
            Texture2D tex = new Texture2D(width, height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            tex.Apply();

            cam.targetTexture = prevRt;
            RenderTexture.active = prevActive;
            UnityEngine.Object.DestroyImmediate(rt);

            byte[] bytes = tex.EncodeToPNG();
            UnityEngine.Object.DestroyImmediate(tex);

            string dir = Path.GetDirectoryName(outputPath);
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            File.WriteAllBytes(outputPath, bytes);
            Debug.Log($"[StaticPuzzleSceneBuilder] Captured high-resolution puzzle render to: {outputPath}");

            // Copy to active conversation artifact directory for display
            try
            {
                if (Directory.Exists(ArtifactDir))
                {
                    string artifactDest = Path.Combine(ArtifactDir, Path.GetFileName(outputPath));
                    File.Copy(outputPath, artifactDest, true);
                    Debug.Log($"[StaticPuzzleSceneBuilder] Render copied to artifact directory: {artifactDest}");
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[StaticPuzzleSceneBuilder] Failed copying to artifact dir: {ex.Message}");
            }
        }

        private static GameObject LoadPrefab(string nameOrSemantic)
        {
            if (string.IsNullOrEmpty(nameOrSemantic)) return null;

            // 1. Direct search in AssetDatabase by exact file name
            string[] guids = AssetDatabase.FindAssets($"{nameOrSemantic} t:Prefab");
            if (guids != null && guids.Length > 0)
            {
                for (int i = 0; i < guids.Length; i++)
                {
                    string path = AssetDatabase.GUIDToAssetPath(guids[i]);
                    if (Path.GetFileNameWithoutExtension(path).Equals(nameOrSemantic, StringComparison.OrdinalIgnoreCase))
                    {
                        GameObject asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                        if (asset != null) return asset;
                    }
                }

                // Fallback to first GUID match
                string fallbackPath = AssetDatabase.GUIDToAssetPath(guids[0]);
                GameObject fbAsset = AssetDatabase.LoadAssetAtPath<GameObject>(fallbackPath);
                if (fbAsset != null) return fbAsset;
            }

            // 2. Direct match from Resources/PuzzlePrefabs (only exact name match)
            GameObject fromRes = Resources.Load<GameObject>($"PuzzlePrefabs/{nameOrSemantic}");
            if (fromRes != null) return fromRes;

            return null;
        }

        private static PuzzleData LoadStaticPuzzleData()
        {
            string jsonPath = Path.Combine(Application.dataPath, "Resources", "Puzzles", "static_village_puzzle.json");
            if (!File.Exists(jsonPath))
            {
                Debug.LogError($"[StaticPuzzleSceneBuilder] JSON not found at: {jsonPath}");
                return null;
            }

            string jsonContent = File.ReadAllText(jsonPath);
            return PuzzleData.ParseJson(jsonContent);
        }

        private static Transform FindRoot(GameObject sysObj = null)
        {
            if (sysObj != null)
            {
                Transform child = sysObj.transform.Find("PuzzleEnvironmentRoot");
                if (child != null) return child;
            }
            GameObject rootObj = GameObject.Find("PuzzleEnvironmentRoot");
            if (rootObj == null) rootObj = GameObject.Find("GeneratedPuzzleEnvironment");
            return rootObj != null ? rootObj.transform : null;
        }

        private static Transform FindOrCreateRoot(GameObject sysObj = null)
        {
            Transform existing = FindRoot(sysObj);
            if (existing != null) return existing;

            if (sysObj == null) sysObj = GameObject.Find("PuzzleEnvironmentSystem");
            GameObject newRoot = new GameObject("PuzzleEnvironmentRoot");
            if (sysObj != null)
            {
                newRoot.transform.SetParent(sysObj.transform, false);
            }
            newRoot.transform.position = Vector3.zero;
            return newRoot.transform;
        }

        private static void ClearChildren(Transform parent)
        {
            for (int i = parent.childCount - 1; i >= 0; i--)
            {
                Transform child = parent.GetChild(i);
                if (child != null)
                {
                    Undo.DestroyObjectImmediate(child.gameObject);
                }
            }
        }
    }
}
