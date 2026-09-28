using UnityEngine;

public class PlayerMovement : MonoBehaviour
{
  [Header("Movement")]
  public float moveSpeed = 5f;
  public float rotationSpeed = 10f;
  public float gravity = -20f;

  [Header("References")]
  public Transform cameraTransform;

  private CharacterController controller;
  private float verticalVelocity;

  void Start()
  {
    controller = GetComponent<CharacterController>();

    if (cameraTransform == null && Camera.main != null)
    {
      cameraTransform = Camera.main.transform;
    }
  }

  void Update()
  {
    float horizontal = Input.GetAxis("Horizontal");
    float vertical = Input.GetAxis("Vertical");

    Vector3 inputDirection = new Vector3(horizontal, 0f, vertical);

    if (inputDirection.magnitude > 1f)
    {
      inputDirection.Normalize();
    }

    Vector3 movementDirection = inputDirection;

    if (cameraTransform != null)
    {
      Vector3 cameraForward = cameraTransform.forward;
      Vector3 cameraRight = cameraTransform.right;

      cameraForward.y = 0f;
      cameraRight.y = 0f;

      cameraForward.Normalize();
      cameraRight.Normalize();

      movementDirection =
          cameraForward * vertical +
          cameraRight * horizontal;

      if (movementDirection.magnitude > 1f)
      {
        movementDirection.Normalize();
      }
    }

    if (movementDirection.magnitude > 0.1f)
    {
      Quaternion targetRotation =
          Quaternion.LookRotation(movementDirection);

      transform.rotation = Quaternion.Slerp(
          transform.rotation,
          targetRotation,
          rotationSpeed * Time.deltaTime
      );
    }

    Vector3 movement =
        movementDirection * moveSpeed;

    if (controller.isGrounded)
    {
      verticalVelocity = -2f;
    }
    else
    {
      verticalVelocity += gravity * Time.deltaTime;
    }

    movement.y = verticalVelocity;

    controller.Move(movement * Time.deltaTime);
  }
}
