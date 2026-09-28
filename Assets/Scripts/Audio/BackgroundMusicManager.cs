using System.Collections;
using UnityEngine;
using UnityEngine.Audio;
using UnityEngine.SceneManagement;

namespace Ascendra.Audio
{
    /// <summary>
    /// Enum representing the various gameplay music states in ASCENDRA.
    /// </summary>
    public enum MusicState
    {
        MainMenu,
        Exploration,
        Puzzle,
        Boss,
        Victory
    }

    /// <summary>
    /// Singleton Background Music Manager for ASCENDRA.
    /// Plays 2D ambient background music continuously across scene loads, UI panels, dialogues, and puzzles.
    /// Supports volume persistence (PlayerPrefs), smooth fading, and optional AudioMixer routing.
    /// WebGL Compatible.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class BackgroundMusicManager : MonoBehaviour
    {
        public static BackgroundMusicManager Instance { get; private set; }

        private const string VOLUME_PREF_KEY = "ASCENDRA_MUSIC_VOLUME";

        [Header("Audio Settings")]
        [SerializeField, Range(0f, 1f)]
        private float musicVolume = 0.5f;

        [SerializeField, Tooltip("Fade in duration when starting or changing tracks (in seconds).")]
        private float fadeInDuration = 2.0f;

        [SerializeField, Tooltip("Fade out duration when stopping or changing tracks (in seconds).")]
        private float fadeOutDuration = 2.0f;

        [SerializeField, Tooltip("Optional AudioMixerGroup for routing music audio output.")]
        private AudioMixerGroup audioMixerGroup;

        [Header("Default Music Clips")]
        [SerializeField] private AudioClip explorationClip;
        [SerializeField] private AudioClip puzzleClip;
        [SerializeField] private AudioClip bossClip;
        [SerializeField] private AudioClip victoryClip;
        [SerializeField] private AudioClip mainMenuClip;

        [Header("Auto Start")]
        [SerializeField, Tooltip("Automatically start playing exploration music when game starts if a clip is assigned.")]
        private bool autoStartExploration = true;

        private AudioSource audioSource;
        private Coroutine fadeCoroutine;
        private MusicState currentState = MusicState.Exploration;

        public float MusicVolume
        {
            get => musicVolume;
            set => SetVolume(value);
        }

        public float FadeInDuration => fadeInDuration;
        public float FadeOutDuration => fadeOutDuration;
        public MusicState CurrentState => currentState;
        public AudioSource Source => audioSource;

        private void Awake()
        {
            // Enforce Singleton Pattern
            if (Instance != null && Instance != this)
            {
                Debug.Log("[ASCENDRA Audio] Duplicate Music Manager detected. Destroying duplicate instance.");
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            // Configure AudioSource for 2D Continuous Music
            audioSource = GetComponent<AudioSource>();
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
            }

            audioSource.playOnAwake = false;
            audioSource.loop = true;
            audioSource.spatialBlend = 0f; // 2D Background Audio

            if (audioMixerGroup != null)
            {
                audioSource.outputAudioMixerGroup = audioMixerGroup;
            }

            // Load Saved Volume Preference
            LoadVolume();

            Debug.Log("[ASCENDRA Audio] Music Manager initialized successfully.");
        }

        private void OnEnable()
        {
            SceneManager.sceneLoaded += OnSceneLoaded;
        }

        private void OnDisable()
        {
            SceneManager.sceneLoaded -= OnSceneLoaded;
        }

        private void Start()
        {
            if (autoStartExploration && !audioSource.isPlaying && explorationClip != null)
            {
                PlayMusic(explorationClip, fade: true, duration: fadeInDuration);
            }
        }

        private void OnSceneLoaded(Scene scene, LoadSceneMode mode)
        {
            Debug.Log($"[ASCENDRA Audio] Scene loaded: '{scene.name}'. Continuous music state maintained.");
        }

        #region Public Audio Control API

        /// <summary>
        /// Plays the specified AudioClip. If already playing this clip, does not restart.
        /// </summary>
        public void PlayMusic(AudioClip clip, bool fade = true, float duration = 2.0f)
        {
            if (clip == null)
            {
                Debug.LogWarning("[ASCENDRA Audio] PlayMusic called with null AudioClip.");
                return;
            }

            if (audioSource.clip == clip && audioSource.isPlaying)
            {
                Debug.Log("[ASCENDRA Audio] Music already playing. No restart required.");
                return;
            }

            Debug.Log($"[ASCENDRA Audio] Playing music track: {clip.name}");

            if (fadeCoroutine != null)
            {
                StopCoroutine(fadeCoroutine);
            }

            if (fade && duration > 0f)
            {
                fadeCoroutine = StartCoroutine(FadeInCoroutine(clip, duration));
            }
            else
            {
                audioSource.clip = clip;
                audioSource.volume = musicVolume;
                audioSource.Play();
            }
        }

        /// <summary>
        /// Stops the background music with an optional fade out.
        /// </summary>
        public void StopMusic(bool fade = true, float duration = 2.0f)
        {
            if (!audioSource.isPlaying) return;

            Debug.Log("[ASCENDRA Audio] Stopping background music.");

            if (fadeCoroutine != null)
            {
                StopCoroutine(fadeCoroutine);
            }

            if (fade && duration > 0f)
            {
                fadeCoroutine = StartCoroutine(FadeOutCoroutine(duration));
            }
            else
            {
                audioSource.Stop();
                audioSource.clip = null;
            }
        }

        /// <summary>
        /// Smoothly transitions from the currently playing clip to a new clip.
        /// </summary>
        public void ChangeMusic(AudioClip newClip, float fadeDuration = 2.0f)
        {
            if (newClip == null)
            {
                StopMusic(fade: true, duration: fadeDuration);
                return;
            }

            if (audioSource.clip == newClip && audioSource.isPlaying)
            {
                Debug.Log("[ASCENDRA Audio] Track transition skipped: clip is already playing.");
                return;
            }

            Debug.Log($"[ASCENDRA Audio] Changing music track to: {newClip.name}");

            if (fadeCoroutine != null)
            {
                StopCoroutine(fadeCoroutine);
            }

            fadeCoroutine = StartCoroutine(ChangeMusicCoroutine(newClip, fadeDuration));
        }

        /// <summary>
        /// Switches the music state and transitions music track if configured for that state.
        /// </summary>
        public void SetState(MusicState newState, float fadeDuration = 2.0f)
        {
            currentState = newState;
            AudioClip targetClip = GetClipForState(newState);

            if (targetClip != null)
            {
                ChangeMusic(targetClip, fadeDuration);
            }
        }

        /// <summary>
        /// Sets the music volume and persists it using PlayerPrefs.
        /// Range: 0.0 to 1.0.
        /// </summary>
        public void SetVolume(float volume)
        {
            musicVolume = Mathf.Clamp01(volume);
            
            if (fadeCoroutine == null)
            {
                audioSource.volume = musicVolume;
            }

            PlayerPrefs.SetFloat(VOLUME_PREF_KEY, musicVolume);
            PlayerPrefs.Save();

            Debug.Log($"[ASCENDRA Audio] Music volume set to: {musicVolume * 100:F0}%");
        }

        /// <summary>
        /// Returns the current music volume setting (0.0 to 1.0).
        /// </summary>
        public float GetVolume()
        {
            return musicVolume;
        }

        /// <summary>
        /// Fade In helper wrapper.
        /// </summary>
        public void FadeIn(float duration = 2.0f)
        {
            if (audioSource.clip == null) return;

            if (fadeCoroutine != null)
            {
                StopCoroutine(fadeCoroutine);
            }

            fadeCoroutine = StartCoroutine(FadeInCoroutine(audioSource.clip, duration));
        }

        /// <summary>
        /// Fade Out helper wrapper.
        /// </summary>
        public void FadeOut(float duration = 2.0f)
        {
            if (!audioSource.isPlaying) return;

            if (fadeCoroutine != null)
            {
                StopCoroutine(fadeCoroutine);
            }

            fadeCoroutine = StartCoroutine(FadeOutCoroutine(duration));
        }

        #endregion

        #region Internal Helper Methods & Coroutines

        private void LoadVolume()
        {
            if (PlayerPrefs.HasKey(VOLUME_PREF_KEY))
            {
                musicVolume = Mathf.Clamp01(PlayerPrefs.GetFloat(VOLUME_PREF_KEY));
            }
            else
            {
                PlayerPrefs.SetFloat(VOLUME_PREF_KEY, musicVolume);
                PlayerPrefs.Save();
            }

            audioSource.volume = musicVolume;
        }

        private AudioClip GetClipForState(MusicState state)
        {
            switch (state)
            {
                case MusicState.MainMenu:
                    return mainMenuClip;
                case MusicState.Exploration:
                    return explorationClip;
                case MusicState.Puzzle:
                    return puzzleClip;
                case MusicState.Boss:
                    return bossClip;
                case MusicState.Victory:
                    return victoryClip;
                default:
                    return null;
            }
        }

        private IEnumerator FadeInCoroutine(AudioClip clip, float duration)
        {
            audioSource.clip = clip;
            audioSource.volume = 0f;
            audioSource.Play();

            float timer = 0f;
            while (timer < duration)
            {
                timer += Time.unscaledDeltaTime;
                audioSource.volume = Mathf.Lerp(0f, musicVolume, timer / duration);
                yield return null;
            }

            audioSource.volume = musicVolume;
            fadeCoroutine = null;
        }

        private IEnumerator FadeOutCoroutine(float duration)
        {
            float startVolume = audioSource.volume;
            float timer = 0f;

            while (timer < duration)
            {
                timer += Time.unscaledDeltaTime;
                audioSource.volume = Mathf.Lerp(startVolume, 0f, timer / duration);
                yield return null;
            }

            audioSource.volume = 0f;
            audioSource.Stop();
            fadeCoroutine = null;
        }

        private IEnumerator ChangeMusicCoroutine(AudioClip newClip, float fadeDuration)
        {
            float halfDuration = fadeDuration * 0.5f;

            if (audioSource.isPlaying)
            {
                yield return FadeOutCoroutine(halfDuration);
            }

            yield return FadeInCoroutine(newClip, halfDuration);
        }

        #endregion
    }
}
