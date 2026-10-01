using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using Ascendra.Audio;
using Ascendra.DynamicEnvironment;

/// <summary>
/// ThirdClue: Triggers the Third Static Puzzle Scene ("StaticThirdPuzzleScene").
/// Features Task 5: Message Reconstruction Puzzle (English / Communication).
/// In this puzzle, players reconstruct the message fragments "come to the tower at sunset"
/// in the correct order on the ancient celestial altar to activate the magic crystal.
/// </summary>
public class ThirdClue : MonoBehaviour
{
    public static ThirdClue Instance { get; private set; }

    [Header("Clue State")]
    [SerializeField] private bool puzzleOpened = false;
    [SerializeField] private bool clueSolved = false;
    public bool allowRetriggerAfterCompletion = true;

    [Header("Scene Transition Settings")]
    [Tooltip("The dedicated third static puzzle scene name to load when triggered.")]
    public string dedicatedSceneName = "StaticThirdPuzzleScene";
    public bool loadDedicatedScene = true;
    public float sceneFadeDuration = 0.8f;

    [Header("In-World Clue UI")]
    public GameObject cluePromptUI;
    public GameObject cluePanel;
    public KeyCode interactKey = KeyCode.E;
    public bool requireInteractionKey = false;

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
                    TriggerThirdPuzzle();
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

        Debug.Log("[ASCENDRA THIRD CLUE] Player reached Third Clue trigger!");

        if (!requireInteractionKey)
        {
            TriggerThirdPuzzle();
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
    /// Executes the third clue opening and loads the third static puzzle scene.
    /// </summary>
    public void TriggerThirdPuzzle()
    {
        if (puzzleOpened) return;
        puzzleOpened = true;

        if (cluePromptUI != null)
            cluePromptUI.SetActive(false);

        // Update Quest Manager
        if (QuestManager.Instance != null)
        {
            QuestManager.Instance.UpdateObjective("Inspect the Floating Celestial Altar and Reconstruct the Ancient Message");
        }

        Debug.Log($"[ASCENDRA THIRD CLUE] Opening Third Static Puzzle Scene: '{dedicatedSceneName}'...");

        if (loadDedicatedScene)
        {
            StartCoroutine(TransitionToDedicatedScene());
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

    private void OnPuzzleSolvedEvent(string puzzleId)
    {
        if (clueSolved) return;
        if (puzzleId == "PZ-TASK5-MESSAGE-001" || puzzleId.Contains("MESSAGE") || puzzleId.Contains("TASK5"))
        {
            PuzzleSolved();
        }
    }

    public void PuzzleSolved()
    {
        if (clueSolved) return;
        clueSolved = true;

        Debug.Log("[ASCENDRA THIRD CLUE] Third Puzzle Solved! Message reconstructed successfully.");

        if (cluePanel != null)
            cluePanel.SetActive(true);

        if (QuestManager.Instance != null)
        {
            QuestManager.Instance.UpdateObjective("Deciphered Message: 'Come to the tower at sunset'. Proceed to the Tower.");
        }
    }

    public void ResetClueTrigger()
    {
        puzzleOpened = false;
        clueSolved = false;
        if (cluePanel != null)
            cluePanel.SetActive(false);
    }
}
