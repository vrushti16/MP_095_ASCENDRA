using UnityEngine;
using Ascendra.Audio;
using Ascendra.DynamicEnvironment;

public class FirstClue : MonoBehaviour
{
    private bool puzzleOpened = false;
    private bool clueSolved = false;

    public GameObject puzzlePanel;
    public GameObject cluePanel;

    [Header("Sample AI JSON Override (Optional)")]
    [TextArea(5, 10)]
    public string samplePuzzleJson = @"{
        ""puzzleId"": ""PZ-001"",
        ""puzzleType"": ""number_matrix"",
        ""taskType"": ""aptitude"",
        ""difficulty"": ""medium"",
        ""theme"": ""dungeon"",
        ""interactionType"": ""tile_selection"",
        ""question"": ""Complete the 3x3 Number Matrix series."",
        ""layout"": { ""rows"": 3, ""columns"": 3 },
        ""elements"": [
            { ""id"": ""t1"", ""value"": ""12"", ""type"": ""tile"" },
            { ""id"": ""t2"", ""value"": ""18"", ""type"": ""tile"" },
            { ""id"": ""t3"", ""value"": ""24"", ""type"": ""tile"" },
            { ""id"": ""t4"", ""value"": ""30"", ""type"": ""tile"" },
            { ""id"": ""t5"", ""value"": ""??"", ""type"": ""tile"" },
            { ""id"": ""t6"", ""value"": ""42"", ""type"": ""tile"" },
            { ""id"": ""t7"", ""value"": ""48"", ""type"": ""tile"" },
            { ""id"": ""t8"", ""value"": ""54"", ""type"": ""tile"" },
            { ""id"": ""t9"", ""value"": ""60"", ""type"": ""tile"" }
        ],
        ""answer"": ""??""
    }";

    private void Start()
    {
        if (puzzlePanel != null)
            puzzlePanel.SetActive(false);

        if (cluePanel != null)
            cluePanel.SetActive(false);
    }

    private void OnEnable()
    {
        PuzzleEventBus.OnPuzzleSolved += OnPuzzleSolvedEvent;
    }

    private void OnDisable()
    {
        PuzzleEventBus.OnPuzzleSolved -= OnPuzzleSolvedEvent;
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player"))
            return;

        if (puzzleOpened || clueSolved)
            return;

        puzzleOpened = true;

        Debug.Log("[ASCENDRA EXPLORATION] Player reached clue trigger point!");
        OpenPuzzle();
    }

    private void OpenPuzzle()
    {
        // Legacy UI support if panel exists
        if (puzzlePanel != null)
            puzzlePanel.SetActive(true);

        Debug.Log("[ASCENDRA PUZZLE] Triggering PuzzleEnvironmentRuntime generation from JSON...");

        if (PuzzleEnvironmentRuntime.Instance != null)
        {
            PuzzleEnvironmentRuntime.Instance.GenerateFromPuzzleJson(samplePuzzleJson);
        }
        else if (DynamicEnvironmentGenerator.Instance != null)
        {
            DynamicEnvironmentGenerator.Instance.GenerateFromPuzzleJson(samplePuzzleJson);
        }
    }

    private void OnPuzzleSolvedEvent(string puzzleId)
    {
        if (clueSolved) return;
        PuzzleSolved();
    }

    public void PuzzleSolved()
    {
        if (clueSolved) return;
        clueSolved = true;

        Debug.Log("[ASCENDRA PUZZLE] Puzzle Solved! Updating clue state...");

        if (puzzlePanel != null)
            puzzlePanel.SetActive(false);

        if (cluePanel != null)
            cluePanel.SetActive(true);

        if (QuestManager.Instance != null)
        {
            QuestManager.Instance.UpdateObjective("Follow the clue to the next location");
        }
    }
}
