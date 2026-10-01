using System;
using System.Collections.Generic;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Authoritative Asset Library for ASCENDRA Dynamic Puzzle Environments.
    /// Maps semantic asset names, themes, and puzzle mechanism types directly to high-quality project prefabs
    /// loaded from Resources/PuzzlePrefabs.
    /// Ensures every clue trigger creates a visually unique, thematically tailored, and interactable 3D environment.
    /// </summary>
    public class PuzzleAssetLibrary : MonoBehaviour
    {
        private static PuzzleAssetLibrary instance;
        public static PuzzleAssetLibrary Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = FindFirstObjectByType<PuzzleAssetLibrary>();
                    if (instance == null)
                    {
                        GameObject go = new GameObject("PuzzleAssetLibrary");
                        instance = go.AddComponent<PuzzleAssetLibrary>();
                        DontDestroyOnLoad(go);
                    }
                }
                return instance;
            }
        }

        private static readonly Dictionary<string, GameObject> prefabCache = new Dictionary<string, GameObject>(StringComparer.OrdinalIgnoreCase);
        private static bool isInitialized = false;

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }
            instance = this;
            InitializeLibrary();
        }

        public static void InitializeLibrary()
        {
            if (isInitialized && prefabCache.Count > 0) return;

            // Load all prefabs located in Resources/PuzzlePrefabs
            GameObject[] loaded = Resources.LoadAll<GameObject>("PuzzlePrefabs");
            if (loaded != null)
            {
                foreach (var p in loaded)
                {
                    if (p != null && !prefabCache.ContainsKey(p.name))
                    {
                        prefabCache[p.name] = p;
                    }
                }
            }

            Debug.Log($"[PuzzleAssetLibrary] Initialized with {prefabCache.Count} prefabs from Resources/PuzzlePrefabs.");
            isInitialized = true;
        }

        /// <summary>
        /// Retrieves a prefab by exact name or semantic alias.
        /// </summary>
        public static GameObject GetPrefab(string nameOrSemantic)
        {
            InitializeLibrary();

            if (string.IsNullOrEmpty(nameOrSemantic))
                return GetDefaultRuneStone(0);

            // 1. Direct cache match
            if (prefabCache.TryGetValue(nameOrSemantic, out GameObject direct))
                return direct;

            // 2. Semantic matching
            string norm = nameOrSemantic.ToLower().Replace(" ", "_").Replace("-", "_");

            if (norm.Contains("book_big") || norm.Contains("tome"))
                return GetCached("Book_Big", "Pedestal_Book");

            if (norm.Contains("book_small") || norm.Contains("codex"))
                return GetCached("Book_Small_Green", "Book_Small_Red");

            if (norm.Contains("gem") || norm.Contains("crystal") || norm.Contains("emerald") || norm.Contains("ruby"))
                return (norm.Contains("ruby") || norm.Contains("red")) ? GetCached("Gem_Ruby", "Gem_Emerald") : GetCached("Gem_Emerald", "Gem_Ruby");

            if (norm.Contains("magicrock") || norm.Contains("monolith") || norm.Contains("rock"))
                return (norm.Contains("4") || norm.Contains("altar")) ? GetCached("MagicRock_4", "MagicRock_1") : GetCached("MagicRock_1", "RuneStone_1");

            if (norm.Contains("column") || norm.Contains("rocky"))
                return GetCached("Column_Stone", "Pillar");

            if (norm.Contains("pillar"))
                return GetCached("Pillar", "Column_Stone");

            if (norm.Contains("pedestal") || norm.Contains("altar") || norm.Contains("lectern") || norm.Contains("book"))
                return GetCached("Pedestal_Book", "Pillar");

            if (norm.Contains("cauldron") || norm.Contains("potion") || norm.Contains("alchemy") || norm.Contains("brew"))
                return GetCached("Cauldron", "CookingPot");

            if (norm.Contains("pot") || norm.Contains("cooking"))
                return GetCached("CookingPot", "Cauldron");

            if (norm.Contains("bottle") || norm.Contains("flask") || norm.Contains("vial"))
                return GetCached("Alchemist_Bottle", "Cauldron");

            if (norm.Contains("urn") || norm.Contains("amphora") || norm.Contains("vase"))
                return GetCached("Amphora_Urn", "Column_Stone");

            if (norm.Contains("chest") || norm.Contains("vault") || norm.Contains("coffer"))
                return GetCached("Chest", "Crate");

            if (norm.Contains("anvil") || norm.Contains("forge") || norm.Contains("iron"))
                return GetCached("Anvil", "Crate");

            if (norm.Contains("crate") || norm.Contains("box"))
                return GetCached("Crate", "Barrel");

            if (norm.Contains("barrel") || norm.Contains("keg") || norm.Contains("tub"))
                return GetCached("Barrel", "Crate");

            if (norm.Contains("slab") || norm.Contains("grave") || norm.Contains("tomb") || norm.Contains("plate"))
                return GetCached("StoneSlab", "RuneStone_2");

            if (norm.Contains("clock") || norm.Contains("timer") || norm.Contains("hourglass"))
                return GetCached("Hourglass", "RuneStone_1");

            if (norm.Contains("gate") || norm.Contains("door") || norm.Contains("arch"))
                return GetCached("Gate", "Pillar");

            if (norm.Contains("floor") || norm.Contains("stone_floor"))
                return GetCached("Floor_Stone", "Platform_Wood");

            if (norm.Contains("table") || norm.Contains("desk"))
                return GetCached("Table", "Platform_Wood");

            if (norm.Contains("platform") || norm.Contains("dais"))
                return GetCached("Platform_Wood", "Floor_Stone");

            if (norm.Contains("fire") || norm.Contains("torch") || norm.Contains("flame"))
                return GetCached("TorchFire", "Candle");

            if (norm.Contains("candle"))
                return GetCached("Candle", "TorchFire");

            // Default to rotating stylized rune stones
            return GetDefaultRuneStone(0);
        }

        /// <summary>
        /// Gets an interactive element prefab corresponding to mechanism and index (defaults to Dungeon theme).
        /// </summary>
        public static GameObject GetElementPrefab(PuzzleMechanismType mechanism, int index, string semanticType = null)
        {
            return GetElementPrefab(mechanism, EnvironmentTheme.Dungeon, index, semanticType);
        }

        /// <summary>
        /// Gets an interactive element prefab corresponding to the mechanism type, theme, and element index.
        /// Cycles through variations to ensure visual richness and direct contextual relevance.
        /// </summary>
        public static GameObject GetElementPrefab(PuzzleMechanismType mechanism, EnvironmentTheme theme, int index, string semanticType = null)
        {
            InitializeLibrary();

            // 1. Explicit semantic match if provided
            if (!string.IsNullOrEmpty(semanticType))
            {
                // In StoneMatrixPlatform, ensure every monolith is an upright standing rune stone, never a giant column or flat slab
                if (mechanism == PuzzleMechanismType.StoneMatrixPlatform)
                {
                    if (semanticType.Equals("Column_Stone", StringComparison.OrdinalIgnoreCase) ||
                        semanticType.Equals("RuneStone_2", StringComparison.OrdinalIgnoreCase))
                    {
                        return GetCached("RuneStone_3", "RuneStone_1");
                    }
                }

                GameObject semanticMatch = GetPrefab(semanticType);
                if (semanticMatch != null) return semanticMatch;
            }

            // 2. Thematic & Mechanism-driven asset resolution
            switch (mechanism)
            {
                case PuzzleMechanismType.StoneMatrixPlatform:
                case PuzzleMechanismType.CoreNetworkMatrix:
                case PuzzleMechanismType.PhysicalNumberAssembly:
                    // Mathematical & Numerical Matrices: Upright Carved Rune Monoliths with Glowing Inscriptions
                    string[] stonePicks = { "RuneStone_1", "RuneStone_3", "MagicRock_1", "MagicRock_4", "RuneStone_1" };
                    return GetCached(stonePicks[Mathf.Abs(index) % stonePicks.Length], "RuneStone_1");

                case PuzzleMechanismType.PillarSequenceAltar:
                    // Sequence & Order Challenges: Ancient Pillars, Pedestals with Tomes, Amphora Urns, Hourglasses
                    string[] sequencePicks = { "Pillar", "Column_Stone", "Pedestal_Book", "Amphora_Urn", "Hourglass", "MagicRock_1" };
                    return GetCached(sequencePicks[Mathf.Abs(index) % sequencePicks.Length], "Pillar");

                case PuzzleMechanismType.RotatingSymbolAltar:
                    // Pattern Recognition & Symbolic Rotation: Ancient Magic Rocks, Carved Rune Monoliths, Columns
                    string[] symbolPicks = { "MagicRock_4", "MagicRock_1", "RuneStone_3", "Column_Stone", "RuneStone_2" };
                    return GetCached(symbolPicks[Mathf.Abs(index) % symbolPicks.Length], "MagicRock_1");

                case PuzzleMechanismType.WordRunicAltar:
                case PuzzleMechanismType.WorldDialogueStructure:
                    // Knowledge, Language, Communication: Scholar Books, Lecterns, Scrolls, Ancient Jars
                    string[] knowledgePicks = { "Book_Big", "Pedestal_Book", "Book_Small_Green", "Book_Small_Red", "Amphora_Urn", "Hourglass" };
                    return GetCached(knowledgePicks[Mathf.Abs(index) % knowledgePicks.Length], "Pedestal_Book");

                case PuzzleMechanismType.DecisionPlatform:
                    // Decisions, Multiple Choice & Scenario Outcomes: Sarcophagus Slabs, Treasure Chests, Pedestals, Urns
                    string[] decisionPicks = { "Chest", "StoneSlab", "Pedestal_Book", "Amphora_Urn" };
                    return GetCached(decisionPicks[Mathf.Abs(index) % decisionPicks.Length], "StoneSlab");

                case PuzzleMechanismType.ConnectedSwitchBoard:
                    // Physical Mechanics & Switchboards: Blacksmith Anvil, Crates, Barrels, Floor Urns
                    string[] switchPicks = { "Anvil", "Crate", "Barrel", "Hourglass", "StoneSlab" };
                    return GetCached(switchPicks[Mathf.Abs(index) % switchPicks.Length], "Crate");

                case PuzzleMechanismType.MultiObjectMechanical:
                default:
                    // Alchemy & Problem Solving: Cauldrons, Cooking Pots, Emerald/Ruby Gems, Alchemical Bottles
                    if (theme == EnvironmentTheme.Alchemy)
                    {
                        string[] alchemyPicks = { "Cauldron", "CookingPot", "Alchemist_Bottle", "Gem_Emerald", "Gem_Ruby", "Hourglass" };
                        return GetCached(alchemyPicks[Mathf.Abs(index) % alchemyPicks.Length], "Cauldron");
                    }
                    else if (theme == EnvironmentTheme.Medieval)
                    {
                        string[] medievalPicks = { "Anvil", "Crate", "Barrel", "Chest", "Amphora_Urn" };
                        return GetCached(medievalPicks[Mathf.Abs(index) % medievalPicks.Length], "Barrel");
                    }
                    else
                    {
                        string[] defaultPicks = { "RuneStone_1", "Pillar", "Column_Stone", "StoneSlab", "MagicRock_1" };
                        return GetCached(defaultPicks[Mathf.Abs(index) % defaultPicks.Length], "RuneStone_1");
                    }
            }
        }

        /// <summary>
        /// Gets the base platform / dais prefab tailored to theme and mechanism type.
        /// </summary>
        public static GameObject GetPlatformPrefab(EnvironmentTheme theme, PuzzleMechanismType mechanism)
        {
            InitializeLibrary();

            // Word, Knowledge, or Alchemical puzzles fit beautifully on tables / study platforms
            if (mechanism == PuzzleMechanismType.WordRunicAltar ||
                mechanism == PuzzleMechanismType.WorldDialogueStructure)
            {
                if (prefabCache.TryGetValue("Table", out GameObject table))
                    return table;
            }

            // Stone Matrix Platform ALWAYS uses ancient stone dais floor tiles
            if (mechanism == PuzzleMechanismType.StoneMatrixPlatform)
            {
                if (prefabCache.TryGetValue("Floor_Stone", out GameObject stoneFloor))
                    return stoneFloor;
            }

            // Dungeon & Dark themes use ancient stone floor tiles
            if (theme == EnvironmentTheme.Dungeon || theme == EnvironmentTheme.Dark)
            {
                if (prefabCache.TryGetValue("Floor_Stone", out GameObject stoneFloor))
                    return stoneFloor;
            }

            if (prefabCache.TryGetValue("Floor_Stone", out GameObject fallbackFloor))
                return fallbackFloor;

            if (prefabCache.TryGetValue("Platform_Wood", out GameObject woodPlatform))
                return woodPlatform;

            return null;
        }

        /// <summary>
        /// Gets an atmospheric visual effect tailored to the theme (Torch Fire or Candle effect).
        /// </summary>
        public static GameObject GetAtmospherePrefab(EnvironmentTheme theme)
        {
            InitializeLibrary();

            switch (theme)
            {
                case EnvironmentTheme.Dungeon:
                case EnvironmentTheme.Dark:
                    if (prefabCache.TryGetValue("TorchFire", out GameObject torch))
                        return torch;
                    break;

                case EnvironmentTheme.Medieval:
                case EnvironmentTheme.Alchemy:
                    if (prefabCache.TryGetValue("Candle", out GameObject candle))
                        return candle;
                    if (prefabCache.TryGetValue("TorchFire", out GameObject fallbackTorch))
                        return fallbackTorch;
                    break;
            }

            // Default fallback
            return GetCached("TorchFire", "Candle");
        }

        private static GameObject GetDefaultRuneStone(int index)
        {
            string[] variations = { "RuneStone_1", "RuneStone_2", "RuneStone_3", "MagicRock_1", "MagicRock_4" };
            string chosen = variations[Mathf.Abs(index) % variations.Length];
            return GetCached(chosen, "RuneStone_1");
        }

        private static GameObject GetCached(string primary, string fallback)
        {
            if (prefabCache.TryGetValue(primary, out GameObject prim) && prim != null)
                return prim;
            if (prefabCache.TryGetValue(fallback, out GameObject fall) && fall != null)
                return fall;

            // Any available prefab
            foreach (var kvp in prefabCache)
            {
                if (kvp.Value != null) return kvp.Value;
            }

            return null;
        }
    }
}
