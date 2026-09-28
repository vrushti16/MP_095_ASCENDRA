using UnityEngine;

public class QuestManager : MonoBehaviour
{
  public static QuestManager Instance;

  public bool questActive = false;
  public bool questCompleted = false;

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

  public void StartQuest(string questName, string objective)
  {
    questActive = true;
    questCompleted = false;

    currentQuestName = questName;
    currentObjective = objective;

    Debug.Log("QUEST STARTED: " + currentQuestName);
    Debug.Log("OBJECTIVE: " + currentObjective);
  }

  public void UpdateObjective(string newObjective)
  {
    currentObjective = newObjective;

    Debug.Log("NEW OBJECTIVE: " + currentObjective);
  }

  public void CompleteQuest()
  {
    questActive = false;
    questCompleted = true;

    Debug.Log("QUEST COMPLETED: " + currentQuestName);
  }
}
