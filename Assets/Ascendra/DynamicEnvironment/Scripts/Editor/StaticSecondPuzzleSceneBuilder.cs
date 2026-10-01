using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;
using Ascendra.DynamicEnvironment;

namespace Ascendra.DynamicEnvironment.Editor
{
    [InitializeOnLoad]
    public class StaticSecondPuzzleSceneBuilder
    {
        public static readonly string DedicatedSecondScenePath = "Assets/Scenes/Gameplay/StaticSecondPuzzleScene.unity";
        public static readonly string VillageScenePath = "Assets/Scenes/Gameplay/Stage_1_1_Village.unity";
        public static readonly string ArtifactDir = @"C:\Users\DELL\.gemini\antigravity-ide\brain\2a77d1cc-3461-4a03-a22b-bb76fc15a40e";
        public static readonly Vector3 SecondClueVillagePosition = new Vector3(56.0f, 22.0f, 44.0f);

        static StaticSecondPuzzleSceneBuilder()
        {
            EditorApplication.update += CheckAutoTrigger;
        }

        [InitializeOnLoadMethod]
        private static void OnProjectLoaded()
        {
            EditorApplication.delayCall += CheckPendingTrigger;
        }

        private static void CheckPendingTrigger()
        {
            CheckAutoTrigger();
        }

        private static void CheckAutoTrigger()
        {
            string triggerPath = Path.Combine(Application.dataPath, "..", "Temp", "trigger_second_puzzle_build.txt");
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

                Debug.Log("[StaticSecondPuzzleSceneBuilder] Auto-trigger detected! Building Task 4 Symbol Alignment Scene...");
                BuildSecondPuzzleSceneAndRender();
            }
        }

        private static void WaitForCompilationAndBuild()
        {
            if (EditorApplication.isCompiling) return;
            EditorApplication.update -= WaitForCompilationAndBuild;
            Debug.Log("[StaticSecondPuzzleSceneBuilder] Compilation verified! Running BuildSecondPuzzleSceneAndRender...");
            BuildSecondPuzzleSceneAndRender();
        }

        [MenuItem("ASCENDRA/Build Second Puzzle Scene and Capture")]
        public static void BuildSecondPuzzleSceneAndRender()
        {
            Debug.Log("[StaticSecondPuzzleSceneBuilder] Starting construction of Task 4 Symbol Alignment Scene...");

            // 1. Generate Dedicated Second Puzzle Scene
            GenerateDedicatedSecondPuzzleScene();

            // 2. Place SecondClue in Stage_1_1_Village
            PlaceSecondClueInVillageScene();

            // 3. Register Scene in EditorBuildSettings
            RegisterSceneInBuildSettings(DedicatedSecondScenePath);

            Debug.Log("[StaticSecondPuzzleSceneBuilder] Successfully constructed, rendered, and registered Second Static Puzzle Scene!");
        }

        public static void GenerateDedicatedSecondPuzzleScene()
        {
            PuzzleAssetLibrary.InitializeLibrary();

            // Create fresh empty scene
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 1. Lighting - Warm Natural Sunlight with Deep Overgrown Foliage Ambient
            GameObject sunObj = new GameObject("Overgrown Ruin Directional Light");
            Light sun = sunObj.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1.0f, 0.93f, 0.82f); // Warm sunbeam through forest canopy
            sun.intensity = 1.35f;
            sun.shadows = LightShadows.Soft;
            sunObj.transform.rotation = Quaternion.Euler(42f, -25f, 0f);

            // Ambient Lighting: Ancient Mossy Stone Ruin Palette
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.26f, 0.34f, 0.28f); // Rich moss-green and ancient stone ambient

            // Skybox
            Material skyMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/RPGPP_LT/Materials/rpgpp_lt_sky_a.mat");
            if (skyMat != null) RenderSettings.skybox = skyMat;

            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogDensity = 0.008f;
            RenderSettings.fogColor = new Color(0.18f, 0.24f, 0.20f);

            // 2. Root Container
            GameObject rootObj = new GameObject("SymbolAlignmentPuzzleSystem");
            rootObj.transform.position = Vector3.zero;

            // 3. Materials
            Material mossyStoneMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_AncientMossyStone.mat",
                new Color(0.32f, 0.35f, 0.30f), 0.15f, 0.05f);
            Material darkStoneMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_CarvedReliefStone.mat",
                new Color(0.20f, 0.22f, 0.21f), 0.20f, 0.10f);
            Material cyanRuneMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_RuneGlowCyan.mat",
                new Color(0f, 0.85f, 1.0f), 0.9f, 0.0f, new Color(0f, 0.9f, 1.0f) * 2.5f);
            Material amberRuneMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_RuneGlowGold.mat",
                new Color(1f, 0.80f, 0.30f), 0.8f, 0.0f, new Color(1f, 0.75f, 0.25f) * 2.0f);
            Material tabletPlaqueMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/Ascendra/DynamicEnvironment/Materials/M_AncientStoneTablet.mat")
                ?? darkStoneMat;

            TMP_FontAsset fontAsset = AssetDatabase.LoadAssetAtPath<TMP_FontAsset>("Assets/TextMesh Pro/Resources/Fonts & Materials/LiberationSans SDF.asset");

            // 4. Overgrown Ancient Temple Ruin Wall (Background Architecture)
            BuildOvergrownTempleWall(rootObj.transform, mossyStoneMat, darkStoneMat);

            // 5. Flanking Torch Fire Braziers on Carved Stone Pedestals
            BuildFlankingBraziers(rootObj.transform, mossyStoneMat);

            // 6. Central Concentric Symbol Dial Mechanism (Task 4)
            Vector3 dialCenter = new Vector3(0f, 1.7f, 1.8f);
            var dialComponents = BuildConcentricSymbolDial(rootObj.transform, dialCenter, darkStoneMat, mossyStoneMat, cyanRuneMat, amberRuneMat, fontAsset);

            // 7. Carved Stone Pattern Tablet above the Dial (properly elevated so no overlap occurs)
            BuildCarvedPatternTablet(rootObj.transform, new Vector3(0f, 4.5f, 1.75f), tabletPlaqueMat, fontAsset, amberRuneMat);

            // 8. In-Scene Side Plaques (positioned cleanly to the sides)
            BuildSidePlaques(rootObj.transform, fontAsset, tabletPlaqueMat);

            // 9. Camera Setup (Direct Frontal Framed View on the Mechanism)
            GameObject camObj = new GameObject("Main Camera");
            Camera cam = camObj.AddComponent<Camera>();
            camObj.tag = "MainCamera";
            cam.nearClipPlane = 0.2f;
            cam.farClipPlane = 100f;
            cam.clearFlags = CameraClearFlags.Skybox;
            camObj.AddComponent<AudioListener>();

            // Universal Additional Camera Data (URP)
            var uacData = camObj.GetComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>()
                       ?? camObj.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();
            uacData.renderShadows = true;

            // Direct Frontal Perspective
            camObj.transform.position = new Vector3(0f, 2.75f, -6.4f);
            camObj.transform.rotation = Quaternion.Euler(2.0f, 0f, 0f);
            cam.fieldOfView = 48f;

            // 10. Wire SecondPuzzleController
            SecondPuzzleController controller = rootObj.AddComponent<SecondPuzzleController>();
            controller.outerRingTransform = dialComponents.outerRing;
            controller.innerRingTransform = dialComponents.innerRing;
            controller.centralCrystalTransform = dialComponents.crystalTransform;
            controller.centralCrystalLight = dialComponents.crystalLight;
            controller.puzzleCamera = cam;
            controller.frontalCameraPosition = camObj.transform.position;
            controller.frontalCameraEuler = camObj.transform.rotation.eulerAngles;
            controller.frontalCameraFov = 44f;

            // 11. Screen Overlay HUD (matching Task 4 reference layout)
            BuildHUDOverlay(rootObj.transform, controller, fontAsset);

            // 13. Render High-Resolution Camera Capture
            string renderPath = Path.Combine(Application.dataPath, "Resources", "Puzzles", "second_puzzle_scene_render.png");
            RenderCameraToFile(cam, renderPath);

            // Ensure directory exists and save scene
            string sceneDir = Path.GetDirectoryName(DedicatedSecondScenePath);
            if (!Directory.Exists(sceneDir)) Directory.CreateDirectory(sceneDir);
            EditorSceneManager.SaveScene(scene, DedicatedSecondScenePath);
            Debug.Log($"[StaticSecondPuzzleSceneBuilder] Dedicated Task 4 scene saved to: {DedicatedSecondScenePath}");

            // Frame scene view
            if (SceneView.lastActiveSceneView != null)
            {
                SceneView.lastActiveSceneView.Frame(new Bounds(new Vector3(0f, 2.8f, 1.5f), new Vector3(7f, 5f, 4f)), false);
            }

            Selection.activeGameObject = rootObj;
        }

        private static void BuildOvergrownTempleWall(Transform parent, Material mossMat, Material darkStoneMat)
        {
            GameObject wallRoot = new GameObject("OvergrownTempleWall");
            wallRoot.transform.SetParent(parent, false);

            // 1. Mossy Stone Foundation Platform (Ground Floor)
            GameObject groundDais = GameObject.CreatePrimitive(PrimitiveType.Cube);
            groundDais.name = "MossyTerracePlatform";
            groundDais.transform.SetParent(wallRoot.transform, false);
            groundDais.transform.position = new Vector3(0f, -0.4f, 0.5f);
            groundDais.transform.localScale = new Vector3(10f, 0.8f, 6f);
            groundDais.GetComponent<Renderer>().sharedMaterial = mossMat;

            // Front Stepped Stone Kerb
            GameObject step1 = GameObject.CreatePrimitive(PrimitiveType.Cube);
            step1.name = "TerraceStep";
            step1.transform.SetParent(wallRoot.transform, false);
            step1.transform.position = new Vector3(0f, -0.15f, -1.8f);
            step1.transform.localScale = new Vector3(9.2f, 0.3f, 1.2f);
            step1.GetComponent<Renderer>().sharedMaterial = mossMat;

            // 2. Giant Massive Ancient Stone Masonry Wall (Z = 2.4)
            // Main Central Arch Wall
            GameObject centerWall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            centerWall.name = "CentralTempleWall";
            centerWall.transform.SetParent(wallRoot.transform, false);
            centerWall.transform.position = new Vector3(0f, 3.2f, 2.4f);
            centerWall.transform.localScale = new Vector3(7.4f, 6.4f, 0.8f);
            centerWall.GetComponent<Renderer>().sharedMaterial = darkStoneMat;

            // Flanking Buttress Blocks (Left & Right)
            float[] buttressXs = new float[] { -4.5f, 4.5f };
            for (int i = 0; i < buttressXs.Length; i++)
            {
                GameObject buttress = GameObject.CreatePrimitive(PrimitiveType.Cube);
                buttress.name = $"WallButtress_{i}";
                buttress.transform.SetParent(wallRoot.transform, false);
                buttress.transform.position = new Vector3(buttressXs[i], 3.2f, 2.2f);
                buttress.transform.localScale = new Vector3(2.4f, 6.4f, 1.2f);
                buttress.GetComponent<Renderer>().sharedMaterial = mossMat;
            }

            // Top Overhanging Stone Cornice / Lintel
            GameObject cornice = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cornice.name = "StoneCorniceLintel";
            cornice.transform.SetParent(wallRoot.transform, false);
            cornice.transform.position = new Vector3(0f, 6.2f, 2.1f);
            cornice.transform.localScale = new Vector3(10.5f, 0.65f, 1.2f);
            cornice.GetComponent<Renderer>().sharedMaterial = mossMat;

            // Ivy Vines draping down from the cornice (represented with textured green relief blocks)
            Material vineMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_IvyVines.mat",
                new Color(0.18f, 0.32f, 0.14f), 0.1f, 0.0f);
            float[] vineXs = new float[] { -3.2f, -2.1f, -0.8f, 1.1f, 2.4f, 3.5f };
            float[] vineLengths = new float[] { 2.2f, 1.5f, 1.8f, 1.4f, 2.0f, 1.6f };
            for (int v = 0; v < vineXs.Length; v++)
            {
                GameObject vine = GameObject.CreatePrimitive(PrimitiveType.Cube);
                vine.name = $"IvyVine_{v}";
                vine.transform.SetParent(wallRoot.transform, false);
                vine.transform.position = new Vector3(vineXs[v], 5.8f - vineLengths[v] * 0.5f, 1.95f);
                vine.transform.localScale = new Vector3(0.28f, vineLengths[v], 0.06f);
                vine.GetComponent<Renderer>().sharedMaterial = vineMat;
            }
        }

        private static void BuildFlankingBraziers(Transform parent, Material stoneMat)
        {
            GameObject brazierRoot = new GameObject("FlankingBraziers");
            brazierRoot.transform.SetParent(parent, false);

            GameObject colPrefab = LoadPrefab("Column_Stone");
            GameObject firePrefab = LoadPrefab("TorchFire") ?? LoadPrefab("Fire_01");

            float[] xs = new float[] { -4.3f, 4.3f };
            for (int i = 0; i < xs.Length; i++)
            {
                if (colPrefab != null)
                {
                    GameObject col = UnityEngine.Object.Instantiate(colPrefab, brazierRoot.transform, false);
                    col.name = $"CarvedColumn_{i}";
                    col.transform.position = new Vector3(xs[i], 0f, 0.8f);
                    col.transform.localScale = new Vector3(1.3f, 1.4f, 1.3f);
                }
                else
                {
                    GameObject pedestal = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    pedestal.name = $"FireBrazierPedestal_{i}";
                    pedestal.transform.SetParent(brazierRoot.transform, false);
                    pedestal.transform.position = new Vector3(xs[i], 1.2f, 0.8f);
                    pedestal.transform.localScale = new Vector3(1.1f, 1.2f, 1.1f);
                    pedestal.GetComponent<Renderer>().sharedMaterial = stoneMat;
                }

                // Fire Particles & Light
                if (firePrefab != null)
                {
                    GameObject fire = UnityEngine.Object.Instantiate(firePrefab, brazierRoot.transform, false);
                    fire.name = $"FireFX_{i}";
                    fire.transform.position = new Vector3(xs[i], 2.45f, 0.8f);
                    fire.transform.localScale = Vector3.one * 1.3f;
                }

                // Warm flickering point light
                GameObject lightObj = new GameObject($"BrazierLight_{i}");
                lightObj.transform.SetParent(brazierRoot.transform, false);
                lightObj.transform.position = new Vector3(xs[i], 2.6f, 0.8f);
                Light lt = lightObj.AddComponent<Light>();
                lt.type = LightType.Point;
                lt.color = new Color(1.0f, 0.58f, 0.20f); // Warm flame orange
                lt.intensity = 3.2f;
                lt.range = 8.5f;
            }
        }

        private struct DialComponents
        {
            public Transform outerRing;
            public Transform innerRing;
            public Transform crystalTransform;
            public Light crystalLight;
        }

        private static DialComponents BuildConcentricSymbolDial(Transform parent, Vector3 center, Material darkStoneMat, Material mossMat, Material cyanRuneMat, Material amberRuneMat, TMP_FontAsset font)
        {
            GameObject dialRoot = new GameObject("ConcentricSymbolDial");
            dialRoot.transform.SetParent(parent, false);
            dialRoot.transform.position = center;

            // 1. Massive Circular Carved Stone Backing Dial Base
            GameObject dialBase = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            dialBase.name = "StoneDialBase";
            dialBase.transform.SetParent(dialRoot.transform, false);
            dialBase.transform.localPosition = new Vector3(0f, 0f, 0.12f);
            dialBase.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            dialBase.transform.localScale = new Vector3(4.5f, 0.15f, 4.5f);
            dialBase.GetComponent<Renderer>().sharedMaterial = darkStoneMat;

            // Decorative outer stepped stone ring
            GameObject outerRingFrame = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            outerRingFrame.name = "OuterRingFrame";
            outerRingFrame.transform.SetParent(dialRoot.transform, false);
            outerRingFrame.transform.localPosition = new Vector3(0f, 0f, 0.06f);
            outerRingFrame.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            outerRingFrame.transform.localScale = new Vector3(4.1f, 0.12f, 4.1f);
            outerRingFrame.GetComponent<Renderer>().sharedMaterial = mossMat;

            // 2. Outer Rotating Ring (Task 4)
            GameObject outerRingObj = new GameObject("OuterSymbolRing");
            outerRingObj.transform.SetParent(dialRoot.transform, false);
            outerRingObj.transform.localPosition = Vector3.zero;

            string[] symbolNames = new string[] { "Circle", "Triangle", "Square", "Moon", "Wave", "Diamond" };
            float outerRadius = 1.62f;

            for (int i = 0; i < 6; i++)
            {
                float angleDeg = i * 60f;
                float angleRad = angleDeg * Mathf.Deg2Rad;
                Vector3 nodePos = new Vector3(Mathf.Sin(angleRad) * outerRadius, Mathf.Cos(angleRad) * outerRadius, -0.05f);

                GameObject nodeObj = new GameObject($"OuterNode_{i}_{symbolNames[i]}");
                nodeObj.transform.SetParent(outerRingObj.transform, false);
                nodeObj.transform.localPosition = nodePos;

                // Carved stone socket bevel
                GameObject socketBack = GameObject.CreatePrimitive(PrimitiveType.Cube);
                socketBack.name = "SocketBevel";
                socketBack.transform.SetParent(nodeObj.transform, false);
                socketBack.transform.localScale = new Vector3(0.52f, 0.52f, 0.08f);
                socketBack.GetComponent<Renderer>().sharedMaterial = darkStoneMat;

                // 3D Physical Carved Glowing Rune Glyph (Pure Unity Primitives - No font dependencies)
                Build3DRuneGlyph(nodeObj.transform, symbolNames[i], cyanRuneMat, darkStoneMat, 1.0f);
            }

            // 3. Inner Rotating Ring (Task 4)
            GameObject innerRingObj = new GameObject("InnerSymbolRing");
            innerRingObj.transform.SetParent(dialRoot.transform, false);
            innerRingObj.transform.localPosition = new Vector3(0f, 0f, -0.03f);

            string[] innerSymbolNames = new string[] { "Triangle", "Square", "Moon", "Wave", "Diamond", "Circle" };
            float innerRadius = 0.98f;
            for (int i = 0; i < 6; i++)
            {
                float angleDeg = i * 60f + 30f;
                float angleRad = angleDeg * Mathf.Deg2Rad;
                Vector3 nodePos = new Vector3(Mathf.Sin(angleRad) * innerRadius, Mathf.Cos(angleRad) * innerRadius, -0.02f);

                GameObject nodeObj = new GameObject($"InnerNode_{i}_{innerSymbolNames[i]}");
                nodeObj.transform.SetParent(innerRingObj.transform, false);
                nodeObj.transform.localPosition = nodePos;

                // Inner 3D Physical Glowing Glyph
                Build3DRuneGlyph(nodeObj.transform, innerSymbolNames[i], cyanRuneMat, darkStoneMat, 0.65f);
            }

            // 4. Center Glowing Diamond Crystal
            GameObject crystalObj = LoadPrefab("StylRocksMagic_LOD0") ?? LoadPrefab("MagicRock_1") ?? LoadPrefab("Gem_Emerald");
            GameObject spawnedCrystal = null;
            if (crystalObj != null)
            {
                spawnedCrystal = UnityEngine.Object.Instantiate(crystalObj, dialRoot.transform, false);
                spawnedCrystal.name = "CentralAzureCrystal";
                spawnedCrystal.transform.localPosition = new Vector3(0f, 0f, -0.15f);
                spawnedCrystal.transform.localScale = new Vector3(0.55f, 0.55f, 0.55f);
            }
            else
            {
                spawnedCrystal = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                spawnedCrystal.name = "CentralAzureCrystal";
                spawnedCrystal.transform.SetParent(dialRoot.transform, false);
                spawnedCrystal.transform.localPosition = new Vector3(0f, 0f, -0.15f);
                spawnedCrystal.transform.localScale = new Vector3(0.4f, 0.4f, 0.4f);
                spawnedCrystal.GetComponent<Renderer>().sharedMaterial = cyanRuneMat;
            }

            // Central Cyan Radiant Light
            GameObject lightObj = new GameObject("CrystalCoreLight");
            lightObj.transform.SetParent(dialRoot.transform, false);
            lightObj.transform.localPosition = new Vector3(0f, 0f, -0.3f);
            Light cLight = lightObj.AddComponent<Light>();
            cLight.type = LightType.Point;
            cLight.color = new Color(0f, 0.95f, 1.0f);
            cLight.intensity = 2.8f;
            cLight.range = 6.5f;

            // Top Alignment Pointer Arrow (Top Notch)
            GameObject topPointer = GameObject.CreatePrimitive(PrimitiveType.Cube);
            topPointer.name = "TopAlignmentPointer";
            topPointer.transform.SetParent(dialRoot.transform, false);
            topPointer.transform.localPosition = new Vector3(0f, 2.25f, -0.08f);
            topPointer.transform.localRotation = Quaternion.Euler(0f, 0f, 45f);
            topPointer.transform.localScale = new Vector3(0.22f, 0.22f, 0.1f);
            topPointer.GetComponent<Renderer>().sharedMaterial = amberRuneMat;

            return new DialComponents
            {
                outerRing = outerRingObj.transform,
                innerRing = innerRingObj.transform,
                crystalTransform = spawnedCrystal.transform,
                crystalLight = cLight
            };
        }

        private static void Build3DRuneGlyph(Transform parent, string symbolName, Material glowMat, Material darkMat, float scale = 1.0f, Vector3? customPos = null)
        {
            GameObject runeObj = new GameObject($"Rune3D_{symbolName}");
            runeObj.transform.SetParent(parent, false);
            runeObj.transform.localPosition = customPos ?? new Vector3(0f, 0f, -0.06f);

            switch (symbolName)
            {
                case "Square":
                    GameObject sq = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    sq.name = "Glyph_Square";
                    sq.transform.SetParent(runeObj.transform, false);
                    sq.transform.localScale = new Vector3(0.24f * scale, 0.24f * scale, 0.04f);
                    sq.GetComponent<Renderer>().sharedMaterial = glowMat;
                    break;

                case "Circle":
                    GameObject cir = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    cir.name = "Glyph_Circle";
                    cir.transform.SetParent(runeObj.transform, false);
                    cir.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                    cir.transform.localScale = new Vector3(0.26f * scale, 0.02f, 0.26f * scale);
                    cir.GetComponent<Renderer>().sharedMaterial = glowMat;
                    break;

                case "Triangle":
                    float triH = 0.24f * scale;
                    float triW = 0.26f * scale;
                    GameObject b1 = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    b1.name = "Tri_Left";
                    b1.transform.SetParent(runeObj.transform, false);
                    b1.transform.localPosition = new Vector3(-triW * 0.25f, 0f, 0f);
                    b1.transform.localRotation = Quaternion.Euler(0f, 0f, 30f);
                    b1.transform.localScale = new Vector3(0.04f * scale, triH, 0.04f);
                    b1.GetComponent<Renderer>().sharedMaterial = glowMat;

                    GameObject b2 = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    b2.name = "Tri_Right";
                    b2.transform.SetParent(runeObj.transform, false);
                    b2.transform.localPosition = new Vector3(triW * 0.25f, 0f, 0f);
                    b2.transform.localRotation = Quaternion.Euler(0f, 0f, -30f);
                    b2.transform.localScale = new Vector3(0.04f * scale, triH, 0.04f);
                    b2.GetComponent<Renderer>().sharedMaterial = glowMat;

                    GameObject b3 = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    b3.name = "Tri_Base";
                    b3.transform.SetParent(runeObj.transform, false);
                    b3.transform.localPosition = new Vector3(0f, -triH * 0.42f, 0f);
                    b3.transform.localScale = new Vector3(triW * 0.9f, 0.04f * scale, 0.04f);
                    b3.GetComponent<Renderer>().sharedMaterial = glowMat;
                    break;

                case "Diamond":
                    GameObject dia = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    dia.name = "Glyph_Diamond";
                    dia.transform.SetParent(runeObj.transform, false);
                    dia.transform.localRotation = Quaternion.Euler(0f, 0f, 45f);
                    dia.transform.localScale = new Vector3(0.18f * scale, 0.18f * scale, 0.04f);
                    dia.GetComponent<Renderer>().sharedMaterial = glowMat;
                    break;

                case "Moon":
                    GameObject moonOuter = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    moonOuter.name = "Glyph_Moon";
                    moonOuter.transform.SetParent(runeObj.transform, false);
                    moonOuter.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                    moonOuter.transform.localScale = new Vector3(0.24f * scale, 0.025f, 0.24f * scale);
                    moonOuter.GetComponent<Renderer>().sharedMaterial = glowMat;

                    GameObject moonCut = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    moonCut.name = "MoonCutter";
                    moonCut.transform.SetParent(runeObj.transform, false);
                    moonCut.transform.localPosition = new Vector3(0.08f * scale, 0f, -0.005f);
                    moonCut.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                    moonCut.transform.localScale = new Vector3(0.20f * scale, 0.035f, 0.20f * scale);
                    moonCut.GetComponent<Renderer>().sharedMaterial = darkMat;
                    break;

                case "Wave":
                    GameObject w1 = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    w1.name = "Wave_Top";
                    w1.transform.SetParent(runeObj.transform, false);
                    w1.transform.localPosition = new Vector3(0f, 0.06f * scale, 0f);
                    w1.transform.localScale = new Vector3(0.26f * scale, 0.04f * scale, 0.04f);
                    w1.GetComponent<Renderer>().sharedMaterial = glowMat;

                    GameObject w2 = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    w2.name = "Wave_Bottom";
                    w2.transform.SetParent(runeObj.transform, false);
                    w2.transform.localPosition = new Vector3(0f, -0.06f * scale, 0f);
                    w2.transform.localScale = new Vector3(0.26f * scale, 0.04f * scale, 0.04f);
                    w2.GetComponent<Renderer>().sharedMaterial = glowMat;
                    break;
            }
        }

        private static void BuildCarvedPatternTablet(Transform parent, Vector3 center, Material tabletMat, TMP_FontAsset font, Material amberMat)
        {
            GameObject tabletRoot = new GameObject("CarvedStonePatternTablet");
            tabletRoot.transform.SetParent(parent, false);
            tabletRoot.transform.position = center;

            // Carved Stone Relief Block
            GameObject slab = GameObject.CreatePrimitive(PrimitiveType.Cube);
            slab.name = "TabletReliefBlock";
            slab.transform.SetParent(tabletRoot.transform, false);
            slab.transform.localScale = new Vector3(4.8f, 1.4f, 0.15f);
            slab.GetComponent<Renderer>().sharedMaterial = tabletMat;

            // Carved Pattern Matrix (Task 4 Reference from user prompt):
            // [ ○ -> △ | □ -> ☾ ]
            // [ ○ -> △ | ? -> ☾ ]
            // Using standard ASCII characters to guarantee zero font missing glyph warnings
            GameObject textObj = new GameObject("PatternMatrixInscription");
            textObj.transform.SetParent(tabletRoot.transform, false);
            textObj.transform.localPosition = new Vector3(0f, 0.22f, -0.1f);
            TextMeshPro tmp = textObj.AddComponent<TextMeshPro>();
            if (font != null) tmp.font = font;
            tmp.rectTransform.sizeDelta = new Vector2(4.5f, 0.75f);
            tmp.enableAutoSizing = true;
            tmp.fontSizeMin = 0.4f;
            tmp.fontSizeMax = 1.15f;
            tmp.text = "<b>[ <color=#00E5FF>Circle</color> -> <color=#00E5FF>Triangle</color>  |  <color=#00E5FF>Square</color> -> <color=#00E5FF>Moon</color> ]\n[ <color=#00E5FF>Circle</color> -> <color=#00E5FF>Triangle</color>  |     <color=#FFD54F>?</color>    -> <color=#00E5FF>Moon</color> ]</b>";
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.lineSpacing = 10f;

            // Hint Text Inscription
            GameObject hintObj = new GameObject("HintInscription");
            hintObj.transform.SetParent(tabletRoot.transform, false);
            hintObj.transform.localPosition = new Vector3(0f, -0.38f, -0.1f);
            TextMeshPro hintTmp = hintObj.AddComponent<TextMeshPro>();
            if (font != null) hintTmp.font = font;
            hintTmp.rectTransform.sizeDelta = new Vector2(4.5f, 0.45f);
            hintTmp.enableAutoSizing = true;
            hintTmp.fontSizeMin = 0.3f;
            hintTmp.fontSizeMax = 0.65f;
            hintTmp.text = "<color=#FFE0B2>Follow the pattern shown above. Find the missing symbol.</color>";
            hintTmp.alignment = TextAlignmentOptions.Center;
            hintTmp.lineSpacing = 10f;
        }

        private static void BuildSidePlaques(Transform parent, TMP_FontAsset font, Material plaqueMat)
        {
            GameObject plaquesRoot = new GameObject("SideInscribedPlaques");
            plaquesRoot.transform.SetParent(parent, false);

            // Left Plaque: "Rotate the rings to complete the correct pattern."
            GameObject leftPlaque = GameObject.CreatePrimitive(PrimitiveType.Cube);
            leftPlaque.name = "LeftInstructionPlaque";
            leftPlaque.transform.SetParent(plaquesRoot.transform, false);
            leftPlaque.transform.position = new Vector3(-3.3f, 1.9f, 1.8f);
            leftPlaque.transform.localScale = new Vector3(1.6f, 1.1f, 0.12f);
            leftPlaque.GetComponent<Renderer>().sharedMaterial = plaqueMat;

            GameObject leftText = new GameObject("Text");
            leftText.transform.SetParent(leftPlaque.transform, false);
            leftText.transform.localPosition = new Vector3(0f, 0f, -0.7f);
            TextMeshPro leftTmp = leftText.AddComponent<TextMeshPro>();
            if (font != null) leftTmp.font = font;
            leftTmp.rectTransform.sizeDelta = new Vector2(1.5f, 1.0f);
            leftTmp.enableAutoSizing = true;
            leftTmp.fontSizeMin = 0.3f;
            leftTmp.fontSizeMax = 0.6f;
            leftTmp.text = "<color=#FFE0B2>Rotate the rings\nto complete the\ncorrect pattern.</color>";
            leftTmp.alignment = TextAlignmentOptions.Center;

            // Right Plaque: "Hint: Follow the pattern shown above. Find the missing symbol."
            GameObject rightPlaque = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rightPlaque.name = "RightHintPlaque";
            rightPlaque.transform.SetParent(plaquesRoot.transform, false);
            rightPlaque.transform.position = new Vector3(3.3f, 1.9f, 1.8f);
            rightPlaque.transform.localScale = new Vector3(1.6f, 1.1f, 0.12f);
            rightPlaque.GetComponent<Renderer>().sharedMaterial = plaqueMat;

            GameObject rightText = new GameObject("Text");
            rightText.transform.SetParent(rightPlaque.transform, false);
            rightText.transform.localPosition = new Vector3(0f, 0f, -0.7f);
            TextMeshPro rightTmp = rightText.AddComponent<TextMeshPro>();
            if (font != null) rightTmp.font = font;
            rightTmp.rectTransform.sizeDelta = new Vector2(1.5f, 1.0f);
            rightTmp.enableAutoSizing = true;
            rightTmp.fontSizeMin = 0.3f;
            rightTmp.fontSizeMax = 0.6f;
            rightTmp.text = "<color=#FFE0B2><b>Hint:</b>\nFollow pattern above.\nFind missing symbol.</color>";
            rightTmp.alignment = TextAlignmentOptions.Center;
        }

        private static void BuildHUDOverlay(Transform parent, SecondPuzzleController controller, TMP_FontAsset font)
        {
            GameObject canvasObj = new GameObject("Task4_HUDCanvas");
            canvasObj.transform.SetParent(parent, false);
            Canvas canvas = canvasObj.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasObj.AddComponent<CanvasScaler>();
            canvasObj.AddComponent<GraphicRaycaster>();
            controller.puzzleCanvas = canvas;

            // Top Header: "Task 4: Symbol Alignment Puzzle (Data Science / Pattern Recognition)"
            GameObject headerBox = CreateUIBox(canvasObj.transform, "TopHeaderBox", new Vector2(0.5f, 0.94f), new Vector2(0.5f, 0.94f), Vector2.zero, new Vector2(740f, 60f), new Color(0.06f, 0.08f, 0.10f, 0.88f));
            CreateUIText(headerBox.transform, "HeaderText", "<b>Task 4: Symbol Alignment Puzzle</b>\n<size=15><color=#80DEEA>(Data Science / Pattern Recognition)</color></size>", font, 21, TextAlignmentOptions.Center, Color.white);

            // Bottom Prompt: "Use A / D to rotate rings   [E] to confirm   [Esc] to exit"
            GameObject bottomBox = CreateUIBox(canvasObj.transform, "BottomControlsBox", new Vector2(0.5f, 0.055f), new Vector2(0.5f, 0.055f), Vector2.zero, new Vector2(640f, 44f), new Color(0.05f, 0.07f, 0.09f, 0.92f));
            TextMeshProUGUI statusTmp = CreateUIText(bottomBox.transform, "StatusText", "Use <b>[A] / [D]</b> to rotate rings   |   <b>[E]</b> to confirm   |   <b>[Esc]</b> to exit", font, 18, TextAlignmentOptions.Center, new Color(0.9f, 0.95f, 1f));
            controller.statusText = statusTmp;

            // Victory Panel
            GameObject victoryObj = CreateUIBox(canvasObj.transform, "VictoryPanel", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(640f, 210f), new Color(0.04f, 0.10f, 0.14f, 0.96f));
            CreateUIText(victoryObj.transform, "VictoryText", "<color=#00E5FF>★ PATTERN RESTORED ★</color>\n\n<size=19>Missing Symbol <b>[Square]</b> Aligned to the Focus!\nAncient Sanctuary Activated.</size>\n\n<size=16><color=#FFE082>Press <b>[E / Space / Esc]</b> to return to Village</color></size>", font, 24, TextAlignmentOptions.Center, Color.white);
            controller.victoryPanel = victoryObj;
            victoryObj.SetActive(false);
        }

        private static GameObject CreateUIBox(Transform parent, string name, Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPos, Vector2 size, Color bgColor)
        {
            GameObject box = new GameObject(name);
            box.transform.SetParent(parent, false);
            RectTransform rt = box.AddComponent<RectTransform>();
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = size;

            Image img = box.AddComponent<Image>();
            img.color = bgColor;
            return box;
        }

        private static TextMeshProUGUI CreateUIText(Transform parent, string name, string text, TMP_FontAsset font, float fontSize, TextAlignmentOptions align, Color color)
        {
            GameObject textObj = new GameObject(name);
            textObj.transform.SetParent(parent, false);
            RectTransform rt = textObj.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;

            TextMeshProUGUI tmp = textObj.AddComponent<TextMeshProUGUI>();
            if (font != null) tmp.font = font;
            tmp.text = text;
            tmp.fontSize = fontSize;
            tmp.alignment = align;
            tmp.color = color;
            return tmp;
        }

        public static void PlaceSecondClueInVillageScene()
        {
            if (!File.Exists(VillageScenePath)) return;

            Scene villageScene = EditorSceneManager.OpenScene(VillageScenePath, OpenSceneMode.Single);

            GameObject existing = GameObject.Find("SecondClue");
            if (existing != null)
            {
                UnityEngine.Object.DestroyImmediate(existing);
            }

            GameObject clueObj = new GameObject("SecondClue");
            clueObj.transform.position = SecondClueVillagePosition;

            BoxCollider col = clueObj.AddComponent<BoxCollider>();
            col.isTrigger = true;
            col.size = new Vector3(4.0f, 3.0f, 4.0f);

            SecondClue clueScript = clueObj.AddComponent<SecondClue>();
            clueScript.dedicatedSceneName = "StaticSecondPuzzleScene";
            clueScript.loadDedicatedScene = true;

            GameObject markerPrefab = LoadPrefab("StylRocksMagic_1_LOD0") ?? LoadPrefab("Column_Stone");
            if (markerPrefab != null)
            {
                GameObject visual = UnityEngine.Object.Instantiate(markerPrefab, clueObj.transform, false);
                visual.name = "ClueVisualMarker";
                visual.transform.localPosition = Vector3.zero;
            }

            EditorSceneManager.MarkSceneDirty(villageScene);
            EditorSceneManager.SaveScene(villageScene);
            Debug.Log($"[StaticSecondPuzzleSceneBuilder] SecondClue placed at {SecondClueVillagePosition} in '{VillageScenePath}'");
        }

        private static void RegisterSceneInBuildSettings(string scenePath)
        {
            List<EditorBuildSettingsScene> scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            for (int i = 0; i < scenes.Count; i++)
            {
                if (scenes[i].path.Equals(scenePath, StringComparison.OrdinalIgnoreCase))
                {
                    scenes[i].enabled = true;
                    EditorBuildSettings.scenes = scenes.ToArray();
                    return;
                }
            }

            scenes.Add(new EditorBuildSettingsScene(scenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            Debug.Log($"[StaticSecondPuzzleSceneBuilder] Added '{scenePath}' to EditorBuildSettings.");
        }

        private static GameObject LoadPrefab(string name)
        {
            return PuzzleAssetLibrary.GetPrefab(name);
        }

        private static Material GetOrCreateMaterial(string assetPath, Color baseColor, float smoothness, float metallic, Color? emission = null)
        {
            Material mat = AssetDatabase.LoadAssetAtPath<Material>(assetPath);
            if (mat == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                mat = new Material(shader);
                mat.color = baseColor;
                if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", baseColor);
                if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
                if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", metallic);

                if (emission.HasValue)
                {
                    mat.EnableKeyword("_EMISSION");
                    if (mat.HasProperty("_EmissionColor")) mat.SetColor("_EmissionColor", emission.Value);
                }

                string dir = Path.GetDirectoryName(assetPath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                AssetDatabase.CreateAsset(mat, assetPath);
            }
            else
            {
                mat.color = baseColor;
                if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", baseColor);
                if (emission.HasValue)
                {
                    mat.EnableKeyword("_EMISSION");
                    if (mat.HasProperty("_EmissionColor")) mat.SetColor("_EmissionColor", emission.Value);
                }
            }
            return mat;
        }

        public static void RenderCameraToFile(Camera cam, string outputPath)
        {
            if (cam == null) return;

            int width = 1920;
            int height = 1080;
            RenderTexture rt = new RenderTexture(width, height, 24);
            RenderTexture prevRt = cam.targetTexture;
            RenderTexture prevActive = RenderTexture.active;

            ParticleSystem[] allParticles = UnityEngine.Object.FindObjectsByType<ParticleSystem>(FindObjectsSortMode.None);
            if (allParticles != null)
            {
                for (int i = 0; i < allParticles.Length; i++)
                {
                    if (allParticles[i] != null) allParticles[i].Simulate(2.0f, true, true);
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
            Debug.Log($"[StaticSecondPuzzleSceneBuilder] Captured high-resolution puzzle render to: {outputPath}");

            try
            {
                if (Directory.Exists(ArtifactDir))
                {
                    string artifactDest = Path.Combine(ArtifactDir, Path.GetFileName(outputPath));
                    File.Copy(outputPath, artifactDest, true);
                    Debug.Log($"[StaticSecondPuzzleSceneBuilder] Render copied to artifact directory: {artifactDest}");
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[StaticSecondPuzzleSceneBuilder] Could not copy to artifact directory: {ex.Message}");
            }
        }
    }
}
