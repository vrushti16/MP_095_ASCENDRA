using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(CharacterController))]
public class PlayerMovement : MonoBehaviour
{
    [Header("Movement")]
    public float moveSpeed = 5f;
    public float rotationSpeed = 10f;
    public float gravity = -20f;

    [Header("References")]
    public Animator animator;

    private CharacterController controller;
    private float verticalVelocity;

    private void Awake()
    {
        controller = GetComponent<CharacterController>();

        if (animator == null)
        {
            animator = GetComponent<Animator>();
        }
    }

    private void Update()
    {
        MovePlayer();
    }

    private void MovePlayer()
    {
        Vector2 input = Vector2.zero;

        if (Keyboard.current != null)
        {
            if (Keyboard.current.wKey.isPressed)
                input.y += 1f;

            if (Keyboard.current.sKey.isPressed)
                input.y -= 1f;

            if (Keyboard.current.dKey.isPressed)
                input.x += 1f;

            if (Keyboard.current.aKey.isPressed)
                input.x -= 1f;
        }
        if (animator != null)
        {
            animator.SetFloat("Speed", input.magnitude);
        }

        input = Vector2.ClampMagnitude(input, 1f);

        Vector3 movement = new Vector3(input.x, 0f, input.y);

        if (movement.magnitude > 0.01f)
        {
            transform.forward = Vector3.Slerp(
                transform.forward,
                movement.normalized,
                rotationSpeed * Time.deltaTime
            );
        }

        if (controller.isGrounded)
        {
            verticalVelocity = -2f;
        }
        else
        {
            verticalVelocity += gravity * Time.deltaTime;
        }

        Vector3 velocity = movement * moveSpeed;
        velocity.y = verticalVelocity;

        controller.Move(velocity * Time.deltaTime);

        if (animator != null)
        {
            animator.SetFloat("Speed", input.magnitude);
        }
    }
}