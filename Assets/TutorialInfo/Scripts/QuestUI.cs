using UnityEngine;
using TMPro;

public class ClueInteraction : MonoBehaviour
{
  [Header("Interaction UI")]
  [SerializeField] private GameObject investigatePrompt;

  [Header("Clue UI")]
  [SerializeField] private GameObject cluePanel;
  [SerializeField] private TextMeshProUGUI clueText;
  [SerializeField] private TextMeshProUGUI continueText;

  private bool playerNearby = false;
  private bool clueOpen = false;

  private void Start()
  {
    if (investigatePrompt != null)
      investigatePrompt.SetActive(false);

    if (cluePanel != null)
      cluePanel.SetActive(false);
  }

  private void Update()
  {
    if (!playerNearby)
      return;

    if (Input.GetKeyDown(KeyCode.E))
    {
      if (!clueOpen)
      {
        OpenClue();
      }
      else
      {
        CloseClue();
      }
    }
  }

  private void OpenClue()
  {
    clueOpen = true;

    if (investigatePrompt != null)
      investigatePrompt.SetActive(false);

    if (cluePanel != null)
      cluePanel.SetActive(true);

    if (clueText != null)
    {
      clueText.text =
          "An ancient symbol is carved into the old wagon.\n\n" +
          "The symbol appears to point toward the village shrine.";
    }

    if (continueText != null)
      continueText.text = "Press E to Close";

    AscendraUnityBridge.Instance?.NotifyClueDiscovered("clue_village_inscription_1");
  }

  private void CloseClue()
  {
    clueOpen = false;

    if (cluePanel != null)
      cluePanel.SetActive(false);

    if (investigatePrompt != null)
      investigatePrompt.SetActive(true);
  }

  private void OnTriggerEnter(Collider other)
  {
    if (other.CompareTag("Player"))
    {
      playerNearby = true;

      if (!clueOpen && investigatePrompt != null)
        investigatePrompt.SetActive(true);
    }
  }

  private void OnTriggerExit(Collider other)
  {
    if (other.CompareTag("Player"))
    {
      playerNearby = false;

      if (investigatePrompt != null)
        investigatePrompt.SetActive(false);

      if (cluePanel != null)
        cluePanel.SetActive(false);

      clueOpen = false;
    }
  }
}
