using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using Ascendra.Audio;
using Ascendra.DynamicEnvironment;

/// <summary>
/// SecondClue: Triggers the Second Static Puzzle Scene ("StaticSecondPuzzleScene").
/// Features the Symbol Alignment & Message Reconstruction mechanism (Tasks 4 & 5).
/// Can be placed in Stage_1_1_Village exploration or in dedicated gameplay sequences.
/// </summary>
public class SecondClue : MonoBehaviour
{
    public static SecondClue Instance { get; private set; }

    [Header("Clue State")]
    [SerializeField] private bool puzzleOpened = false;
    [SerializeField] private bool clueSolved = false;
    public bool allowRetriggerAfterCompletion = true;

    [Header("Scene Transition Settings")]
    [Tooltip("The dedicated second static puzzle scene name to load when triggered.")]
    public string dedicatedSceneName = "StaticSecondPuzzleScene";
    public bool loadDedicatedScene = true;
    public float sceneFadeDuration = 0.8f;

    [Header("In-World Clue UI")]
    public GameObject cluePromptUI;
    public GameObject cluePanel;
    public KeyCode interactKey = KeyCode.E;
    public bool requireInteractionKey = false;

    [Header("Static Puzzle Asset")]
    public TextAsset staticPuzzleAsset;

    private bool playerInTrigger = false;
    private GameObject detectedPlayer = null;

    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
        }
    }

    private void Start()
    {
        if (cluePromptUI != null)
            cluePromptUI.SetActive(false);

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

    private void Update()
    {
        if (playerInTrigger && !puzzleOpened)
        {
            if (requireInteractionKey)
            {
                if (Input.GetKeyDown(interactKey))
                {
                    TriggerSecondPuzzle();
                }
            }
        }
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player"))
            return;

        if (puzzleOpened)
            return;

        if (clueSolved && !allowRetriggerAfterCompletion)
            return;

        GameObject playerObj = other.gameObject;
        CharacterController cc = playerObj.GetComponent<CharacterController>() ?? playerObj.GetComponentInParent<CharacterController>();
        if (cc != null)
        {
            playerObj = cc.gameObject;
        }

        detectedPlayer = playerObj;
        playerInTrigger = true;

        if (cluePromptUI != null)
            cluePromptUI.SetActive(true);

        Debug.Log("[ASCENDRA SECOND CLUE] Player reached Second Clue trigger!");

        if (!requireInteractionKey)
        {
            TriggerSecondPuzzle();
        }
    }

    private void OnTriggerExit(Collider other)
    {
        if (!other.CompareTag("Player"))
            return;

        playerInTrigger = false;
        if (cluePromptUI != null)
            cluePromptUI.SetActive(false);
    }

    /// <summary>
    /// Executes the second clue opening and loads the second static puzzle scene.
    /// </summary>
    public void TriggerSecondPuzzle()
    {
        if (puzzleOpened) return;
        puzzleOpened = true;

        if (cluePromptUI != null)
            cluePromptUI.SetActive(false);

        // Update Quest Manager
        if (QuestManager.Instance != null)
        {
            QuestManager.Instance.UpdateObjective("Inspect the Ancient Celestial Dial at the Sanctuary");
        }

        Debug.Log($"[ASCENDRA SECOND CLUE] Opening Second Static Puzzle Scene: '{dedicatedSceneName}'...");

        if (loadDedicatedScene)
        {
            StartCoroutine(TransitionToDedicatedScene());
        }
        else
        {
            StartEncounterFromStaticJson();
        }
    }

    private IEnumerator TransitionToDedicatedScene()
    {
        // Play mystic activation audio
        if (PuzzleAudioSynthesizer.Instance != null)
        {
            PuzzleAudioSynthesizer.Instance.PlayStoneRotate();
        }

        // Screen fade if available
        PuzzleScreenFader fader = PuzzleScreenFader.GetOrCreate();
        if (fader != null)
        {
            yield return fader.FadeOut(sceneFadeDuration);
        }
        else
        {
            yield return new WaitForSeconds(0.3f);
        }

        // Load dedicated scene
        SceneManager.LoadScene(dedicatedSceneName);
    }

    private void StartEncounterFromStaticJson()
    {
        string jsonContent = GetStaticPuzzleJson();
        Vector3? playerPos = detectedPlayer != null ? (Vector3?)detectedPlayer.transform.position : null;
        Quaternion? playerRot = detectedPlayer != null ? (Quaternion?)detectedPlayer.transform.rotation : null;

        PuzzleEncounterManager encounterMgr = PuzzleEncounterManager.Instance;
        if (encounterMgr == null)
        {
            GameObject mgrObj = new GameObject("PuzzleEncounterManager");
            encounterMgr = mgrObj.AddComponent<PuzzleEncounterManager>();
        }

        encounterMgr.StartEncounter(jsonContent, detectedPlayer, playerPos, playerRot);
    }

    public string GetStaticPuzzleJson()
    {
        if (staticPuzzleAsset != null && !string.IsNullOrEmpty(staticPuzzleAsset.text))
            return staticPuzzleAsset.text;

        TextAsset loaded = Resources.Load<TextAsset>("Puzzles/static_symbol_puzzle");
        if (loaded != null && !string.IsNullOrEmpty(loaded.text))
            return loaded.text;

        // Fallback default JSON
        return @"{
            ""puzzleId"": ""PZ-SANCTUARY-002"",
            ""title"": ""Celestial Symbol Dial of the Ancient Sanctuary"",
            ""category"": ""pattern_recognition"",
            ""puzzleType"": ""symbol_alignment"",
            ""answer"": ""Square""
        }";
    }

    private void OnPuzzleSolvedEvent(string puzzleId)
    {
        if (puzzleId == "PZ-SANCTUARY-002" || puzzleId.Contains("SANCTUARY") || puzzleId.Contains("SYMBOL"))
        {
            PuzzleSolved();
        }
    }

    public void PuzzleSolved()
    {
        if (clueSolved) return;
        clueSolved = true;

        Debug.Log("[ASCENDRA SECOND CLUE] Second Puzzle Solved! Updating quest and sanctuary status...");

        if (cluePanel != null)
            cluePanel.SetActive(true);

        if (QuestManager.Instance != null)
        {
            QuestManager.Instance.UpdateObjective("Celestial Sanctuary Unlocked! Follow the path to the High Tower.");
        }

        if (PuzzleAudioSynthesizer.Instance != null)
        {
            PuzzleAudioSynthesizer.Instance.PlayVictoryFanfare();
        }
    }

    public void ResetClueState()
    {
        puzzleOpened = false;
        clueSolved = false;
        if (cluePanel != null) cluePanel.SetActive(false);
        if (cluePromptUI != null) cluePromptUI.SetActive(false);
    }
}
