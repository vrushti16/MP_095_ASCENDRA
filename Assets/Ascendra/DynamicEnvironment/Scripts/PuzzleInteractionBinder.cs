using System;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Binds physical 3D mouse interaction to puzzle elements in the dedicated puzzle scene.
    /// Provides hover detection/highlighting and direct physical manipulation on click.
    /// Completely removes any quiz UI, buttons, or cards.
    /// </summary>
    public class PuzzleInteractionBinder : MonoBehaviour
    {
        public static PuzzleInteractionBinder Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private bool enableMouseInteraction = true;
        [SerializeField] private LayerMask interactableLayer = ~0;
        [SerializeField] private float raycastMaxDistance = 100f;

        private Camera puzzleCamera;
        private bool isInteractionActive = true;
        private PuzzleElement currentHoveredElement;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            isInteractionActive = true;
            enableMouseInteraction = true;
        }

        private void Start()
        {
            ResolveCamera();
            isInteractionActive = true;
            enableMouseInteraction = true;

            // Only force cursor unlock if ThirdPersonCamera is not actively controlling the camera
            ThirdPersonCamera tpCam = (puzzleCamera != null) ? puzzleCamera.GetComponent<ThirdPersonCamera>() : null;
            if (tpCam == null || !tpCam.enabled)
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
        }

        private void ResolveCamera()
        {
            if (puzzleCamera == null) puzzleCamera = Camera.main;
        }

        public void EnableInteraction(bool enable)
        {
            isInteractionActive = enable;
            ResolveCamera();

            ThirdPersonCamera tpCam = (puzzleCamera != null) ? puzzleCamera.GetComponent<ThirdPersonCamera>() : null;
            if (enable)
            {
                if (tpCam == null || !tpCam.enabled)
                {
                    Cursor.lockState = CursorLockMode.None;
                    Cursor.visible = true;
                }
            }

            if (!enable && currentHoveredElement != null)
            {
                currentHoveredElement.SetHovered(false);
                currentHoveredElement = null;
            }

            Debug.Log($"[PuzzleInteractionBinder] 3D physical interaction active: {enable}");
        }

        private void Update()
        {
            if (!isInteractionActive || !enableMouseInteraction) return;

            // Do not raycast while choice dialog is open
            if (PuzzleChoiceDialog.Instance != null && PuzzleChoiceDialog.Instance.isOpen)
            {
                if (currentHoveredElement != null)
                {
                    currentHoveredElement.SetHovered(false);
                    currentHoveredElement = null;
                }
                return;
            }

            ResolveCamera();
            if (puzzleCamera == null) return;

            Vector3 screenPoint = (Cursor.lockState == CursorLockMode.Locked)
                ? new Vector3(Screen.width * 0.5f, Screen.height * 0.5f, 0f)
                : Input.mousePosition;

            Ray ray = puzzleCamera.ScreenPointToRay(screenPoint);
            bool hitInteractable = Physics.Raycast(ray, out RaycastHit hit, raycastMaxDistance, interactableLayer);

            PuzzleElement hitElement = null;
            if (hitInteractable)
            {
                hitElement = hit.collider.GetComponentInParent<PuzzleElement>();
            }

            // Handle Hover State Highlighting
            if (hitElement != currentHoveredElement)
            {
                if (currentHoveredElement != null)
                {
                    currentHoveredElement.SetHovered(false);
                }

                currentHoveredElement = hitElement;

                if (currentHoveredElement != null && currentHoveredElement.isInteractable)
                {
                    currentHoveredElement.SetHovered(true);
                }
            }

            // Handle Direct Physical Click Manipulation
            if (Input.GetMouseButtonDown(0))
            {
                if (currentHoveredElement != null && currentHoveredElement.isInteractable)
                {
                    currentHoveredElement.Interact();
                }
            }
        }
    }
}
