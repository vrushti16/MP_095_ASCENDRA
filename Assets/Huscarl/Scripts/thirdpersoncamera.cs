using UnityEngine;

public class ThirdPersonCamera : MonoBehaviour
{
    [Header("Target")]
    [SerializeField] private Transform target;

    [Header("Camera")]
    [SerializeField] private float distance = 6f;
    [SerializeField] private float height = 2.5f;

    [Header("Mouse")]
    [SerializeField] private float mouseSensitivity = 5f;
    [SerializeField] private float minPitch = -15f;
    [SerializeField] private float maxPitch = 50f;

    [Header("Mouse Smoothing")]
    [SerializeField] private float mouseSmoothTime = 0.05f;

    [Header("Camera Smoothing")]
    [SerializeField] private float positionSmoothTime = 0.06f;
    [SerializeField] private float rotationSmoothSpeed = 15f;

    [Header("Zoom")]
    [SerializeField] private float zoomSpeed = 2f;
    [SerializeField] private float minDistance = 3f;
    [SerializeField] private float maxDistance = 9f;

    public Transform Target { get => target; set => target = value; }
    public float Distance { get => distance; set => distance = value; }
    public float Height { get => height; set => height = value; }
    public float MouseSensitivity { get => mouseSensitivity; set => mouseSensitivity = value; }
    public float MinPitch { get => minPitch; set => minPitch = value; }
    public float MaxPitch { get => maxPitch; set => maxPitch = value; }
    public float MouseSmoothTime { get => mouseSmoothTime; set => mouseSmoothTime = value; }
    public float PositionSmoothTime { get => positionSmoothTime; set => positionSmoothTime = value; }
    public float RotationSmoothSpeed { get => rotationSmoothSpeed; set => rotationSmoothSpeed = value; }
    public float ZoomSpeed { get => zoomSpeed; set => zoomSpeed = value; }
    public float MinDistance { get => minDistance; set => minDistance = value; }
    public float MaxDistance { get => maxDistance; set => maxDistance = value; }

    private float targetYaw;
    private float targetPitch;

    private float currentYaw;
    private float currentPitch;

    private float yawVelocity;
    private float pitchVelocity;

    private Vector3 positionVelocity;

    private void Start()
    {
        if (target == null)
        {
            Debug.LogError("ThirdPersonCamera: Target is not assigned.");
            return;
        }

        Vector3 angles = transform.eulerAngles;

        targetYaw = angles.y;
        targetPitch = angles.x;

        currentYaw = targetYaw;
        currentPitch = targetPitch;

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    private void LateUpdate()
    {
        if (target == null)
            return;

        HandleMouse();
        HandleZoom();
        FollowTarget();
    }

    private void HandleMouse()
    {
        float mouseX = Input.GetAxis("Mouse X");
        float mouseY = Input.GetAxis("Mouse Y");

        // Add mouse movement to target rotation
        targetYaw += mouseX * mouseSensitivity;
        targetPitch -= mouseY * mouseSensitivity;

        // Limit vertical camera movement
        targetPitch = Mathf.Clamp(
            targetPitch,
            minPitch,
            maxPitch
        );

        // Smooth mouse rotation
        currentYaw = Mathf.SmoothDampAngle(
            currentYaw,
            targetYaw,
            ref yawVelocity,
            mouseSmoothTime
        );

        currentPitch = Mathf.SmoothDamp(
            currentPitch,
            targetPitch,
            ref pitchVelocity,
            mouseSmoothTime
        );
    }

    private void HandleZoom()
    {
        float scroll = Input.GetAxis("Mouse ScrollWheel");

        if (Mathf.Abs(scroll) > 0.001f)
        {
            distance -= scroll * zoomSpeed;

            distance = Mathf.Clamp(
                distance,
                minDistance,
                maxDistance
            );
        }
    }

    private void FollowTarget()
    {
        Quaternion cameraRotation = Quaternion.Euler(
            currentPitch,
            currentYaw,
            0f
        );

        Vector3 targetPosition =
            target.position +
            Vector3.up * height;

        Vector3 desiredPosition =
            targetPosition +
            cameraRotation * Vector3.back * distance;

        // Smooth camera position
        transform.position = Vector3.SmoothDamp(
            transform.position,
            desiredPosition,
            ref positionVelocity,
            positionSmoothTime
        );

        // Look slightly above the character
        Vector3 lookPosition =
            target.position +
            Vector3.up * 1.2f;

        Quaternion desiredRotation =
            Quaternion.LookRotation(
                lookPosition - transform.position
            );

        // Smooth camera rotation
        transform.rotation = Quaternion.Slerp(
            transform.rotation,
            desiredRotation,
            rotationSmoothSpeed * Time.deltaTime
        );
    }

    private void OnDisable()
    {
        yawVelocity = 0f;
        pitchVelocity = 0f;
        positionVelocity = Vector3.zero;
    }

    private void OnApplicationFocus(bool hasFocus)
    {
        if (hasFocus && enabled)
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }
    }

    /// <summary>
    /// Enables or disables third-person camera control and manages cursor lock mode.
    /// </summary>
    public void SetCameraActive(bool active)
    {
        enabled = active;
        if (!active)
        {
            yawVelocity = 0f;
            pitchVelocity = 0f;
            positionVelocity = Vector3.zero;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }
        else
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
            SnapToTarget();
        }
    }

    /// <summary>
    /// Snaps camera immediately behind the target, resetting any interpolation velocities.
    /// </summary>
    public void SnapToTarget()
    {
        if (target == null) return;

        targetYaw = target.eulerAngles.y;
        targetPitch = 15f;
        currentYaw = targetYaw;
        currentPitch = targetPitch;
        yawVelocity = 0f;
        pitchVelocity = 0f;
        positionVelocity = Vector3.zero;

        Quaternion cameraRotation = Quaternion.Euler(currentPitch, currentYaw, 0f);
        Vector3 targetPosition = target.position + Vector3.up * height;
        transform.position = targetPosition + cameraRotation * Vector3.back * distance;

        Vector3 lookPosition = target.position + Vector3.up * 1.2f;
        transform.rotation = Quaternion.LookRotation(lookPosition - transform.position);
    }
}