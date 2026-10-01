using UnityEngine;

namespace Ascendra.Core
{
    /// <summary>
    /// Prevents the Unity WebGL internal Development Console GUI from popping up
    /// over the active game view on non-fatal warnings or unregistered engine messages.
    /// </summary>
    public static class DisableDevConsole
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void SuppressConsole()
        {
            Debug.developerConsoleVisible = false;
            Application.logMessageReceived += HandleLog;
        }

        private static void HandleLog(string logString, string stackTrace, LogType type)
        {
            if (Debug.developerConsoleVisible)
            {
                Debug.developerConsoleVisible = false;
            }
        }
    }
}
