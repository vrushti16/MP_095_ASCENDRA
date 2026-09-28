using UnityEngine;

namespace Ascendra.Audio
{
    /// <summary>
    /// Helper component to trigger background music state changes via Trigger colliders or UnityEvents.
    /// Example: Attach to a Puzzle Zone collider to switch background music to MusicState.Puzzle.
    /// </summary>
    public class MusicStateTrigger : MonoBehaviour
    {
        [Header("Target Music State")]
        [SerializeField] private MusicState targetState = MusicState.Puzzle;

        [Header("Trigger Options")]
        [SerializeField, Tooltip("If true, automatically triggers when Player enters collider.")]
        private bool triggerOnPlayerEnter = true;

        [SerializeField, Tooltip("Tag used to identify the Player.")]
        private string playerTag = "Player";

        [SerializeField, Tooltip("Fade transition duration in seconds.")]
        private float fadeDuration = 2.0f;

        [SerializeField, Tooltip("If true, reverts to Exploration music state when player leaves collider.")]
        private bool revertOnPlayerExit = false;

        private void OnTriggerEnter(Collider other)
        {
            if (triggerOnPlayerEnter && other.CompareTag(playerTag))
            {
                TriggerState();
            }
        }

        private void OnTriggerExit(Collider other)
        {
            if (revertOnPlayerExit && other.CompareTag(playerTag))
            {
                if (BackgroundMusicManager.Instance != null)
                {
                    BackgroundMusicManager.Instance.SetState(MusicState.Exploration, fadeDuration);
                }
            }
        }

        /// <summary>
        /// Public method that can be invoked manually or via UnityEvent / button clicks.
        /// </summary>
        public void TriggerState()
        {
            if (BackgroundMusicManager.Instance != null)
            {
                BackgroundMusicManager.Instance.SetState(targetState, fadeDuration);
            }
            else
            {
                Debug.LogWarning("[ASCENDRA Audio] MusicStateTrigger called, but BackgroundMusicManager.Instance is null.");
            }
        }
    }
}
