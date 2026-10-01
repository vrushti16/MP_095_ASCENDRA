using UnityEngine;

public class QuestManager : MonoBehaviour
{
  public static QuestManager Instance;

  public bool questActive = false;
  public bool questCompleted = false;

  public string currentQuestId = "quest_village_basics";
  public string currentQuestName;
  public string currentObjective;

  private void Awake()
  {
    if (Instance == null)
    {
      Instance = this;
    }
    else
    {
      Destroy(gameObject);
    }
  }

  public void StartQuest(string questName, string objective, string questId = "quest_village_basics")
  {
    questActive = true;
    questCompleted = false;

    currentQuestId = string.IsNullOrEmpty(questId) ? "quest_village_basics" : questId;
    currentQuestName = questName;
    currentObjective = objective;

    Debug.Log("QUEST STARTED: " + currentQuestName + " (" + currentQuestId + ")");
    Debug.Log("OBJECTIVE: " + currentObjective);

    AscendraUnityBridge.Instance?.NotifyQuestStarted(currentQuestId);
  }

  public void UpdateObjective(string newObjective)
  {
    currentObjective = newObjective;

    Debug.Log("NEW OBJECTIVE: " + currentObjective);
    AscendraUnityBridge.Instance?.NotifyObjectiveUpdated(currentQuestId, newObjective);
  }

  public void CompleteQuest()
  {
    questActive = false;
    questCompleted = true;

    Debug.Log("QUEST COMPLETED: " + currentQuestName);
    AscendraUnityBridge.Instance?.NotifyQuestCompleted(currentQuestId);
  }
}

