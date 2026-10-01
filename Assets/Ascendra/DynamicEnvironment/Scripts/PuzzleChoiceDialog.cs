using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Interactive Choice Dialog for selecting candidate answers in the 3D puzzle encounter.
    /// Replaces automatic value cycling with an explicit player selection menu.
    /// Supports mouse clicking, number keys [1]-[5], and keyboard navigation.
    /// Integrates seamlessly with ThirdPersonCamera and character controls.
    /// </summary>
    public class PuzzleChoiceDialog : MonoBehaviour
    {
        public static PuzzleChoiceDialog Instance { get; private set; }

        [Header("State")]
        public bool isOpen = false;

        private GameObject panelRoot;
        private TextMeshProUGUI titleText;
        private TextMeshProUGUI subtitleText;
        private Transform buttonsContainer;
        private List<Button> activeButtons = new List<Button>();
        private List<string> currentCandidates = new List<string>();
        private Action<string> onSelectCallback;
        private Action onCancelCallback;

        private MonoBehaviour cachedThirdPersonCam;
        private MonoBehaviour cachedPlayerMovement;

        public static PuzzleChoiceDialog GetOrCreate()
        {
            if (Instance != null) return Instance;

            GameObject existing = GameObject.Find("PuzzleChoiceDialogCanvas");
            if (existing != null)
            {
                Instance = existing.GetComponent<PuzzleChoiceDialog>();
                if (Instance != null) return Instance;
            }

            GameObject canvasObj = new GameObject("PuzzleChoiceDialogCanvas");
            Canvas canvas = canvasObj.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 300;

            CanvasScaler scaler = canvasObj.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            canvasObj.AddComponent<GraphicRaycaster>();
            Instance = canvasObj.AddComponent<PuzzleChoiceDialog>();
            Instance.BuildInterface(canvasObj.transform);

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
        }

        private void Start()
        {
            if (panelRoot == null)
            {
                BuildInterface(transform);
            }
        }

        private void BuildInterface(Transform parent)
        {
            if (panelRoot != null) return;

            // Semi-transparent backdrop / vignette
            GameObject backdrop = new GameObject("DialogBackdrop");
            backdrop.transform.SetParent(parent, false);
            RectTransform backdropRt = backdrop.AddComponent<RectTransform>();
            backdropRt.anchorMin = Vector2.zero;
            backdropRt.anchorMax = Vector2.one;
            backdropRt.offsetMin = Vector2.zero;
            backdropRt.offsetMax = Vector2.zero;
            Image backdropImg = backdrop.AddComponent<Image>();
            backdropImg.color = new Color(0.04f, 0.05f, 0.08f, 0.55f);

            // Dialog Frame Container (Center-bottom of screen)
            panelRoot = new GameObject("DialogPanel");
            panelRoot.transform.SetParent(parent, false);
            RectTransform panelRt = panelRoot.AddComponent<RectTransform>();
            panelRt.anchorMin = new Vector2(0.5f, 0.18f);
            panelRt.anchorMax = new Vector2(0.5f, 0.18f);
            panelRt.pivot = new Vector2(0.5f, 0.5f);
            panelRt.sizeDelta = new Vector2(860f, 220f);

            Image panelBg = panelRoot.AddComponent<Image>();
            panelBg.color = new Color(0.08f, 0.10f, 0.14f, 0.95f);

            // Decorative gold border outline (simulated with shadow/outline or inner panel)
            Outline outline = panelRoot.AddComponent<Outline>();
            outline.effectColor = new Color(0.85f, 0.70f, 0.25f, 0.85f);
            outline.effectDistance = new Vector2(2f, -2f);

            // Title Text
            GameObject titleObj = new GameObject("TitleText");
            titleObj.transform.SetParent(panelRoot.transform, false);
            RectTransform titleRt = titleObj.AddComponent<RectTransform>();
            titleRt.anchorMin = new Vector2(0f, 1f);
            titleRt.anchorMax = new Vector2(1f, 1f);
            titleRt.pivot = new Vector2(0.5f, 1f);
            titleRt.anchoredPosition = new Vector2(0f, -16f);
            titleRt.sizeDelta = new Vector2(800f, 38f);

            titleText = titleObj.AddComponent<TextMeshProUGUI>();
            titleText.text = "<color=#FFD54F><b>CHOOSE THE MISSING RUNE VALUE</b></color>";
            titleText.fontSize = 24f;
            titleText.alignment = TextAlignmentOptions.Center;
            titleText.fontStyle = FontStyles.Bold;

            // Subtitle Text
            GameObject subObj = new GameObject("SubtitleText");
            subObj.transform.SetParent(panelRoot.transform, false);
            RectTransform subRt = subObj.AddComponent<RectTransform>();
            subRt.anchorMin = new Vector2(0f, 1f);
            subRt.anchorMax = new Vector2(1f, 1f);
            subRt.pivot = new Vector2(0.5f, 1f);
            subRt.anchoredPosition = new Vector2(0f, -50f);
            subRt.sizeDelta = new Vector2(800f, 28f);

            subtitleText = subObj.AddComponent<TextMeshProUGUI>();
            subtitleText.text = "<color=#CFD8DC>Sequence: 12, 18, 24, 30, [ <color=#FFD54F>??</color> ], 42, 48, 54, 60  (+6 Harmonic Increment)</color>";
            subtitleText.fontSize = 16f;
            subtitleText.alignment = TextAlignmentOptions.Center;

            // Horizontal Button Container
            GameObject btnContainerObj = new GameObject("ButtonsContainer");
            btnContainerObj.transform.SetParent(panelRoot.transform, false);
            RectTransform btnRt = btnContainerObj.AddComponent<RectTransform>();
            btnRt.anchorMin = new Vector2(0.5f, 0.42f);
            btnRt.anchorMax = new Vector2(0.5f, 0.42f);
            btnRt.pivot = new Vector2(0.5f, 0.5f);
            btnRt.sizeDelta = new Vector2(780f, 75f);

            HorizontalLayoutGroup hlg = btnContainerObj.AddComponent<HorizontalLayoutGroup>();
            hlg.spacing = 20f;
            hlg.childAlignment = TextAnchor.MiddleCenter;
            hlg.childControlWidth = false;
            hlg.childControlHeight = false;
            hlg.childForceExpandWidth = false;
            hlg.childForceExpandHeight = false;

            buttonsContainer = btnContainerObj.transform;

            // Footer instructions
            GameObject footerObj = new GameObject("FooterText");
            footerObj.transform.SetParent(panelRoot.transform, false);
            RectTransform footerRt = footerObj.AddComponent<RectTransform>();
            footerRt.anchorMin = new Vector2(0f, 0f);
            footerRt.anchorMax = new Vector2(1f, 0f);
            footerRt.pivot = new Vector2(0.5f, 0f);
            footerRt.anchoredPosition = new Vector2(0f, 12f);
            footerRt.sizeDelta = new Vector2(800f, 22f);

            TextMeshProUGUI footerText = footerObj.AddComponent<TextMeshProUGUI>();
            footerText.text = "<color=#90A4AE><size=75%>Click an option or press [1]-[5] to submit answer  •  Press [ESC] to cancel</size></color>";
            footerText.fontSize = 14f;
            footerText.alignment = TextAlignmentOptions.Center;

            // Close Button [X] in top-right
            GameObject closeObj = new GameObject("CloseButton");
            closeObj.transform.SetParent(panelRoot.transform, false);
            RectTransform closeRt = closeObj.AddComponent<RectTransform>();
            closeRt.anchorMin = new Vector2(1f, 1f);
            closeRt.anchorMax = new Vector2(1f, 1f);
            closeRt.pivot = new Vector2(1f, 1f);
            closeRt.anchoredPosition = new Vector2(-12f, -12f);
            closeRt.sizeDelta = new Vector2(30f, 30f);

            Image closeImg = closeObj.AddComponent<Image>();
            closeImg.color = new Color(0.2f, 0.24f, 0.32f, 0.8f);
            Button closeBtn = closeObj.AddComponent<Button>();
            closeBtn.onClick.AddListener(Cancel);

            GameObject closeTextObj = new GameObject("Text");
            closeTextObj.transform.SetParent(closeObj.transform, false);
            TextMeshProUGUI closeText = closeTextObj.AddComponent<TextMeshProUGUI>();
            closeText.text = "×";
            closeText.fontSize = 22f;
            closeText.alignment = TextAlignmentOptions.Center;
            closeText.color = Color.white;

            panelRoot.SetActive(false);
            backdrop.SetActive(false);
        }

        public void Show(List<string> candidates, Action<string> onSelected, Action onCancelled = null)
        {
            if (panelRoot == null)
            {
                BuildInterface(transform);
            }

            currentCandidates = new List<string>(candidates);
            currentCandidates.RemoveAll(c => c == "??"); // Options are candidate numbers
            onSelectCallback = onSelected;
            onCancelCallback = onCancelled;
            isOpen = true;

            // Pause third person camera rotation while selecting
            Camera mainCam = Camera.main;
            if (mainCam != null)
            {
                cachedThirdPersonCam = mainCam.GetComponent<ThirdPersonCamera>();
                if (cachedThirdPersonCam != null) cachedThirdPersonCam.enabled = false;
            }

            // Pause player movement
            GameObject player = GameObject.FindWithTag("Player");
            if (player != null)
            {
                cachedPlayerMovement = (player.GetComponent<PlayerMovement>() ?? player.GetComponentInChildren<PlayerMovement>()) as MonoBehaviour;
                if (cachedPlayerMovement != null) cachedPlayerMovement.enabled = false;
            }

            // Unlock mouse cursor for UI selection
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;

            // Generate option buttons
            PopulateButtons();

            // Reveal dialog
            Transform backdrop = transform.Find("DialogBackdrop");
            if (backdrop != null) backdrop.gameObject.SetActive(true);
            panelRoot.SetActive(true);
        }

        private void PopulateButtons()
        {
            foreach (Transform child in buttonsContainer)
            {
                Destroy(child.gameObject);
            }
            activeButtons.Clear();

            for (int i = 0; i < currentCandidates.Count; i++)
            {
                string val = currentCandidates[i];
                int keyNum = i + 1;

                GameObject btnObj = new GameObject($"OptionBtn_{val}");
                btnObj.transform.SetParent(buttonsContainer, false);
                RectTransform btnRt = btnObj.AddComponent<RectTransform>();
                btnRt.sizeDelta = new Vector2(130f, 70f);

                Image btnImg = btnObj.AddComponent<Image>();
                btnImg.color = new Color(0.14f, 0.17f, 0.24f, 0.95f);

                Button btn = btnObj.AddComponent<Button>();
                ColorBlock colors = btn.colors;
                colors.normalColor = new Color(0.14f, 0.17f, 0.24f, 0.95f);
                colors.highlightedColor = new Color(0.24f, 0.32f, 0.46f, 1.0f);
                colors.pressedColor = new Color(0.85f, 0.70f, 0.25f, 1.0f);
                btn.colors = colors;

                Outline outline = btnObj.AddComponent<Outline>();
                outline.effectColor = new Color(0.4f, 0.5f, 0.65f, 0.5f);
                outline.effectDistance = new Vector2(1.5f, -1.5f);

                // Option Text with Shortcut Badge
                GameObject textObj = new GameObject("Text");
                textObj.transform.SetParent(btnObj.transform, false);
                RectTransform textRt = textObj.AddComponent<RectTransform>();
                textRt.anchorMin = Vector2.zero;
                textRt.anchorMax = Vector2.one;
                textRt.offsetMin = Vector2.zero;
                textRt.offsetMax = Vector2.zero;

                TextMeshProUGUI btnText = textObj.AddComponent<TextMeshProUGUI>();
                btnText.text = $"<size=65%><color=#FFD54F>[ {keyNum} ]</color></size>\n<size=120%><b>{val}</b></size>";
                btnText.fontSize = 20f;
                btnText.alignment = TextAlignmentOptions.Center;
                btnText.color = Color.white;

                string capturedVal = val;
                btn.onClick.AddListener(() => OnOptionChosen(capturedVal));

                activeButtons.Add(btn);
            }
        }

        private void Update()
        {
            if (!isOpen) return;

            // Shortcut keys 1-5
            if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1)) SelectIndex(0);
            else if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2)) SelectIndex(1);
            else if (Input.GetKeyDown(KeyCode.Alpha3) || Input.GetKeyDown(KeyCode.Keypad3)) SelectIndex(2);
            else if (Input.GetKeyDown(KeyCode.Alpha4) || Input.GetKeyDown(KeyCode.Keypad4)) SelectIndex(3);
            else if (Input.GetKeyDown(KeyCode.Alpha5) || Input.GetKeyDown(KeyCode.Keypad5)) SelectIndex(4);
            else if (Input.GetKeyDown(KeyCode.Escape)) Cancel();
        }

        private void SelectIndex(int index)
        {
            if (index >= 0 && index < currentCandidates.Count)
            {
                OnOptionChosen(currentCandidates[index]);
            }
        }

        private void OnOptionChosen(string chosenValue)
        {
            CloseDialog();
            onSelectCallback?.Invoke(chosenValue);
        }

        public void Cancel()
        {
            CloseDialog();
            onCancelCallback?.Invoke();
        }

        private void CloseDialog()
        {
            isOpen = false;

            if (panelRoot != null) panelRoot.SetActive(false);
            Transform backdrop = transform.Find("DialogBackdrop");
            if (backdrop != null) backdrop.gameObject.SetActive(false);

            // Restore mouse lock for ThirdPersonCamera
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;

            // Re-enable third person camera
            if (cachedThirdPersonCam != null)
            {
                cachedThirdPersonCam.enabled = true;
                cachedThirdPersonCam = null;
            }

            // Re-enable player movement
            if (cachedPlayerMovement != null)
            {
                cachedPlayerMovement.enabled = true;
                cachedPlayerMovement = null;
            }
        }
    }
}
