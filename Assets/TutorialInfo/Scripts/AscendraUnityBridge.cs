using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public class AscendraUnityBridge : MonoBehaviour
{
    public static AscendraUnityBridge Instance { get; private set; }

    [Header("Backend Synchronization Settings")]
    [SerializeField] private string backendApiUrl = "http://localhost:5000/api/v1";
    [SerializeField] private string playerToken = "";

    public static event Action<string> OnQuestStarted;
    public static event Action<string> OnClueDiscovered;
    public static event Action<string> OnPuzzleSolved;
    public static event Action<string> OnQuestCompleted;

    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
            return;
        }

        if (string.IsNullOrEmpty(playerToken))
        {
            playerToken = PlayerPrefs.GetString("ASCENDRA_AUTH_TOKEN", "");
        }
    }

    /// <summary>
    /// Invoked from WebGL JS or external auth flow to bind player session
    /// </summary>
    public void SetPlayerToken(string token)
    {
        playerToken = token;
        PlayerPrefs.SetString("ASCENDRA_AUTH_TOKEN", token);
        PlayerPrefs.Save();
        Debug.Log("[AscendraUnityBridge] Auth token set for active Unity session.");
    }

    public void NotifyQuestStarted(string questId)
    {
        Debug.Log($"[AscendraUnityBridge] Quest Started: {questId}");
        OnQuestStarted?.Invoke(questId);
        DispatchEventToWebClient("QUEST_STARTED", questId);
        StartCoroutine(SendHttpQuestAction(questId, "start"));
    }

    public void NotifyClueDiscovered(string clueId)
    {
        Debug.Log($"[AscendraUnityBridge] Clue Discovered: {clueId}");
        OnClueDiscovered?.Invoke(clueId);
        DispatchEventToWebClient("CLUE_DISCOVERED", clueId);
        string eventId = Guid.NewGuid().ToString();
        string json = "{\"eventId\":\"" + eventId + "\",\"eventType\":\"UNITY_INSCRIPTION_DISCOVERED\",\"payload\":{\"clueId\":\"" + clueId + "\"}}";
        StartCoroutine(SendHttpGameplayEvent(json));
    }

    public void NotifyObjectiveUpdated(string questId, string objective)
    {
        Debug.Log($"[AscendraUnityBridge] Objective Updated: {questId} - {objective}");
        DispatchEventToWebClient("PUZZLE_SOLVED", questId);
    }

    public void NotifyPuzzleSolved(string puzzleId, string answer = "36")
    {
        Debug.Log($"[AscendraUnityBridge] Dynamic Puzzle Solved: {puzzleId}");
        OnPuzzleSolved?.Invoke(puzzleId);
        DispatchEventToWebClient("PUZZLE_SOLVED", puzzleId);
        string eventId = Guid.NewGuid().ToString();
        string json = "{\"eventId\":\"" + eventId + "\",\"eventType\":\"UNITY_DYNAMIC_PUZZLE_COMPLETED\",\"payload\":{\"puzzleId\":\"" + puzzleId + "\",\"answer\":\"" + answer + "\"}}";
        StartCoroutine(SendHttpGameplayEvent(json));
    }

    public void NotifyQuestCompleted(string questId)
    {
        Debug.Log($"[AscendraUnityBridge] Quest Completed: {questId}");
        OnQuestCompleted?.Invoke(questId);
        DispatchEventToWebClient("QUEST_COMPLETED", questId);
        StartCoroutine(SendHttpQuestAction(questId, "complete"));
    }

    private void DispatchEventToWebClient(string action, string payload)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            string js = $"if (typeof window !== 'undefined') {{ if (window.AscendraUnityBridge) {{ window.AscendraUnityBridge.onUnityEvent('{action}', '{payload}'); }} if (window.parent && window.parent.AscendraUnityBridge) {{ window.parent.AscendraUnityBridge.onUnityEvent('{action}', '{payload}'); }} }}";
            Application.ExternalEval(js);
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[AscendraUnityBridge] WebGL dispatch error: {e.Message}");
        }
#else
        Debug.Log($"[AscendraUnityBridge] Unity Event Emitted -> Action: {action}, Payload: {payload}");
#endif
    }

    private IEnumerator SendHttpGameplayEvent(string jsonPayload)
    {
        if (string.IsNullOrEmpty(playerToken))
            yield break;

        string url = $"{backendApiUrl}/game-events";
        using (UnityWebRequest req = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonPayload);
            req.uploadHandler = new UploadHandlerRaw(bodyRaw);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Authorization", $"Bearer {playerToken}");
            req.SetRequestHeader("Content-Type", "application/json");
            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"[AscendraUnityBridge] Gameplay event accepted by authoritative server: {req.downloadHandler.text}");
            }
            else
            {
                Debug.LogWarning($"[AscendraUnityBridge] Event delivery error ({req.responseCode}): {req.error}");
            }
        }
    }

    private IEnumerator SendHttpQuestAction(string questId, string action)
    {
        if (string.IsNullOrEmpty(playerToken))
            yield break;

        string url = $"{backendApiUrl}/quests/{questId}/{action}";
        using (UnityWebRequest req = UnityWebRequest.PostWwwForm(url, ""))
        {
            req.SetRequestHeader("Authorization", $"Bearer {playerToken}");
            req.SetRequestHeader("Content-Type", "application/json");
            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"[AscendraUnityBridge] Quest {questId} {action} posted successfully to backend.");
            }
        }
    }
}
