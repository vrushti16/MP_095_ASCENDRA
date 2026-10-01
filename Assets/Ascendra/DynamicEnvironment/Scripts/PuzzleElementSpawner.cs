using System.Collections.Generic;
using TMPro;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    public class PuzzleElementSpawner : MonoBehaviour
    {
        public static List<GameObject> SpawnPuzzleEnvironment(PuzzleEnvironmentPlan plan, Transform rootTransform)
        {
            List<GameObject> spawned = new List<GameObject>();

            if (plan == null || rootTransform == null)
                return spawned;

            // 1. Base Environment Platform
            GameObject basePlatform = SpawnBasePlatform(plan, rootTransform);
            if (basePlatform != null)
                spawned.Add(basePlatform);

            // 2. Interactive Puzzle Elements (Physical 3D Tiles / Pillars / Switches / Altars)
            for (int i = 0; i < plan.interactiveElementCount; i++)
            {
                Vector3 pos = plan.elementPositions[i];
                Quaternion rot = plan.elementRotations[i];
                Vector3 scale = plan.elementScales[i];
                string elemId = plan.elementIds[i];
                string val = plan.elementValues[i];
                string lbl = plan.elementLabels[i];

                GameObject elemObj = SpawnSingleElement(plan, i, pos, rot, scale, elemId, val, lbl, rootTransform);
                if (elemObj != null)
                {
                    spawned.Add(elemObj);
                }
            }

            // 3. Clue Inscription Monument / Tablet (Removed per user request)
            // Clue tablet is removed so player has unobstructed direct view and interaction with the puzzle platform.

            // 4. Atmosphere Lighting & Visual Effects
            GameObject atmosphereObj = SpawnAtmosphere(plan, rootTransform);
            if (atmosphereObj != null)
                spawned.Add(atmosphereObj);

            Debug.Log($"[PuzzleEnvironment] Spawned element mechanism '{plan.mechanismType}' with {spawned.Count} objects.");
            return spawned;
        }

        private static Material GetOrCreateStoneMaterial(string matName, Color color, float smoothness = 0.15f)
        {
            Material mat = null;
#if UNITY_EDITOR
            string dir = "Assets/Ascendra/DynamicEnvironment/Materials";
            if (!UnityEditor.AssetDatabase.IsValidFolder("Assets/Ascendra/DynamicEnvironment"))
            {
                UnityEditor.AssetDatabase.CreateFolder("Assets/Ascendra", "DynamicEnvironment");
            }
            if (!UnityEditor.AssetDatabase.IsValidFolder(dir))
            {
                UnityEditor.AssetDatabase.CreateFolder("Assets/Ascendra/DynamicEnvironment", "Materials");
            }
            string path = $"{dir}/{matName}.mat";

            Material sampleUrpMat = UnityEditor.AssetDatabase.LoadAssetAtPath<Material>("Assets/RPGPP_LT/Materials/rpgpp_lt_mat_a.mat")
                ?? UnityEditor.AssetDatabase.LoadAssetAtPath<Material>("Assets/StylRocksMagic/StylRocksMagic_TexturesMat/StylRocksMagic_Mat.mat");
            Shader urpShader = sampleUrpMat != null ? sampleUrpMat.shader : Shader.Find("Universal Render Pipeline/Lit");
            if (urpShader == null) urpShader = Shader.Find("Standard");

            mat = UnityEditor.AssetDatabase.LoadAssetAtPath<Material>(path);
            if (mat == null)
            {
                mat = new Material(urpShader);
                mat.name = matName;
                if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
                mat.color = color;
                if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
                else if (mat.HasProperty("_Glossiness")) mat.SetFloat("_Glossiness", smoothness);
                if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", 0.04f);

                UnityEditor.AssetDatabase.CreateAsset(mat, path);
                UnityEditor.AssetDatabase.SaveAssets();
            }
            else
            {
                if (urpShader != null && mat.shader != urpShader) mat.shader = urpShader;
                if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
                mat.color = color;
                if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
                UnityEditor.EditorUtility.SetDirty(mat);
            }
#else
            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            mat = new Material(shader);
            mat.name = matName;
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
            mat.color = color;
#endif
            return mat;
        }

        private static GameObject SpawnBasePlatform(PuzzleEnvironmentPlan plan, Transform parent)
        {
            GameObject platform = new GameObject($"PuzzleBasePlatform_{plan.mechanismType}");
            platform.transform.SetParent(parent, false);
            platform.transform.position = plan.boundsCenter;

            // Warm stone materials matching reference concept image
            Material foundationMat = GetOrCreateStoneMaterial("M_AncientStoneFoundation", new Color(0.44f, 0.42f, 0.39f, 1f), 0.10f);
            Material stoneMat = GetOrCreateStoneMaterial("M_AncientStoneDais", new Color(0.54f, 0.52f, 0.48f, 1f), 0.15f);
            Material curbMat = GetOrCreateStoneMaterial("M_AncientStoneCurb", new Color(0.36f, 0.34f, 0.32f, 1f), 0.12f);

            float daisWidth = 7.0f;
            float daisDepth = 7.0f;

            // Tier 1: Broad Foundation Stone Step (Height 0.16m, Width 7.8m x 7.8m)
            GameObject lowerDais = GameObject.CreatePrimitive(PrimitiveType.Cube);
            lowerDais.name = "StoneDais_BaseFoundation";
            lowerDais.transform.SetParent(platform.transform, false);
            lowerDais.transform.localPosition = new Vector3(0f, 0.08f, 0f);
            lowerDais.transform.localScale = new Vector3(daisWidth + 0.8f, 0.16f, daisDepth + 0.8f);
            if (foundationMat != null) lowerDais.GetComponent<MeshRenderer>().sharedMaterial = foundationMat;

            // Tier 2: Raised Carved Stone Altar Dais (Height 0.18m, Width 7.0m x 7.0m)
            GameObject upperDais = GameObject.CreatePrimitive(PrimitiveType.Cube);
            upperDais.name = "StoneDais_UpperPlatform";
            upperDais.transform.SetParent(platform.transform, false);
            upperDais.transform.localPosition = new Vector3(0f, 0.25f, 0f);
            upperDais.transform.localScale = new Vector3(daisWidth, 0.18f, daisDepth);
            if (stoneMat != null) upperDais.GetComponent<MeshRenderer>().sharedMaterial = stoneMat;

            // Border curb stones framing the platform edge
            GameObject borderGroup = new GameObject("DaisBorders");
            borderGroup.transform.SetParent(platform.transform, false);
            float halfW = daisWidth * 0.5f;
            float halfD = daisDepth * 0.5f;

            CreateDaisCurb(borderGroup.transform, new Vector3(0f, 0.35f, halfD), new Vector3(daisWidth + 0.2f, 0.08f, 0.25f), curbMat);
            CreateDaisCurb(borderGroup.transform, new Vector3(0f, 0.35f, -halfD), new Vector3(daisWidth + 0.2f, 0.08f, 0.25f), curbMat);
            CreateDaisCurb(borderGroup.transform, new Vector3(-halfW, 0.35f, 0f), new Vector3(0.25f, 0.08f, daisDepth + 0.2f), curbMat);
            CreateDaisCurb(borderGroup.transform, new Vector3(halfW, 0.35f, 0f), new Vector3(0.25f, 0.08f, daisDepth + 0.2f), curbMat);

            // Cobblestone paver surface on the upper dais
            GameObject tilePrefab = PuzzleAssetLibrary.GetPrefab("Floor_Stone");
            if (tilePrefab != null)
            {
                GameObject paversGroup = new GameObject("DaisPavers");
                paversGroup.transform.SetParent(platform.transform, false);
                float tileStep = 2.15f;
                for (int x = -1; x <= 1; x++)
                {
                    for (int z = -1; z <= 1; z++)
                    {
                        GameObject tile = Instantiate(tilePrefab, paversGroup.transform, false);
                        tile.name = $"Paver_{x}_{z}";
                        tile.transform.localPosition = new Vector3(x * tileStep, 0.34f, z * tileStep);
                        tile.transform.localScale = new Vector3(1.08f, 0.5f, 1.08f);
                    }
                }
            }

            return platform;
        }

        private static void CreateDaisCurb(Transform parent, Vector3 localPos, Vector3 localScale, Material mat)
        {
            GameObject curb = GameObject.CreatePrimitive(PrimitiveType.Cube);
            curb.name = "DaisCurbStone";
            curb.transform.SetParent(parent, false);
            curb.transform.localPosition = localPos;
            curb.transform.localScale = localScale;
            if (mat != null) curb.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        private static GameObject SpawnSingleElement(PuzzleEnvironmentPlan plan, int index, Vector3 pos, Quaternion rot, Vector3 scale, string elemId, string val, string lbl, Transform parent)
        {
            GameObject elementRoot = new GameObject($"PuzzleElement_{elemId}_{index}");
            elementRoot.transform.SetParent(parent, false);
            elementRoot.transform.position = pos;
            elementRoot.transform.rotation = rot;

            bool isMissingRune = (val == "??" || elemId == "t5");
            GameObject modelInstance = null;

            if (isMissingRune)
            {
                // Missing center rune: Low circular stone pedestal socket sitting flat on the dais
                modelInstance = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                modelInstance.name = "CenterRunePedestal_Socket";
                modelInstance.transform.SetParent(elementRoot.transform, false);
                modelInstance.transform.localPosition = new Vector3(0f, 0.02f, 0f);
                modelInstance.transform.localScale = new Vector3(1.0f, 0.04f, 1.0f);

                Material pedestalMat = GetOrCreateStoneMaterial("M_AncientStoneCurb", new Color(0.36f, 0.34f, 0.32f, 1f), 0.12f);
                if (pedestalMat != null) modelInstance.GetComponent<MeshRenderer>().sharedMaterial = pedestalMat;

                // Rich golden point light radiating from the missing rune center
                GameObject glowObj = new GameObject("RuneCenterGlowLight");
                glowObj.transform.SetParent(elementRoot.transform, false);
                glowObj.transform.localPosition = Vector3.up * 1.5f;

                Light glowLt = glowObj.AddComponent<Light>();
                glowLt.type = LightType.Point;
                glowLt.color = new Color(1.0f, 0.85f, 0.25f); // Rich golden glow
                glowLt.intensity = 3.8f;
                glowLt.range = 5.2f;
            }
            else
            {
                // Regular upright standing monolith
                string semanticType = (plan.elementSemanticTypes != null && index < plan.elementSemanticTypes.Length) ? plan.elementSemanticTypes[index] : "RuneStone_1";
                GameObject elemPrefab = PuzzleAssetLibrary.GetPrefab("RuneStone_1") ?? PuzzleAssetLibrary.GetElementPrefab(plan.mechanismType, plan.theme, index, semanticType);
                if (elemPrefab != null)
                {
                    modelInstance = Instantiate(elemPrefab, elementRoot.transform, false);
                    modelInstance.name = $"{elemPrefab.name}_Mesh";
                    modelInstance.transform.localPosition = Vector3.zero;
                    modelInstance.transform.localRotation = Quaternion.identity;
                    modelInstance.transform.localScale = scale;
                }
                else
                {
                    modelInstance = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    modelInstance.name = "ElementMesh";
                    modelInstance.transform.SetParent(elementRoot.transform, false);
                    modelInstance.transform.localPosition = Vector3.up * 0.7f;
                    modelInstance.transform.localScale = new Vector3(1.0f, 1.4f, 1.0f);
                }
            }

            // Ensure generous 3D interaction collider exists directly on elementRoot
            BoxCollider rootCol = elementRoot.GetComponent<BoxCollider>();
            if (rootCol == null) rootCol = elementRoot.AddComponent<BoxCollider>();
            rootCol.center = Vector3.up * (isMissingRune ? 0.75f : 1.0f);
            rootCol.size = isMissingRune ? new Vector3(2.2f, 1.8f, 2.2f) : new Vector3(1.6f, 2.2f, 1.6f);

            // Add High-Readability 3D Floating Text Overlay (directly faces isometric camera at pitch 38, yaw 45)
            GameObject textObj = new GameObject("Label3D");
            textObj.transform.SetParent(elementRoot.transform, false);

            float labelHeight = isMissingRune ? 0.78f : 1.55f;
            textObj.transform.position = elementRoot.transform.position + Vector3.up * labelHeight;
            textObj.transform.rotation = Quaternion.Euler(38f, 45f, 0f); // Directly faces isometric camera lens

            TextMeshPro tmp = textObj.AddComponent<TextMeshPro>();
            string displayText = !string.IsNullOrEmpty(val) ? val : lbl;
            tmp.text = isMissingRune ? "<color=#FFE066><b>??</b></color>" : $"<b>{displayText}</b>";
            tmp.fontSize = isMissingRune ? 7.6f : 4.4f;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.fontStyle = FontStyles.Bold;
            tmp.color = isMissingRune ? new Color(1.0f, 0.88f, 0.25f) : new Color(0.98f, 0.98f, 0.94f);
            tmp.outlineColor = isMissingRune ? new Color32(60, 40, 5, 255) : new Color32(12, 14, 20, 255);
            tmp.outlineWidth = 0.30f;

            RectTransform rt = textObj.GetComponent<RectTransform>();
            if (rt != null)
            {
                rt.sizeDelta = new Vector2(4.0f, 2.0f);
            }

            // Attach PuzzleElement script
            PuzzleElement elemComponent = elementRoot.AddComponent<PuzzleElement>();
            elemComponent.Initialize(elemId, plan.puzzleId, plan.puzzleType.ToString(), val, lbl, index);

            // Configure interaction mode and candidate values per puzzle type
            if (plan.puzzleType == PuzzleType.NumberMatrix)
            {
                string targetAns = !string.IsNullOrEmpty(plan.answer) ? plan.answer : "36";
                elemComponent.isInteractable = isMissingRune;
                elemComponent.interactionMode = ElementInteractionMode.RotateDial;

                if (isMissingRune)
                {
                    List<string> candidates = new List<string>();
                    if (int.TryParse(targetAns, out int ansInt) && ansInt > 0)
                    {
                        int step = 6;
                        candidates.Add((ansInt - step * 2).ToString());
                        candidates.Add((ansInt - step).ToString());
                        candidates.Add(ansInt.ToString());
                        candidates.Add((ansInt + 4).ToString());
                        candidates.Add((ansInt + step).ToString());
                    }
                    else
                    {
                        candidates.AddRange(new string[] { "24", "30", "36", "40", "42" });
                    }
                    elemComponent.SetCandidateValues(candidates, "??");
                }
            }
            else if (plan.puzzleType == PuzzleType.Sequence)
            {
                elemComponent.isInteractable = true;
                elemComponent.interactionMode = ElementInteractionMode.PressStep;
            }
            else
            {
                elemComponent.isInteractable = true;
                elemComponent.interactionMode = ElementInteractionMode.RotateDial;
            }

            Debug.Log($"[PuzzleEnvironment] Spawned 3D element: {elemId} (Value: {val}, Interactable: {elemComponent.isInteractable}) with prefab '{modelInstance?.name}'");
            return elementRoot;
        }

        private static GameObject SpawnAtmosphere(PuzzleEnvironmentPlan plan, Transform parent)
        {
            GameObject atmoObj = new GameObject("PuzzleAtmosphere");
            atmoObj.transform.SetParent(parent, false);
            atmoObj.transform.position = plan.boundsCenter + Vector3.up * 4f;

            Light lt = atmoObj.AddComponent<Light>();
            lt.type = LightType.Point;
            lt.range = plan.boundsSize.x * 2.5f;
            lt.color = plan.lightingColor;
            lt.intensity = plan.lightingIntensity;

            // Spawn 4 standing fire braziers flanking the 4 corners of the stone dais
            GameObject firePrefab = null;
#if UNITY_EDITOR
            firePrefab = UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>("Assets/LowPolyMedievalPropsLite/Prefabs/Fire_01.prefab");
#endif
            if (firePrefab == null)
            {
                firePrefab = PuzzleAssetLibrary.GetPrefab("Fire_01") ?? PuzzleAssetLibrary.GetPrefab("TorchFire") ?? PuzzleAssetLibrary.GetAtmospherePrefab(plan.theme);
            }

            GameObject standPrefab = PuzzleAssetLibrary.GetPrefab("CookingPot") ?? PuzzleAssetLibrary.GetPrefab("Cauldron");
            Material ironMat = GetOrCreateStoneMaterial("M_WroughtIron", new Color(0.18f, 0.18f, 0.20f, 1f), 0.40f);

            float c = 3.25f;
            Vector3[] brazierPositions = new Vector3[]
            {
                new Vector3(+c, 0.35f, +c),   // Top corner (behind rune 12)
                new Vector3(-c, 0.35f, +c),   // Left corner (beside rune 48)
                new Vector3(+c, 0.35f, -c),   // Right corner (beside rune 24)
                new Vector3(-c, 0.35f, -c)    // Front corner (in front of rune 60)
            };

            for (int b = 0; b < brazierPositions.Length; b++)
            {
                GameObject brazierRoot = new GameObject($"Brazier_{b}");
                brazierRoot.transform.SetParent(parent, false);
                brazierRoot.transform.position = plan.boundsCenter + brazierPositions[b];

                // Slender Wrought-Iron Tripod / Quad Legs under the brazier
                GameObject legsGroup = new GameObject("BrazierLegs");
                legsGroup.transform.SetParent(brazierRoot.transform, false);
                for (int l = 0; l < 4; l++)
                {
                    float angle = l * 90f + 45f;
                    float rad = angle * Mathf.Deg2Rad;
                    GameObject leg = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    leg.name = $"Leg_{l}";
                    leg.transform.SetParent(legsGroup.transform, false);
                    leg.transform.localPosition = new Vector3(Mathf.Sin(rad) * 0.22f, 0.15f, Mathf.Cos(rad) * 0.22f);
                    leg.transform.localRotation = Quaternion.Euler(14f * Mathf.Cos(rad), angle, 14f * Mathf.Sin(rad));
                    leg.transform.localScale = new Vector3(0.06f, 0.32f, 0.06f);
                    if (ironMat != null) leg.GetComponent<MeshRenderer>().sharedMaterial = ironMat;
                }

                // Central Wrought-Iron Fire Bowl
                if (standPrefab != null)
                {
                    GameObject stand = Instantiate(standPrefab, brazierRoot.transform, false);
                    stand.name = "BrazierBowl";
                    stand.transform.localPosition = new Vector3(0f, 0.30f, 0f);
                    stand.transform.localScale = new Vector3(0.95f, 0.72f, 0.95f);
                    if (ironMat != null)
                    {
                        foreach (var mr in stand.GetComponentsInChildren<MeshRenderer>())
                        {
                            mr.sharedMaterial = ironMat;
                        }
                    }
                }

                // Vibrant 3D Flame & Particle Fire
                if (firePrefab != null)
                {
                    GameObject fire = Instantiate(firePrefab, brazierRoot.transform, false);
                    fire.name = "BrazierFlame";
                    fire.transform.localPosition = new Vector3(0f, 0.44f, 0f);
                    fire.transform.localScale = new Vector3(2.2f, 2.8f, 2.2f);
                    foreach (var ps in fire.GetComponentsInChildren<ParticleSystem>())
                    {
                        ps.Simulate(2.0f, true, true);
                    }
                }

                // Warm firelight point light illuminating stone pavers
                Light fireLt = brazierRoot.AddComponent<Light>();
                fireLt.type = LightType.Point;
                fireLt.color = new Color(1.0f, 0.62f, 0.18f); // Warm flame orange
                fireLt.intensity = 3.4f;
                fireLt.range = 6.5f;
                fireLt.shadows = LightShadows.Soft;
            }

            return atmoObj;
        }

        private static GameObject SpawnClueTablet(PuzzleEnvironmentPlan plan, Transform parent)
        {
            GameObject clueRoot = new GameObject("PuzzleClueMonument");
            clueRoot.transform.SetParent(parent, false);
            // Positioned cleanly along the front-left perimeter facing the isometric camera
            clueRoot.transform.position = plan.boundsCenter + new Vector3(-4.0f, 0.65f, -0.90f);
            clueRoot.transform.rotation = Quaternion.Euler(32f, 45f, 0f); // Tilted facing camera lens

            Material tabletMat = GetOrCreateStoneMaterial("M_AncientStoneTablet", new Color(0.68f, 0.66f, 0.62f, 1f), 0.18f);
            Material borderMat = GetOrCreateStoneMaterial("M_AncientStoneCurb", new Color(0.32f, 0.30f, 0.28f, 1f), 0.12f);

            // Layer 1: Darker stone slab base backing
            GameObject slabBacking = GameObject.CreatePrimitive(PrimitiveType.Cube);
            slabBacking.name = "ClueSlab_Backing";
            slabBacking.transform.SetParent(clueRoot.transform, false);
            slabBacking.transform.localPosition = new Vector3(0f, 0f, 0.04f);
            slabBacking.transform.localScale = new Vector3(2.55f, 1.55f, 0.22f);
            if (borderMat != null) slabBacking.GetComponent<MeshRenderer>().sharedMaterial = borderMat;

            // Layer 2: Carved light stone tablet face
            GameObject slabFace = GameObject.CreatePrimitive(PrimitiveType.Cube);
            slabFace.name = "ClueSlab_Face";
            slabFace.transform.SetParent(clueRoot.transform, false);
            slabFace.transform.localPosition = new Vector3(0f, 0f, -0.02f);
            slabFace.transform.localScale = new Vector3(2.40f, 1.40f, 0.18f);
            if (tabletMat != null) slabFace.GetComponent<MeshRenderer>().sharedMaterial = tabletMat;

            // Base mounting stone stand
            GameObject stoneStand = GameObject.CreatePrimitive(PrimitiveType.Cube);
            stoneStand.name = "ClueSlab_Stand";
            stoneStand.transform.SetParent(clueRoot.transform, false);
            stoneStand.transform.localPosition = new Vector3(0f, -0.74f, 0.05f);
            stoneStand.transform.localScale = new Vector3(2.65f, 0.22f, 0.45f);
            if (borderMat != null) stoneStand.GetComponent<MeshRenderer>().sharedMaterial = borderMat;

            // Engraved clue text on the slab (centered with perfect margins)
            GameObject textObj = new GameObject("ClueText3D");
            textObj.transform.SetParent(clueRoot.transform, false);
            textObj.transform.localPosition = new Vector3(0f, -0.06f, -0.14f);
            textObj.transform.localRotation = Quaternion.identity;

            TextMeshPro tmp = textObj.AddComponent<TextMeshPro>();
            tmp.text = "<size=115%><b><color=#D4A017>ANCIENT RUNIC CLUE:</color></b></size>\n" +
                       "<size=88%><color=#2C2523>Runes resonate in steady</color></size>\n" +
                       "<size=92%><color=#2C2523>intervals of </color><b><color=#C62828>+6</color></b></size>";
            tmp.fontSize = 2.05f;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.fontStyle = FontStyles.Bold;
            tmp.outlineColor = new Color32(230, 220, 205, 255);
            tmp.outlineWidth = 0.15f;

            RectTransform rt = textObj.GetComponent<RectTransform>();
            if (rt != null)
            {
                rt.sizeDelta = new Vector2(3.0f, 1.6f);
            }

            return clueRoot;
        }
    }
}
