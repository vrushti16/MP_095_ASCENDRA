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
    public class StaticThirdPuzzleSceneBuilder
    {
        public static readonly string DedicatedThirdScenePath = "Assets/Scenes/Gameplay/StaticThirdPuzzleScene.unity";
        public static readonly string VillageScenePath = "Assets/Scenes/Gameplay/Stage_1_1_Village.unity";
        public static readonly string ArtifactDir = @"C:\Users\DELL\.gemini\antigravity-ide\brain\42f0d865-77f1-4865-b19f-130b7a4a9856";
        public static readonly Vector3 ThirdClueVillagePosition = new Vector3(42.0f, 22.0f, 58.0f);

        static StaticThirdPuzzleSceneBuilder()
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
            string triggerPath = Path.Combine(Application.dataPath, "..", "Temp", "trigger_third_puzzle_build.txt");
            if (File.Exists(triggerPath))
            {
                if (EditorApplication.isPlaying)
                {
                    EditorApplication.isPlaying = false;
                    return;
                }

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

                Debug.Log("[StaticThirdPuzzleSceneBuilder] Auto-trigger detected! Building Task 5 Message Reconstruction Scene...");
                BuildThirdPuzzleSceneAndRender();
            }
        }

        private static void WaitForCompilationAndBuild()
        {
            if (EditorApplication.isCompiling) return;
            EditorApplication.update -= WaitForCompilationAndBuild;
            Debug.Log("[StaticThirdPuzzleSceneBuilder] Compilation verified! Running BuildThirdPuzzleSceneAndRender...");
            BuildThirdPuzzleSceneAndRender();
        }

        [MenuItem("ASCENDRA/Build Third Puzzle Scene and Capture")]
        public static void BuildThirdPuzzleSceneAndRender()
        {
            Debug.Log("[StaticThirdPuzzleSceneBuilder] Starting construction of Task 5 Message Reconstruction Scene...");

            // 1. Generate Dedicated Third Puzzle Scene
            GenerateDedicatedThirdPuzzleScene();

            // 2. Place ThirdClue in Stage_1_1_Village
            PlaceThirdClueInVillageScene();

            // 3. Register Scene in EditorBuildSettings
            RegisterSceneInBuildSettings(DedicatedThirdScenePath);

            Debug.Log("[StaticThirdPuzzleSceneBuilder] Successfully constructed, rendered, and registered Third Static Puzzle Scene!");
        }

        public static void GenerateDedicatedThirdPuzzleScene()
        {
            PuzzleAssetLibrary.InitializeLibrary();

            // Create fresh empty scene
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 1. Lighting - Twilight Sky with Warm Sunset Glow and Mystical Atmospheric Ambient
            GameObject sunObj = new GameObject("Celestial Twilight Directional Light");
            Light sun = sunObj.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1.0f, 0.88f, 0.72f); // Warm twilight sunbeams across sky islands
            sun.intensity = 1.3f;
            sun.shadows = LightShadows.Soft;
            sunObj.transform.rotation = Quaternion.Euler(26f, -38f, 0f);

            // Ambient Lighting: Twilight Violet-Blue with Cyan Mystic undertones
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.24f, 0.28f, 0.42f);

            // Skybox
            Material skyMat = AssetDatabase.LoadAssetAtPath<Material>("Assets/RPGPP_LT/Materials/rpgpp_lt_sky_a.mat");
            if (skyMat != null) RenderSettings.skybox = skyMat;

            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogDensity = 0.007f;
            RenderSettings.fogColor = new Color(0.20f, 0.22f, 0.36f);

            // 2. Root Container
            GameObject rootObj = new GameObject("MessageReconstructionPuzzleSystem");
            rootObj.transform.position = Vector3.zero;

            // 3. Materials
            Material mossyStoneMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_AncientMossyStone.mat",
                new Color(0.32f, 0.35f, 0.30f), 0.15f, 0.05f);
            Material darkStoneMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_CarvedReliefStone.mat",
                new Color(0.20f, 0.22f, 0.21f), 0.20f, 0.10f);
            Material cyanRuneMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_RuneGlowCyan.mat",
                new Color(0f, 0.85f, 1.0f), 0.9f, 0.0f, new Color(0f, 0.9f, 1.0f) * 2.5f);
            Material bronzeTrimMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_WroughtIron.mat",
                new Color(0.28f, 0.24f, 0.18f), 0.5f, 0.12f);
            Material parchmentScrollMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_AncientParchment.mat",
                new Color(0.91f, 0.84f, 0.69f), 0.05f, 0.02f);
            Material tabletStoneMat = GetOrCreateMaterial("Assets/Ascendra/DynamicEnvironment/Materials/M_SanctuarySlate.mat",
                new Color(0.12f, 0.14f, 0.17f), 0.35f, 0.15f);

            TMP_FontAsset fontAsset = AssetDatabase.LoadAssetAtPath<TMP_FontAsset>("Assets/TextMesh Pro/Resources/Fonts & Materials/LiberationSans SDF.asset");

            // 4. Floating Sky Islands Environment (Background & Foreground Arch)
            BuildFloatingSkyIslands(rootObj.transform, mossyStoneMat, darkStoneMat, cyanRuneMat);

            // 5. Central Magic Crystal (Elevated in upper center sky)
            var crystalData = BuildCentralCelestialCrystal(rootObj.transform, new Vector3(0f, 4.35f, 2.40f), cyanRuneMat);

            // 6. Slanted Altar Dais with 6 Recessed Sockets (Slots 1 to 6)
            var socketData = BuildAltarSockets(rootObj.transform, new Vector3(0f, 0.82f, -0.15f), darkStoneMat, mossyStoneMat, cyanRuneMat, fontAsset);

            // 7. Floating Word Fragments ("come", "at", "tower", "the", "sunset", "to")
            var fragmentList = BuildFloatingWordFragments(rootObj.transform, tabletStoneMat, bronzeTrimMat, cyanRuneMat, fontAsset);

            // 8. Side Plaques (Task 5: Left & Right Scrolls)
            BuildSidePlaques(rootObj.transform, fontAsset, parchmentScrollMat, bronzeTrimMat);

            // 9. Camera Setup (Frontal Framed Perspective)
            GameObject camObj = new GameObject("Main Camera");
            camObj.transform.SetParent(rootObj.transform, false);
            Camera cam = camObj.AddComponent<Camera>();
            camObj.tag = "MainCamera";
            cam.nearClipPlane = 0.2f;
            cam.farClipPlane = 120f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.18f, 0.22f, 0.36f); // Twilight sky backdrop
            camObj.AddComponent<AudioListener>();

            // URP Additional Camera Data
            var uacData = camObj.GetComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>()
                       ?? camObj.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();
            uacData.renderShadows = true;

            // Direct Frontal Framed Perspective matching Task 5 reference image
            camObj.transform.position = new Vector3(0f, 2.75f, -6.40f);
            camObj.transform.rotation = Quaternion.Euler(6.0f, 0f, 0f);
            cam.fieldOfView = 52f;

            // 10. Wire ThirdPuzzleController
            ThirdPuzzleController controller = rootObj.AddComponent<ThirdPuzzleController>();
            controller.puzzleCamera = cam;
            controller.frontalCameraPosition = camObj.transform.position;
            controller.frontalCameraEuler = camObj.transform.rotation.eulerAngles;
            controller.frontalCameraFov = 52f;

            controller.fragments = fragmentList;
            controller.socketTransforms = socketData.socketTransforms;
            controller.socketLabels = socketData.socketLabels;

            controller.centralCrystalTransform = crystalData.crystalTransform;
            controller.centralCrystalLight = crystalData.crystalLight;
            controller.crystalParticles = crystalData.particles;
            controller.crystalMaterial = cyanRuneMat;

            // 11. Screen Overlay HUD (matching Task 5 reference layout)
            BuildHUDOverlay(rootObj.transform, controller, fontAsset);

            // 12. Render High-Resolution Camera Capture
            string renderPath = Path.Combine(Application.dataPath, "Resources", "Puzzles", "third_puzzle_scene_render.png");
            RenderCameraToFile(cam, renderPath);

            // Ensure directory exists and save scene
            string sceneDir = Path.GetDirectoryName(DedicatedThirdScenePath);
            if (!Directory.Exists(sceneDir)) Directory.CreateDirectory(sceneDir);
            EditorSceneManager.SaveScene(scene, DedicatedThirdScenePath);
            Debug.Log($"[StaticThirdPuzzleSceneBuilder] Dedicated Task 5 scene saved to: {DedicatedThirdScenePath}");

            // Frame scene view
            if (SceneView.lastActiveSceneView != null)
            {
                SceneView.lastActiveSceneView.Frame(new Bounds(new Vector3(0f, 2.8f, 1.5f), new Vector3(8f, 6f, 6f)), false);
            }

            Selection.activeGameObject = rootObj;
        }

        private static void BuildFloatingSkyIslands(Transform parent, Material mossMat, Material darkStoneMat, Material cyanRuneMat)
        {
            GameObject skyEnvRoot = new GameObject("FloatingSkyIslandsEnvironment");
            skyEnvRoot.transform.SetParent(parent, false);

            // 1. Foundation Slab directly beneath the Altar
            GameObject groundPlatform = GameObject.CreatePrimitive(PrimitiveType.Cube);
            groundPlatform.name = "SanctuaryBaseSlab";
            groundPlatform.transform.SetParent(skyEnvRoot.transform, false);
            groundPlatform.transform.position = new Vector3(0f, 0.40f, -0.15f);
            groundPlatform.transform.localScale = new Vector3(9.6f, 0.40f, 3.0f);
            groundPlatform.GetComponent<Renderer>().sharedMaterial = mossMat;

            // 2. Sky Dome Mesh & Stylized Clouds
            GameObject skyDomePrefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Nature/Sky/rpgpp_lt_sky_01.prefab");
            if (skyDomePrefab != null)
            {
                GameObject skyDome = UnityEngine.Object.Instantiate(skyDomePrefab, skyEnvRoot.transform, false);
                skyDome.name = "SkyDomeMesh";
                skyDome.transform.position = new Vector3(0f, -8f, 30f);
                skyDome.transform.localScale = new Vector3(60f, 60f, 60f);
            }

            GameObject cloud1Prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Nature/rpgpp_lt_cloud_01.prefab");
            GameObject cloud2Prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/RPGPP_LT/Prefabs/Nature/rpgpp_lt_cloud_02.prefab");

            Vector3[] cloudPositions = new Vector3[]
            {
                new Vector3(-8.5f, 3.5f, 16.0f),
                new Vector3(8.5f, 3.8f, 16.0f),
                new Vector3(-4.5f, 7.2f, 22.0f),
                new Vector3(4.5f, 7.4f, 22.0f),
                new Vector3(0f, 6.2f, 18.0f)
            };
            for (int c = 0; c < cloudPositions.Length; c++)
            {
                GameObject cPrefab = (c % 2 == 0) ? cloud1Prefab : cloud2Prefab;
                if (cPrefab != null)
                {
                    GameObject cloud = UnityEngine.Object.Instantiate(cPrefab, skyEnvRoot.transform, false);
                    cloud.name = $"SkyCloud_{c}";
                    cloud.transform.position = cloudPositions[c];
                    cloud.transform.localScale = new Vector3(1.8f, 1.2f, 1.8f);
                }
            }

            // 3. Sky Dome Environment complete - center is kept open and serene
        }

        private struct CrystalBuildResult
        {
            public Transform crystalTransform;
            public Light crystalLight;
            public ParticleSystem particles;
        }

        private static CrystalBuildResult BuildCentralCelestialCrystal(Transform parent, Vector3 pos, Material cyanRuneMat)
        {
            GameObject crystalRoot = new GameObject("CentralCelestialCrystal");
            crystalRoot.transform.SetParent(parent, false);
            crystalRoot.transform.position = pos;

            // Load Gem_Emerald or Gem_Ruby for faceted crystal geometry
            GameObject crystalPrefab = LoadPrefab("Gem_Emerald") ?? LoadPrefab("Gem_Ruby") ?? LoadPrefab("StylRocksMagic_3_LOD0");
            GameObject crystalBody = null;

            if (crystalPrefab != null)
            {
                crystalBody = UnityEngine.Object.Instantiate(crystalPrefab, crystalRoot.transform, false);
                crystalBody.transform.localPosition = Vector3.zero;
                crystalBody.transform.localScale = new Vector3(1.75f, 2.80f, 1.75f);
                crystalBody.transform.localRotation = Quaternion.Euler(0f, 35f, 10f);

                // Apply vibrant cyan rune material to mesh renderers
                foreach (var r in crystalBody.GetComponentsInChildren<Renderer>())
                {
                    r.sharedMaterial = cyanRuneMat;
                }
            }
            else
            {
                crystalBody = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                crystalBody.name = "CrystalCore";
                crystalBody.transform.SetParent(crystalRoot.transform, false);
                crystalBody.transform.localPosition = Vector3.zero;
                crystalBody.transform.localScale = new Vector3(0.90f, 2.2f, 0.90f);
                crystalBody.GetComponent<Renderer>().sharedMaterial = cyanRuneMat;
            }

            // Orbiting floating shards
            for (int s = 0; s < 4; s++)
            {
                float angle = s * 90f * Mathf.Deg2Rad;
                Vector3 shardOffset = new Vector3(Mathf.Cos(angle) * 1.15f, Mathf.Sin(s * 1.5f) * 0.35f, Mathf.Sin(angle) * 1.15f);
                GameObject shard = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                shard.name = $"OrbitingShard_{s}";
                shard.transform.SetParent(crystalRoot.transform, false);
                shard.transform.localPosition = shardOffset;
                shard.transform.localScale = new Vector3(0.14f, 0.50f, 0.14f);
                shard.transform.localRotation = Quaternion.Euler(UnityEngine.Random.Range(10f, 30f), s * 90f, 25f);
                shard.GetComponent<Renderer>().sharedMaterial = cyanRuneMat;
            }

            // Celestial Crystal Light (Illuminates from above)
            GameObject lightObj = new GameObject("CelestialCrystalPointLight");
            lightObj.transform.SetParent(crystalRoot.transform, false);
            lightObj.transform.localPosition = Vector3.zero;
            Light pointLight = lightObj.AddComponent<Light>();
            pointLight.type = LightType.Point;
            pointLight.color = new Color(0f, 0.90f, 1.0f);
            pointLight.range = 8.5f;
            pointLight.intensity = 2.2f;

            // Particle System (magical rising energy motes)
            GameObject psObj = new GameObject("CrystalMysticAuraParticles");
            psObj.transform.SetParent(crystalRoot.transform, false);
            psObj.transform.localPosition = Vector3.zero;
            ParticleSystem ps = psObj.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.startColor = new Color(0.2f, 0.95f, 1f, 0.7f);
            main.startSize = 0.12f;
            main.startLifetime = 2.0f;
            main.startSpeed = 0.4f;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var emission = ps.emission;
            emission.rateOverTime = 20f;
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.9f;

            var psRenderer = psObj.GetComponent<ParticleSystemRenderer>();
            psRenderer.material = cyanRuneMat;

            return new CrystalBuildResult
            {
                crystalTransform = crystalRoot.transform,
                crystalLight = pointLight,
                particles = ps
            };
        }

        private struct SocketBuildResult
        {
            public Transform[] socketTransforms;
            public TextMeshPro[] socketLabels;
        }

        private static SocketBuildResult BuildAltarSockets(Transform parent, Vector3 basePos, Material darkStoneMat, Material mossMat, Material cyanRuneMat, TMP_FontAsset fontAsset)
        {
            GameObject altarRoot = new GameObject("AltarSocketPedestal");
            altarRoot.transform.SetParent(parent, false);
            altarRoot.transform.position = basePos;

            // 1. Lower Stone Plinth / Foundation
            GameObject plinth = GameObject.CreatePrimitive(PrimitiveType.Cube);
            plinth.name = "AltarFoundationPlinth";
            plinth.transform.SetParent(altarRoot.transform, false);
            plinth.transform.localPosition = new Vector3(0f, -0.22f, 0.10f);
            plinth.transform.localScale = new Vector3(9.2f, 0.38f, 2.4f);
            plinth.GetComponent<Renderer>().sharedMaterial = darkStoneMat;

            // 2. Slanted Console Desk Face (Tilted -22 degrees toward camera)
            GameObject slantedDesk = new GameObject("SlantedConsoleDesk");
            slantedDesk.transform.SetParent(altarRoot.transform, false);
            slantedDesk.transform.localPosition = new Vector3(0f, 0.15f, 0.05f);
            slantedDesk.transform.localRotation = Quaternion.Euler(-22f, 0f, 0f);

            // Slanted Table Stone Plate
            GameObject deskPlate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            deskPlate.name = "DeskStonePlate";
            deskPlate.transform.SetParent(slantedDesk.transform, false);
            deskPlate.transform.localPosition = Vector3.zero;
            deskPlate.transform.localScale = new Vector3(9.2f, 0.16f, 1.80f);
            deskPlate.GetComponent<Renderer>().sharedMaterial = darkStoneMat;

            // Slanted Front Beveled Lip
            GameObject frontLip = GameObject.CreatePrimitive(PrimitiveType.Cube);
            frontLip.name = "DeskFrontLip";
            frontLip.transform.SetParent(slantedDesk.transform, false);
            frontLip.transform.localPosition = new Vector3(0f, -0.05f, -0.92f);
            frontLip.transform.localScale = new Vector3(9.3f, 0.20f, 0.18f);
            frontLip.GetComponent<Renderer>().sharedMaterial = mossMat;

            // 3. 6 Recessed Sockets on the Slanted Console Face
            Transform[] sockets = new Transform[6];
            TextMeshPro[] labels = new TextMeshPro[6];

            float[] xs = new float[] { -3.25f, -1.95f, -0.65f, 0.65f, 1.95f, 3.25f };

            for (int i = 0; i < 6; i++)
            {
                GameObject socketObj = new GameObject($"AltarSocket_{i + 1}");
                socketObj.transform.SetParent(slantedDesk.transform, false);
                socketObj.transform.localPosition = new Vector3(xs[i], 0.09f, 0.12f);
                socketObj.transform.localRotation = Quaternion.identity;

                // Recessed Socket Well (Dark stone inlay where tablet docks)
                GameObject socketWell = GameObject.CreatePrimitive(PrimitiveType.Cube);
                socketWell.name = "SocketWell";
                socketWell.transform.SetParent(socketObj.transform, false);
                socketWell.transform.localPosition = Vector3.zero;
                socketWell.transform.localScale = new Vector3(1.16f, 0.05f, 0.64f);
                socketWell.GetComponent<Renderer>().sharedMaterial = darkStoneMat;

                // Glowing Cyan Rune Border Frame
                GameObject socketFrame = GameObject.CreatePrimitive(PrimitiveType.Cube);
                socketFrame.name = "SocketFrame";
                socketFrame.transform.SetParent(socketObj.transform, false);
                socketFrame.transform.localPosition = new Vector3(0f, -0.015f, 0f);
                socketFrame.transform.localScale = new Vector3(1.22f, 0.04f, 0.70f);
                socketFrame.GetComponent<Renderer>().sharedMaterial = cyanRuneMat;

                // BoxCollider for Raycast Picking
                BoxCollider boxCol = socketObj.AddComponent<BoxCollider>();
                boxCol.center = new Vector3(0f, 0.10f, 0f);
                boxCol.size = new Vector3(1.24f, 0.40f, 0.85f);

                // Glowing Cyan Numeral [1-6] on the front lip of the slot (standing upright facing camera)
                GameObject numObj = new GameObject($"Numeral_{i + 1}");
                numObj.transform.SetParent(socketObj.transform, false);
                numObj.transform.localPosition = new Vector3(0f, 0.04f, -0.74f);
                numObj.transform.localRotation = Quaternion.Euler(22f, 0f, 0f);

                TextMeshPro tmp = numObj.AddComponent<TextMeshPro>();
                if (fontAsset != null) tmp.font = fontAsset;
                tmp.text = $"{i + 1}";
                tmp.fontSize = 4.2f;
                tmp.alignment = TextAlignmentOptions.Center;
                tmp.fontStyle = FontStyles.Bold;
                tmp.color = new Color(0f, 0.94f, 1f); // Vibrant cyan numeral

                sockets[i] = socketObj.transform;
                labels[i] = tmp;
            }

            return new SocketBuildResult
            {
                socketTransforms = sockets,
                socketLabels = labels
            };
        }

        private static List<ThirdPuzzleController.WordFragment> BuildFloatingWordFragments(
            Transform parent, Material stoneMat, Material borderMat, Material cyanRuneMat, TMP_FontAsset fontAsset)
        {
            GameObject fragmentRoot = new GameObject("FloatingWordFragmentsPool");
            fragmentRoot.transform.SetParent(parent, false);

            List<ThirdPuzzleController.WordFragment> list = new List<ThirdPuzzleController.WordFragment>();

            // Task 5 words exactly matching the reference image layout:
            // Top row: "come", "at", "tower"
            // Bottom row: "the", "sunset", "to"
            string[] words = new string[] { "come", "at", "tower", "the", "sunset", "to" };

            Vector3[] floatingPositions = new Vector3[]
            {
                // Top row (Y = 3.05)
                new Vector3(-2.15f, 3.05f, 0.65f),
                new Vector3(0f,     3.05f, 0.65f),
                new Vector3(2.15f,  3.05f, 0.65f),

                // Bottom row (Y = 2.05)
                new Vector3(-2.15f, 2.05f, 0.45f),
                new Vector3(0f,     2.05f, 0.45f),
                new Vector3(2.15f,  2.05f, 0.45f)
            };

            for (int i = 0; i < words.Length; i++)
            {
                string word = words[i];
                Vector3 pos = floatingPositions[i];

                GameObject tabletObj = new GameObject($"WordTablet_{word}");
                tabletObj.transform.SetParent(fragmentRoot.transform, false);
                tabletObj.transform.position = pos;

                // 1. Tablet Stone Slab
                GameObject slab = GameObject.CreatePrimitive(PrimitiveType.Cube);
                slab.name = "StoneSlab";
                slab.transform.SetParent(tabletObj.transform, false);
                slab.transform.localPosition = Vector3.zero;
                slab.transform.localScale = new Vector3(1.16f, 0.60f, 0.08f);
                slab.GetComponent<Renderer>().sharedMaterial = stoneMat;

                // 2. Beveled Antique Rim Trim
                GameObject rim = GameObject.CreatePrimitive(PrimitiveType.Cube);
                rim.name = "CarvedBorderTrim";
                rim.transform.SetParent(tabletObj.transform, false);
                rim.transform.localPosition = new Vector3(0f, 0f, 0.015f);
                rim.transform.localScale = new Vector3(1.24f, 0.68f, 0.04f);
                rim.GetComponent<Renderer>().sharedMaterial = borderMat;

                // 3. TextMeshPro 3D Glowing Text
                GameObject textObj = new GameObject("WordText");
                textObj.transform.SetParent(tabletObj.transform, false);
                textObj.transform.localPosition = new Vector3(0f, 0.02f, -0.06f);
                textObj.transform.localRotation = Quaternion.identity;

                TextMeshPro tmp = textObj.AddComponent<TextMeshPro>();
                if (fontAsset != null) tmp.font = fontAsset;
                tmp.text = word;
                tmp.fontSize = 4.2f;
                tmp.fontStyle = FontStyles.Bold;
                tmp.alignment = TextAlignmentOptions.Center;
                tmp.color = new Color(0f, 0.94f, 1.0f); // Bright cyan glowing text

                // BoxCollider for Raycast Picking
                BoxCollider col = tabletObj.AddComponent<BoxCollider>();
                col.center = Vector3.zero;
                col.size = new Vector3(1.25f, 0.70f, 0.35f);

                ThirdPuzzleController.WordFragment frag = new ThirdPuzzleController.WordFragment
                {
                    word = word,
                    tabletTransform = tabletObj.transform,
                    tabletRenderer = slab.GetComponent<Renderer>(),
                    textMesh = tmp,
                    initialFloatingPos = pos,
                    initialFloatingRot = Quaternion.identity,
                    currentSlotIndex = -1
                };

                list.Add(frag);
            }

            return list;
        }

        private static void BuildSidePlaques(Transform parent, TMP_FontAsset fontAsset, Material parchmentMat, Material borderMat)
        {
            GameObject sidePlaquesRoot = new GameObject("SidePlaques");
            sidePlaquesRoot.transform.SetParent(parent, false);

            // Left Plaque: Task Instruction (Ancient Parchment Scroll)
            BuildPlaqueTablet(sidePlaquesRoot.transform, new Vector3(-4.15f, 3.10f, 0.40f), new Vector3(0f, 18f, 0f),
                "<color=#2A1808><b>Arrange the message\nfragments in the\ncorrect order to\nactivate the crystal.</b></color>",
                fontAsset, parchmentMat, borderMat, 2.10f, 1.85f, 2.15f);

            // Right Plaque: Hint (Ancient Parchment Scroll)
            BuildPlaqueTablet(sidePlaquesRoot.transform, new Vector3(4.15f, 3.10f, 0.40f), new Vector3(0f, -18f, 0f),
                "<color=#B86E00><b>Hint:</b></color>\n\n<color=#2A1808><b>Create a meaningful\nsentence from the\nfragments.</b></color>",
                fontAsset, parchmentMat, borderMat, 2.10f, 1.85f, 2.15f);
        }

        private static void BuildPlaqueTablet(Transform parent, Vector3 pos, Vector3 rot, string text, TMP_FontAsset font, Material mat, Material borderMat, float width, float height, float fontSize)
        {
            GameObject plaqueObj = new GameObject("SidePlaqueTablet");
            plaqueObj.transform.SetParent(parent, false);
            plaqueObj.transform.position = pos;
            plaqueObj.transform.rotation = Quaternion.Euler(rot);

            // Parchment Base Plate
            GameObject plate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            plate.name = "PlaqueParchmentPlate";
            plate.transform.SetParent(plaqueObj.transform, false);
            plate.transform.localScale = new Vector3(width, height, 0.08f);
            plate.GetComponent<Renderer>().sharedMaterial = mat;

            // Border Trim Frame
            GameObject rim = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rim.name = "PlaqueBorderRim";
            rim.transform.SetParent(plaqueObj.transform, false);
            rim.transform.localPosition = new Vector3(0f, 0f, 0.02f);
            rim.transform.localScale = new Vector3(width + 0.14f, height + 0.14f, 0.05f);
            rim.GetComponent<Renderer>().sharedMaterial = borderMat;

            // Top and Bottom Scroll Rollers (Classic fantasy parchment scroll pegs)
            GameObject topRoller = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            topRoller.name = "ScrollRoller_Top";
            topRoller.transform.SetParent(plaqueObj.transform, false);
            topRoller.transform.localPosition = new Vector3(0f, height * 0.52f, -0.01f);
            topRoller.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            topRoller.transform.localScale = new Vector3(0.12f, width * 0.56f, 0.12f);
            topRoller.GetComponent<Renderer>().sharedMaterial = borderMat;

            GameObject btmRoller = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            btmRoller.name = "ScrollRoller_Bottom";
            btmRoller.transform.SetParent(plaqueObj.transform, false);
            btmRoller.transform.localPosition = new Vector3(0f, -height * 0.52f, -0.01f);
            btmRoller.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            btmRoller.transform.localScale = new Vector3(0.12f, width * 0.56f, 0.12f);
            btmRoller.GetComponent<Renderer>().sharedMaterial = borderMat;

            // Text
            GameObject textObj = new GameObject("PlaqueText");
            textObj.transform.SetParent(plaqueObj.transform, false);
            textObj.transform.localPosition = new Vector3(0f, 0f, -0.06f);

            TextMeshPro tmp = textObj.AddComponent<TextMeshPro>();
            if (font != null) tmp.font = font;
            tmp.text = text;
            tmp.fontSize = fontSize;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.textWrappingMode = TextWrappingModes.Normal;
            tmp.rectTransform.sizeDelta = new Vector2(width - 0.25f, height - 0.2f);
            tmp.color = new Color(0.16f, 0.10f, 0.06f);
        }

        private static void BuildHUDOverlay(Transform parent, ThirdPuzzleController controller, TMP_FontAsset fontAsset)
        {
            GameObject canvasObj = new GameObject("Task5_HUDCanvas");
            canvasObj.transform.SetParent(parent, false);

            Canvas canvas = canvasObj.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = controller.puzzleCamera;
            canvas.planeDistance = 3.2f;
            canvas.sortingOrder = 10;

            CanvasScaler scaler = canvasObj.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;

            canvasObj.AddComponent<GraphicRaycaster>();
            controller.puzzleCanvas = canvas;

            // 1. Sleek Top Header Banner
            GameObject header = new GameObject("HeaderBanner");
            header.transform.SetParent(canvasObj.transform, false);
            RectTransform headerRt = header.AddComponent<RectTransform>();
            headerRt.anchorMin = new Vector2(0.5f, 1f);
            headerRt.anchorMax = new Vector2(0.5f, 1f);
            headerRt.pivot = new Vector2(0.5f, 1f);
            headerRt.anchoredPosition = new Vector2(0f, -16f);
            headerRt.sizeDelta = new Vector2(760f, 72f);

            Image headerBg = header.AddComponent<Image>();
            headerBg.color = new Color(0.08f, 0.10f, 0.14f, 0.88f);

            GameObject titleObj = new GameObject("TitleText");
            titleObj.transform.SetParent(header.transform, false);
            RectTransform titleRt = titleObj.AddComponent<RectTransform>();
            titleRt.anchorMin = Vector2.zero;
            titleRt.anchorMax = Vector2.one;
            titleRt.offsetMin = new Vector2(10f, 4f);
            titleRt.offsetMax = new Vector2(-10f, -4f);

            TextMeshProUGUI titleTmp = titleObj.AddComponent<TextMeshProUGUI>();
            if (fontAsset != null) titleTmp.font = fontAsset;
            titleTmp.text = "<b>Task 5: Message Reconstruction Puzzle</b>\n<size=70%><color=#66CCFF>(English / Communication)</color></size>";
            titleTmp.fontSize = 24f;
            titleTmp.alignment = TextAlignmentOptions.Center;
            titleTmp.color = Color.white;

            // 2. Unified Bottom Control & Sentence Dock (Clean, single compact footer panel)
            GameObject bottomPanel = new GameObject("BottomControlFooter");
            bottomPanel.transform.SetParent(canvasObj.transform, false);
            RectTransform footerRt = bottomPanel.AddComponent<RectTransform>();
            footerRt.anchorMin = new Vector2(0.5f, 0f);
            footerRt.anchorMax = new Vector2(0.5f, 0f);
            footerRt.pivot = new Vector2(0.5f, 0f);
            footerRt.anchoredPosition = new Vector2(0f, 14f);
            footerRt.sizeDelta = new Vector2(1060f, 96f);

            Image footerBg = bottomPanel.AddComponent<Image>();
            footerBg.color = new Color(0.07f, 0.09f, 0.13f, 0.90f);

            // Sentence Preview Text (Row 1 left)
            GameObject prevTextObj = new GameObject("SentencePreviewText");
            prevTextObj.transform.SetParent(bottomPanel.transform, false);
            RectTransform prevTextRt = prevTextObj.AddComponent<RectTransform>();
            prevTextRt.anchorMin = new Vector2(0f, 0.46f);
            prevTextRt.anchorMax = new Vector2(0.66f, 1f);
            prevTextRt.offsetMin = new Vector2(16f, 2f);
            prevTextRt.offsetMax = new Vector2(-10f, -4f);

            TextMeshProUGUI sentenceTmp = prevTextObj.AddComponent<TextMeshProUGUI>();
            if (fontAsset != null) sentenceTmp.font = fontAsset;
            sentenceTmp.text = "<b>Current Altar Message:</b> [ 1: _ ] [ 2: _ ] [ 3: _ ] [ 4: _ ] [ 5: _ ] [ 6: _ ]";
            sentenceTmp.fontSize = 18f;
            sentenceTmp.alignment = TextAlignmentOptions.Left;
            sentenceTmp.color = Color.white;
            controller.sentencePreviewText = sentenceTmp;

            // Action Buttons: Confirm, Reset, Return (Row 1 right)
            GameObject actionsRoot = new GameObject("ActionsRoot");
            actionsRoot.transform.SetParent(bottomPanel.transform, false);
            RectTransform actRt = actionsRoot.AddComponent<RectTransform>();
            actRt.anchorMin = new Vector2(0.66f, 0.46f);
            actRt.anchorMax = new Vector2(1f, 1f);
            actRt.offsetMin = new Vector2(5f, 2f);
            actRt.offsetMax = new Vector2(-16f, -4f);

            controller.confirmBtn = CreateUIButton(actionsRoot.transform, "ConfirmBtn", new Vector2(-115f, 0f), new Vector2(105f, 36f), "Confirm [E]", fontAsset, new Color(0.12f, 0.48f, 0.32f), 15f);
            controller.resetBtn = CreateUIButton(actionsRoot.transform, "ResetBtn", new Vector2(0f, 0f), new Vector2(95f, 36f), "Reset [R]", fontAsset, new Color(0.42f, 0.30f, 0.15f), 15f);
            controller.returnBtn = CreateUIButton(actionsRoot.transform, "ReturnBtn", new Vector2(110f, 0f), new Vector2(95f, 36f), "Exit [Esc]", fontAsset, new Color(0.35f, 0.18f, 0.18f), 15f);

            // Row 2: Prompt / Instruction / Status Text (across full width)
            GameObject promptObj = new GameObject("StatusPromptText");
            promptObj.transform.SetParent(bottomPanel.transform, false);
            RectTransform promptRt = promptObj.AddComponent<RectTransform>();
            promptRt.anchorMin = new Vector2(0f, 0f);
            promptRt.anchorMax = new Vector2(1f, 0.46f);
            promptRt.offsetMin = new Vector2(16f, 4f);
            promptRt.offsetMax = new Vector2(-16f, -2f);

            TextMeshProUGUI promptTmp = promptObj.AddComponent<TextMeshProUGUI>();
            if (fontAsset != null) promptTmp.font = fontAsset;
            promptTmp.text = "<b>Drag & place in order:</b> Click fragment -> Click slot [1-6] • [A/D] Select • [1-6] Quick Place • [E] Confirm • [Esc] Exit";
            promptTmp.fontSize = 15f;
            promptTmp.alignment = TextAlignmentOptions.Center;
            promptTmp.color = new Color(1f, 0.90f, 0.65f);
            controller.statusText = promptTmp;

            // 3. Victory Panel Modal
            GameObject vicObj = new GameObject("VictoryPanel");
            vicObj.transform.SetParent(canvasObj.transform, false);
            RectTransform vicRt = vicObj.AddComponent<RectTransform>();
            vicRt.anchorMin = new Vector2(0.5f, 0.5f);
            vicRt.anchorMax = new Vector2(0.5f, 0.5f);
            vicRt.pivot = new Vector2(0.5f, 0.5f);
            vicRt.anchoredPosition = new Vector2(0f, 35f);
            vicRt.sizeDelta = new Vector2(720f, 320f);

            Image vicBg = vicObj.AddComponent<Image>();
            vicBg.color = new Color(0.06f, 0.12f, 0.16f, 0.94f);

            GameObject vicTextObj = new GameObject("VictoryText");
            vicTextObj.transform.SetParent(vicObj.transform, false);
            RectTransform vtRt = vicTextObj.AddComponent<RectTransform>();
            vtRt.anchorMin = Vector2.zero;
            vtRt.anchorMax = Vector2.one;
            vtRt.offsetMin = new Vector2(25f, 75f);
            vtRt.offsetMax = new Vector2(-25f, -20f);

            TextMeshProUGUI vtTmp = vicTextObj.AddComponent<TextMeshProUGUI>();
            if (fontAsset != null) vtTmp.font = fontAsset;
            vtTmp.text = "<color=#FFD700><size=130%>★ CELESTIAL CRYSTAL ACTIVATED! ★</size></color>\n\n" +
                         "The ancient message fragments align with harmonic resonance:\n\n" +
                         "<color=#00E5FF><b>\"Come to the tower at sunset.\"</b></color>\n\n" +
                         "<size=80%><color=#DDDDDD>The celestial barrier fades. Proceed onward toward the ancient watchtower.</color></size>";
            vtTmp.fontSize = 23f;
            vtTmp.alignment = TextAlignmentOptions.Center;
            vtTmp.color = Color.white;

            Button vicReturnBtn = CreateUIButton(vicObj.transform, "VicReturnBtn", new Vector2(0f, -115f), new Vector2(240f, 50f), "Return to Village [Esc]", fontAsset, new Color(0.18f, 0.55f, 0.35f), 18f);
            vicReturnBtn.onClick.AddListener(controller.ReturnToVillage);

            vicObj.SetActive(false);
            controller.victoryPanel = vicObj;
        }

        private static Button CreateUIButton(Transform parent, string name, Vector2 pos, Vector2 size, string label, TMP_FontAsset fontAsset, Color bgCol, float fontSize = 16f)
        {
            GameObject btnObj = new GameObject(name);
            btnObj.transform.SetParent(parent, false);

            RectTransform rt = btnObj.AddComponent<RectTransform>();
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;

            Image img = btnObj.AddComponent<Image>();
            img.color = bgCol;

            Button btn = btnObj.AddComponent<Button>();
            ColorBlock cb = btn.colors;
            cb.normalColor = bgCol;
            cb.highlightedColor = bgCol * 1.3f;
            cb.pressedColor = bgCol * 0.8f;
            btn.colors = cb;

            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(btnObj.transform, false);
            RectTransform textRt = textObj.AddComponent<RectTransform>();
            textRt.anchorMin = Vector2.zero;
            textRt.anchorMax = Vector2.one;
            textRt.offsetMin = Vector2.zero;
            textRt.offsetMax = Vector2.zero;

            TextMeshProUGUI tmp = textObj.AddComponent<TextMeshProUGUI>();
            if (fontAsset != null) tmp.font = fontAsset;
            tmp.text = label;
            tmp.fontSize = fontSize;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color = Color.white;

            return btn;
        }

        public static void PlaceThirdClueInVillageScene()
        {
            if (!File.Exists(VillageScenePath)) return;

            Scene villageScene = EditorSceneManager.OpenScene(VillageScenePath, OpenSceneMode.Single);
            if (!villageScene.IsValid()) return;

            GameObject existing = GameObject.Find("ThirdClue");
            if (existing != null)
            {
                UnityEngine.Object.DestroyImmediate(existing);
            }

            GameObject clueObj = new GameObject("ThirdClue");
            clueObj.transform.position = ThirdClueVillagePosition;

            SphereCollider sc = clueObj.AddComponent<SphereCollider>();
            sc.isTrigger = true;
            sc.radius = 3.2f;

            ThirdClue clueScript = clueObj.AddComponent<ThirdClue>();
            clueScript.dedicatedSceneName = "StaticThirdPuzzleScene";
            clueScript.requireInteractionKey = false;

            // Visual marker for clue in village (magic rock / crystal pedestal)
            GameObject markerPrefab = LoadPrefab("StylRocksMagic_1_LOD0") ?? LoadPrefab("MagicRock_1");
            if (markerPrefab != null)
            {
                GameObject visual = UnityEngine.Object.Instantiate(markerPrefab, clueObj.transform, false);
                visual.name = "ThirdClueVisualMarker";
                visual.transform.localPosition = Vector3.zero;
                visual.transform.localScale = new Vector3(0.6f, 0.8f, 0.6f);
            }

            EditorSceneManager.MarkSceneDirty(villageScene);
            EditorSceneManager.SaveScene(villageScene);
            Debug.Log($"[StaticThirdPuzzleSceneBuilder] ThirdClue placed at {ThirdClueVillagePosition} in '{VillageScenePath}'");
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
            Debug.Log($"[StaticThirdPuzzleSceneBuilder] Added '{scenePath}' to EditorBuildSettings.");
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
            Debug.Log($"[StaticThirdPuzzleSceneBuilder] Captured high-resolution puzzle render to: {outputPath}");

            try
            {
                if (Directory.Exists(ArtifactDir))
                {
                    string artifactDest = Path.Combine(ArtifactDir, Path.GetFileName(outputPath));
                    File.Copy(outputPath, artifactDest, true);
                    Debug.Log($"[StaticThirdPuzzleSceneBuilder] Render copied to artifact directory: {artifactDest}");
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[StaticThirdPuzzleSceneBuilder] Could not copy to artifact directory: {ex.Message}");
            }
        }
    }
}
