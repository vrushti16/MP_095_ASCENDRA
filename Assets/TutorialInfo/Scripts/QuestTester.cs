using UnityEngine;

public class QuestTester : MonoBehaviour
{
  void Start()
  {
    QuestManager.Instance.StartQuest(
        "The Lost Knowledge Crystal",
        "Find the first clue near the village."
    );
  }
}
