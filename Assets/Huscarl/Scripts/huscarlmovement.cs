using UnityEngine;

public class HuscarMovement : MonoBehaviour
{
    [Header("Movement")]
    public float moveSpeed = 5f;
    public float rotationSpeed = 10f;

    [Header("Gravity")]
    public float gravity = -25f;
    public float groundedForce = -3f;

    private CharacterController controller;
    private Vector3 velocity;

    void Start()
    {
        controller = GetComponent<CharacterController>();

        if (controller == null)
        {
            Debug.LogError("HuscarMovement requires a CharacterController component.");
        }
    }

    void Update()
    {
        if (controller == null)
            return;

        HandleMovement();
        HandleGravity();
    }

    private void HandleMovement()
    {
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector3 direction = new Vector3(horizontal, 0f, vertical);

        // Prevent faster diagonal movement
        direction = Vector3.ClampMagnitude(direction, 1f);

        // Move
        controller.Move(direction * moveSpeed * Time.deltaTime);

        // Rotate toward movement direction
        if (direction.sqrMagnitude > 0.01f)
        {
            Quaternion targetRotation = Quaternion.LookRotation(direction);

            transform.rotation = Quaternion.Slerp(
                transform.rotation,
                targetRotation,
                rotationSpeed * Time.deltaTime
            );
        }
    }

    private void HandleGravity()
    {
        if (controller.isGrounded)
        {
            // Keep the controller firmly attached to the ground
            if (velocity.y < 0f)
            {
                velocity.y = groundedForce;
            }
        }
        else
        {
            // Apply gravity while in the air
            velocity.y += gravity * Time.deltaTime;
        }

        // Apply vertical movement
        controller.Move(velocity * Time.deltaTime);
    }
}