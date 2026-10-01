using System.Collections.Generic;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    public class PuzzleThemeEngine : MonoBehaviour
    {
        public static PuzzleThemeEngine Instance { get; private set; }

        [Header("Asset Definitions")]
        [SerializeField]
        private List<EnvironmentAssetDefinition> assetDefinitions = new List<EnvironmentAssetDefinition>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public Material CreateThemeMaterial(EnvironmentTheme theme, PuzzleMechanismType mechanismType)
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Universal Render Pipeline/Simple Lit");
            if (shader == null) shader = Shader.Find("Standard");
            if (shader == null) shader = Shader.Find("Unlit/Color");
            if (shader == null) shader = Shader.Find("Sprites/Default");

            Material mat = new Material(shader != null ? shader : Shader.Find("Legacy Shaders/Diffuse"));

            switch (theme)
            {
                case EnvironmentTheme.Dungeon:
                    mat.color = new Color(0.35f, 0.35f, 0.38f); // Ancient stone grey
                    break;
                case EnvironmentTheme.Dark:
                    mat.color = new Color(0.12f, 0.12f, 0.18f); // Obsidian dark blue
                    break;
                case EnvironmentTheme.Medieval:
                    mat.color = new Color(0.48f, 0.35f, 0.22f); // Polished mahogany wood
                    break;
                case EnvironmentTheme.Alchemy:
                    mat.color = new Color(0.15f, 0.45f, 0.55f); // Deep arcane teal
                    break;
                default:
                    mat.color = new Color(0.4f, 0.4f, 0.4f);
                    break;
            }

            return mat;
        }

        public Color GetThemeGlowColor(EnvironmentTheme theme)
        {
            switch (theme)
            {
                case EnvironmentTheme.Dungeon: return new Color(1.0f, 0.6f, 0.2f); // Torch amber
                case EnvironmentTheme.Dark: return new Color(0.7f, 0.2f, 1.0f); // Shadow violet
                case EnvironmentTheme.Medieval: return new Color(0.2f, 0.7f, 1.0f); // Royal sapphire
                case EnvironmentTheme.Alchemy: return new Color(0.2f, 1.0f, 0.8f); // Runic cyan
                default: return Color.yellow;
            }
        }

        public EnvironmentAssetDefinition FindAsset(AssetCategory category, EnvironmentTheme theme)
        {
            if (assetDefinitions == null || assetDefinitions.Count == 0)
            {
                // Load from Resources if list is unassigned
                EnvironmentAssetDefinition[] loaded = Resources.LoadAll<EnvironmentAssetDefinition>("");
                if (loaded != null && loaded.Length > 0)
                {
                    assetDefinitions.AddRange(loaded);
                }
            }

            if (assetDefinitions != null && assetDefinitions.Count > 0)
            {
                foreach (var def in assetDefinitions)
                {
                    if (def != null && def.category == category && def.theme == theme)
                    {
                        return def;
                    }
                }

                // Fallback match by category alone
                foreach (var def in assetDefinitions)
                {
                    if (def != null && def.category == category)
                    {
                        return def;
                    }
                }
            }

            // Fallback to real project prefabs from PuzzleAssetLibrary
            GameObject fallbackPrefab = (category == AssetCategory.Floor) 
                ? PuzzleAssetLibrary.GetPlatformPrefab(theme, PuzzleMechanismType.StoneMatrixPlatform)
                : PuzzleAssetLibrary.GetElementPrefab(PuzzleMechanismType.StoneMatrixPlatform, 0);

            if (fallbackPrefab != null)
            {
                EnvironmentAssetDefinition synthetic = ScriptableObject.CreateInstance<EnvironmentAssetDefinition>();
                synthetic.displayName = fallbackPrefab.name;
                synthetic.prefab = fallbackPrefab;
                synthetic.category = category;
                synthetic.theme = theme;
                return synthetic;
            }

            return null;
        }

        public EnvironmentAssetDefinition FindMechanismAsset(PuzzleMechanismType mechanismType, EnvironmentTheme theme)
        {
            string mechKey = mechanismType.ToString().ToLower();

            if (assetDefinitions != null && assetDefinitions.Count > 0)
            {
                foreach (var def in assetDefinitions)
                {
                    if (def == null) continue;
                    if (def.isPuzzleMechanismAsset && def.theme == theme)
                    {
                        if (!string.IsNullOrEmpty(def.mechanismTags) && def.mechanismTags.ToLower().Contains(mechKey))
                            return def;
                    }
                }
            }

            // Asset fallback logging as required by specification
            Debug.Log($"[PuzzleEnvironment] Specialized asset missing for mechanism {mechanismType}. Using compatible theme asset fallback.");
            return FindAsset(AssetCategory.Structure, theme);
        }

        public EnvironmentAssetDefinition FindElementAsset(PuzzleMechanismType mechanismType, EnvironmentTheme theme)
        {
            if (assetDefinitions != null && assetDefinitions.Count > 0)
            {
                foreach (var def in assetDefinitions)
                {
                    if (def == null) continue;
                    if (def.category == AssetCategory.Interactive && def.theme == theme)
                    {
                        return def;
                    }
                }
            }

            return FindAsset(AssetCategory.Prop, theme);
        }
    }
}
