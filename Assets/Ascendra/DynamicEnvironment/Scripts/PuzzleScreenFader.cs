using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Self-contained cinematic screen fader.
    /// Provides smooth fade-to-black and fade-to-clear transitions during puzzle scene transitions.
    /// Automatically fades in upon any scene load so the screen is never trapped in black.
    /// </summary>
    public class PuzzleScreenFader : MonoBehaviour
    {
        public static PuzzleScreenFader Instance { get; private set; }

        private Canvas faderCanvas;
        private CanvasGroup canvasGroup;
        private Image blackImage;
        private Coroutine activeFadeRoutine;

        public bool IsFading => activeFadeRoutine != null;

        public static PuzzleScreenFader GetOrCreate()
        {
            if (Instance != null) return Instance;

            GameObject faderObj = new GameObject("PuzzleScreenFader");
            Instance = faderObj.AddComponent<PuzzleScreenFader>();
            DontDestroyOnLoad(faderObj);
            return Instance;
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            BuildFaderUI();
        }

        private void OnEnable()
        {
            SceneManager.sceneLoaded += HandleSceneLoaded;
        }

        private void OnDisable()
        {
            SceneManager.sceneLoaded -= HandleSceneLoaded;
        }

        private void HandleSceneLoaded(Scene scene, LoadSceneMode mode)
        {
            // Automatically clear or fade in to reveal the loaded scene
            FadeIn(0.6f);
        }

        /// <summary>
        /// Immediately clears any black overlay with 0 transition time.
        /// </summary>
        public void InstantClear()
        {
            if (activeFadeRoutine != null)
            {
                StopCoroutine(activeFadeRoutine);
                activeFadeRoutine = null;
            }
            if (canvasGroup != null)
            {
                canvasGroup.alpha = 0f;
                canvasGroup.blocksRaycasts = false;
                canvasGroup.interactable = false;
            }
        }

        private void BuildFaderUI()
        {
            faderCanvas = gameObject.AddComponent<Canvas>();
            faderCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            faderCanvas.sortingOrder = 9999; // Ensure on top of all gameplay & HUD UI

            canvasGroup = gameObject.AddComponent<CanvasGroup>();
            canvasGroup.alpha = 0f;
            canvasGroup.blocksRaycasts = false;
            canvasGroup.interactable = false;

            GameObject imageObj = new GameObject("FadeImage");
            imageObj.transform.SetParent(transform, false);

            blackImage = imageObj.AddComponent<Image>();
            blackImage.color = new Color(0.04f, 0.04f, 0.06f, 1f); // Rich deep cinematic slate/black

            RectTransform rt = imageObj.GetComponent<RectTransform>();
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.sizeDelta = Vector2.zero;
        }

        /// <summary>
        /// Fades screen to black over specified duration.
        /// </summary>
        public Coroutine FadeOut(float duration = 0.5f, Action onComplete = null)
        {
            if (!gameObject.activeInHierarchy) gameObject.SetActive(true);
            if (!gameObject.activeInHierarchy)
            {
                if (canvasGroup != null) canvasGroup.alpha = 1f;
                onComplete?.Invoke();
                return null;
            }
            if (activeFadeRoutine != null) StopCoroutine(activeFadeRoutine);
            activeFadeRoutine = StartCoroutine(AnimateFade(canvasGroup != null ? canvasGroup.alpha : 0f, 1f, duration, true, onComplete));
            return activeFadeRoutine;
        }

        /// <summary>
        /// Fades screen from black to transparent over specified duration.
        /// </summary>
        public Coroutine FadeIn(float duration = 0.5f, Action onComplete = null)
        {
            if (!gameObject.activeInHierarchy) gameObject.SetActive(true);
            if (!gameObject.activeInHierarchy)
            {
                if (canvasGroup != null) canvasGroup.alpha = 0f;
                onComplete?.Invoke();
                return null;
            }
            if (activeFadeRoutine != null) StopCoroutine(activeFadeRoutine);
            activeFadeRoutine = StartCoroutine(AnimateFade(canvasGroup != null ? canvasGroup.alpha : 1f, 0f, duration, false, onComplete));
            return activeFadeRoutine;
        }

        private IEnumerator AnimateFade(float startAlpha, float targetAlpha, float duration, bool blockRays, Action onComplete)
        {
            canvasGroup.blocksRaycasts = blockRays;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                canvasGroup.alpha = Mathf.Lerp(startAlpha, targetAlpha, Mathf.SmoothStep(0f, 1f, t));
                yield return null;
            }

            canvasGroup.alpha = targetAlpha;
            canvasGroup.blocksRaycasts = (targetAlpha > 0.01f);
            activeFadeRoutine = null;
            onComplete?.Invoke();
        }
    }
}
