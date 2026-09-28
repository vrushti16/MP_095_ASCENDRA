using UnityEngine;
using TMPro;

public class NPCInteraction : MonoBehaviour
{
  [SerializeField] private GameObject talkPrompt;
  [SerializeField] private GameObject dialoguePanel;
  [SerializeField] private TextMeshProUGUI dialogueText;
  [SerializeField] private TextMeshProUGUI continueText;

  private bool playerNearby;
  private int dialogueIndex = 0;
  private bool questGiven = false;
  private string[] dialogues =
  {
        "Village Elder: Welcome, traveler. The village has been waiting for you.",
        "The path ahead is dangerous, but knowledge will guide you.",
        "Your journey in Ascendra begins now."
    };

  private void Start()
  {
    talkPrompt.SetActive(false);
    dialoguePanel.SetActive(false);
  }

  private void Update()
  {
    if (playerNearby && Input.GetKeyDown(KeyCode.E))
    {
      if (!dialoguePanel.activeSelf)
      {
        StartDialogue();
      }
      else
      {
        NextDialogue();
      }
    }
  }

  private void StartDialogue()
  {
    dialogueIndex = 0;
    dialoguePanel.SetActive(true);
    talkPrompt.SetActive(false);

    dialogueText.text = dialogues[dialogueIndex];
    UpdateContinueText();
  }

  private void NextDialogue()
  {
    dialogueIndex++;

    if (dialogueIndex < dialogues.Length)
    {
      dialogueText.text = dialogues[dialogueIndex];
      UpdateContinueText();
    }
    else
    {
      // Close dialogue
      dialoguePanel.SetActive(false);
      talkPrompt.SetActive(true);
      dialogueIndex = 0;

      // Start the quest only once
      if (!questGiven)
      {
        QuestManager.Instance.StartQuest(
            "The Lost Knowledge Crystal",
            "Find the first clue near the village.",
            "quest_village_basics"
        );

        questGiven = true;
      }
    }
  }

  private void UpdateContinueText()
  {
    if (dialogueIndex == dialogues.Length - 1)
    {
      continueText.text = "Press E to Close";
    }
    else
    {
      continueText.text = "Press E to Continue →";
    }
  }

  private void OnTriggerEnter(Collider other)
  {
    if (other.CompareTag("Player"))
    {
      playerNearby = true;
      talkPrompt.SetActive(true);
    }
  }

  private void OnTriggerExit(Collider other)
  {
    if (other.CompareTag("Player"))
    {
      playerNearby = false;
      talkPrompt.SetActive(false);
      dialoguePanel.SetActive(false);
      dialogueIndex = 0;
    }
  }
}
