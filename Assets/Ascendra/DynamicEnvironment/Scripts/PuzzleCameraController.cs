using System.Collections;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    public class PuzzleCameraController : MonoBehaviour
    {
        public static PuzzleCameraController Instance { get; private set; }

        private Camera targetCamera;
        private Vector3 savedCameraPosition;
        private Quaternion savedCameraRotation;
        private float savedFieldOfView;
        private Coroutine transitionCoroutine;

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
            if (targetCamera == null) targetCamera = Camera.main;
        }

        public void FocusOnPuzzle(PuzzleEnvironmentPlan plan, float transitionDuration = 1.0f)
        {
            if (targetCamera == null) targetCamera = Camera.main;
            if (targetCamera == null || plan == null) return;

            // Save Exploration Camera state
            savedCameraPosition = targetCamera.transform.position;
            savedCameraRotation = targetCamera.transform.rotation;
            savedFieldOfView = targetCamera.fieldOfView;

            // Deactivate ThirdPersonCamera so its LateUpdate doesn't fight the puzzle camera framing
            ThirdPersonCamera tpCam = targetCamera.GetComponent<ThirdPersonCamera>();
            if (tpCam != null)
            {
                tpCam.SetCameraActive(false);
            }

            Debug.Log($"[PuzzleCameraController] Framing camera on puzzle plan at {plan.cameraPosition}, look target {plan.cameraTarget}");

            Quaternion targetRotation = Quaternion.LookRotation(plan.cameraTarget - plan.cameraPosition);

            if (transitionCoroutine != null) StopCoroutine(transitionCoroutine);
            transitionCoroutine = StartCoroutine(AnimateCameraTransition(plan.cameraPosition, targetRotation, plan.cameraFieldOfView, transitionDuration, false));
        }

        public void RestoreExplorationCamera(float transitionDuration = 1.0f)
        {
            if (targetCamera == null) targetCamera = Camera.main;
            if (targetCamera == null) return;

            Debug.Log("[PuzzleCameraController] Restoring exploration camera state.");

            if (transitionCoroutine != null) StopCoroutine(transitionCoroutine);
            transitionCoroutine = StartCoroutine(AnimateCameraTransition(savedCameraPosition, savedCameraRotation, savedFieldOfView, transitionDuration, true));
        }

        private IEnumerator AnimateCameraTransition(Vector3 targetPos, Quaternion targetRot, float targetFov, float duration, bool restoreThirdPerson)
        {
            Vector3 startPos = targetCamera.transform.position;
            Quaternion startRot = targetCamera.transform.rotation;
            float startFov = targetCamera.fieldOfView;

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.SmoothStep(0f, 1f, elapsed / duration);

                targetCamera.transform.position = Vector3.Lerp(startPos, targetPos, t);
                targetCamera.transform.rotation = Quaternion.Slerp(startRot, targetRot, t);
                targetCamera.fieldOfView = Mathf.Lerp(startFov, targetFov, t);

                yield return null;
            }

            targetCamera.transform.position = targetPos;
            targetCamera.transform.rotation = targetRot;
            targetCamera.fieldOfView = targetFov;

            if (restoreThirdPerson)
            {
                ThirdPersonCamera tpCam = targetCamera.GetComponent<ThirdPersonCamera>();
                if (tpCam != null)
                {
                    tpCam.SetCameraActive(true);
                }
            }
        }
    }
}
