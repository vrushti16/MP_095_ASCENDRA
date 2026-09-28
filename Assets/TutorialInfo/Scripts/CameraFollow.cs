using UnityEngine;

public class CameraFollow : MonoBehaviour
{
  [Header("Target")]
  public Transform player;

  [Header("Camera Settings")]
  public Vector3 offset = new Vector3(0f, 3f, -6f);

  public float followSpeed = 8f;

  void LateUpdate()
  {
    if (player == null)
      return;

    // Camera position relative to player's facing direction
    Vector3 targetPosition =
        player.position + player.TransformDirection(offset);

    // Smooth follow
    transform.position = Vector3.Lerp(
        transform.position,
        targetPosition,
        followSpeed * Time.deltaTime
    );

    // Look at player's upper body
    Vector3 lookTarget =
        player.position + Vector3.up * 1.5f;

    transform.LookAt(lookTarget);
  }
}
