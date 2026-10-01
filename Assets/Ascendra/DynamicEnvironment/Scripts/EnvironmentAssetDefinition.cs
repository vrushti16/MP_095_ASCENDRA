using UnityEngine;

[CreateAssetMenu(
    fileName = "EnvironmentAsset",
    menuName = "Ascendra/Dynamic Environment/Asset Definition"
)]
public class EnvironmentAssetDefinition : ScriptableObject
{
    [Header("Identity")]
    public string assetId;
    public string displayName;

    [Header("Prefab")]
    public GameObject prefab;

    [Header("Classification")]
    public AssetCategory category;
    public EnvironmentTheme theme;

    [Header("Mechanism Classification (Optional)")]
    public string mechanismTags;
    public string supportedPuzzleTypes;
    public bool isPuzzleMechanismAsset = false;
    public bool isEnvironmentAsset = true;

    [Header("Spawn Settings")]
    public bool canRotate = true;
    public bool canScale = false;
    public bool canRandomizePosition = true;
}

public enum AssetCategory
{
    Floor,
    Wall,
    Structure,
    Decoration,
    Prop,
    Lighting,
    Interactive,
    Puzzle
}

public enum EnvironmentTheme
{
    Dungeon,
    Dark,
    Medieval,
    Alchemy
}
