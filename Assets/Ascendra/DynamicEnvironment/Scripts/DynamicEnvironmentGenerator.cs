using System.Collections.Generic;
using UnityEngine;
using Ascendra.DynamicEnvironment;

public class DynamicEnvironmentGenerator : MonoBehaviour
{
    public static DynamicEnvironmentGenerator Instance { get; private set; }

    [Header("Environment Assets")]
    [SerializeField]
    private List<EnvironmentAssetDefinition> environmentAssets =
        new List<EnvironmentAssetDefinition>();

    [Header("Generation Root & Origin")]
    [SerializeField]
    private Transform environmentRoot;

    [SerializeField]
    private Vector3 generationOrigin = Vector3.zero;

    [Header("Test Settings")]
    [SerializeField]
    private int wallCount = 8;

    [SerializeField]
    private int propCount = 6;

    private readonly List<GameObject> spawnedObjects =
        new List<GameObject>();

    private PuzzleData activePuzzleData;
    private PuzzleEnvironmentPlan activePlan;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;

        if (environmentRoot == null)
        {
            GameObject root = GameObject.Find("GeneratedEnvironment");
            if (root == null)
            {
                root = new GameObject("GeneratedEnvironment");
                root.transform.SetParent(transform, false);
            }
            environmentRoot = root.transform;
        }
    }

    /// <summary>
    /// Generates a dynamic 3D puzzle environment from raw AI JSON.
    /// </summary>
    public void GenerateFromPuzzleJson(string json)
    {
        PuzzleData data = PuzzleData.ParseJson(json);
        GenerateFromPuzzle(data);
    }

    /// <summary>
    /// Generates a dynamic 3D puzzle environment from a parsed PuzzleData object.
    /// </summary>
    public void GenerateFromPuzzle(PuzzleData puzzleData)
    {
        ClearGeneratedEnvironment();

        if (puzzleData == null)
        {
            Debug.LogError("[ASCENDRA PUZZLE] Null PuzzleData provided.");
            return;
        }

        activePuzzleData = puzzleData;
        PuzzleEventBus.TriggerPuzzleReceived(activePuzzleData);

        // 1. Plan Environment using Planner
        activePlan = PuzzleEnvironmentPlanner.CreatePlan(activePuzzleData, generationOrigin);
        PuzzleEventBus.TriggerPuzzleEnvironmentGenerating(activePlan);

        // 2. Build 3D GameObjects using Spawner
        List<GameObject> spawned = PuzzleElementSpawner.SpawnPuzzleEnvironment(activePlan, environmentRoot);
        if (spawned != null)
        {
            spawnedObjects.AddRange(spawned);
        }

        // 3. Adapt Camera & Enable Interaction
        if (PuzzleCameraController.Instance != null)
        {
            PuzzleCameraController.Instance.FocusOnPuzzle(activePlan);
        }

        if (PuzzleInteractionBinder.Instance != null)
        {
            PuzzleInteractionBinder.Instance.EnableInteraction(true);
        }

        PuzzleEventBus.TriggerPuzzleEnvironmentReady(activePlan);

        // 4. Output Development Debug Logging per Specification
        PrintDebugReport();
    }

    /// <summary>
    /// Destroys all generated environment objects for the active puzzle instance.
    /// </summary>
    public void ClearGeneratedEnvironment()
    {
        ClearEnvironment();
        activePuzzleData = null;
        activePlan = null;
        PuzzleEventBus.TriggerPuzzleEnvironmentDestroyed();
    }

    public void ClearEnvironment()
    {
        for (int i = spawnedObjects.Count - 1; i >= 0; i--)
        {
            if (spawnedObjects[i] != null)
            {
#if UNITY_EDITOR
                if (!Application.isPlaying)
                    DestroyImmediate(spawnedObjects[i]);
                else
                    Destroy(spawnedObjects[i]);
#else
                Destroy(spawnedObjects[i]);
#endif
            }
        }

        spawnedObjects.Clear();
    }

    private void PrintDebugReport()
    {
        if (activePuzzleData == null || activePlan == null) return;

        Debug.Log($"[ASCENDRA PUZZLE]\n" +
                  $"ID: {activePuzzleData.puzzleId}\n" +
                  $"Type: {activePuzzleData.puzzleType}\n" +
                  $"Theme: {activePuzzleData.theme}\n" +
                  $"Grid: {activePlan.gridRows}x{activePlan.gridColumns}\n" +
                  $"Elements: {activePlan.interactiveElementCount}\n" +
                  $"Environment: {activePlan.mechanismType}\n" +
                  $"Objects Spawned: {spawnedObjects.Count}");
    }

    public void GenerateEnvironment()
    {
        ClearEnvironment();

        if (environmentRoot == null)
        {
            Debug.LogError("[DynamicEnvironment] Environment Root is not assigned.");
            return;
        }

        if (environmentAssets == null || environmentAssets.Count == 0)
        {
            Debug.LogWarning("[DynamicEnvironment] No environment assets assigned.");
            return;
        }

        SpawnFloor();
        SpawnWalls();
        SpawnProps();

        Debug.Log($"[DynamicEnvironment] Generated environment with {spawnedObjects.Count} objects.");
    }

    private void SpawnFloor()
    {
        EnvironmentAssetDefinition floor = FindAsset(AssetCategory.Floor);
        if (floor == null || floor.prefab == null) return;
        SpawnAsset(floor, generationOrigin, Quaternion.identity);
    }

    private void SpawnWalls()
    {
        EnvironmentAssetDefinition wall = FindAsset(AssetCategory.Wall);
        if (wall == null || wall.prefab == null) return;

        for (int i = 0; i < wallCount; i++)
        {
            float angle = i * (360f / wallCount);
            float radius = 6f;
            Vector3 position = generationOrigin + new Vector3(
                Mathf.Cos(angle * Mathf.Deg2Rad) * radius,
                0f,
                Mathf.Sin(angle * Mathf.Deg2Rad) * radius
            );
            Quaternion rotation = Quaternion.Euler(0f, -angle, 0f);
            SpawnAsset(wall, position, rotation);
        }
    }

    private void SpawnProps()
    {
        EnvironmentAssetDefinition prop = FindAsset(AssetCategory.Prop);
        if (prop == null || prop.prefab == null) return;

        for (int i = 0; i < propCount; i++)
        {
            Vector3 position = generationOrigin + new Vector3(
                Random.Range(-4f, 4f),
                0f,
                Random.Range(-4f, 4f)
            );
            SpawnAsset(prop, position, Quaternion.Euler(0f, Random.Range(0f, 360f), 0f));
        }
    }

    private EnvironmentAssetDefinition FindAsset(AssetCategory category)
    {
        foreach (EnvironmentAssetDefinition asset in environmentAssets)
        {
            if (asset == null) continue;
            if (asset.category == category) return asset;
        }
        return null;
    }

    private void SpawnAsset(EnvironmentAssetDefinition asset, Vector3 position, Quaternion rotation)
    {
        if (asset == null || asset.prefab == null) return;

        GameObject instance = Instantiate(asset.prefab, position, rotation, environmentRoot);
        instance.name = $"{asset.displayName}_Generated";
        spawnedObjects.Add(instance);
    }
}
