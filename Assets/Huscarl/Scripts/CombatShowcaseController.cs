using System.Collections;
using UnityEngine;

[DisallowMultipleComponent]
[RequireComponent(typeof(CharacterController))]
public class CombatShowcaseController : MonoBehaviour
{
    private enum QueuedInput { None, Sword, Shield }

    [Header("References")]
    [SerializeField] private Animator animator;

    [Header("Movement")]
    [SerializeField] private float moveSpeed = 4.5f;
    [SerializeField] private float gravity = -20f;

    [Header("Rotation")]
    [SerializeField] private bool instantRotation = true;
    [SerializeField] private float rotationSpeed = 720f;

    [Header("Input Holds")]
    [SerializeField] private float heavyHoldThreshold = 0.25f;
    [SerializeField] private float shieldHoldThreshold = 0.25f;

    [Header("Shield Rush")]
    [SerializeField] private float shieldRushSpeed = 8f;
    [SerializeField] private float shieldRushDuration = 0.45f;

    [Header("Attack Forward Push")]
    [SerializeField] private float shieldAttackPushDistance = 0.45f;
    [SerializeField] private float shieldAttackPushDuration = 0.16f;
    [SerializeField] private float heavyAttackPushDistance = 0.65f;
    [SerializeField] private float heavyAttackPushDuration = 0.22f;

    [Header("Combo Forward Push")]
    [SerializeField] private float sword03PushDistance = 0.6f;
    [SerializeField] private float sword03PushDuration = 0.18f;
    [SerializeField] private float shield03PushDistance = 0.9f;
    [SerializeField] private float shield03PushDuration = 0.22f;

    [Header("Impact Backstep")]
    [SerializeField] private float shieldRushImpactBackstepDistance = 0.3f;
    [SerializeField] private float shieldRushImpactBackstepDuration = 0.22f;

    [Header("Animator Movement Params")]
    [SerializeField] private string speedParam = "Speed";

    [Header("Animator Combat Params")]
    [SerializeField] private string sword01Trigger = "Sword01";
    [SerializeField] private string sword02Trigger = "Sword02";
    [SerializeField] private string sword03Trigger = "Sword03";
    [SerializeField] private string shield03Trigger = "Shield03";
    [SerializeField] private string shieldAttackTrigger = "ShieldAttack";
    [SerializeField] private string shieldRushTrigger = "ShieldRush";
    [SerializeField] private string shieldRushImpactTrigger = "ShieldRushImpact";
    [SerializeField] private string heavyAttackTrigger = "HeavyAttack";
    [SerializeField] private string heavyHoldBool = "HeavyHold";
    [SerializeField] private string shieldStanceBool = "ShieldStance";
    [SerializeField] private string returnIdleTrigger = "ReturnIdle";

    [Header("Debug")]
    [SerializeField] private bool showDebug = true;

    private CharacterController controller;
    private Vector3 verticalVelocity;

    private bool isAttacking;
    private bool comboWindowOpen;
    private bool comboWindowWasOpened;
    private bool comboBroken;

    private bool isRushing;
    private bool isShieldHolding;
    private bool shieldHoldActivated;
    private bool heavyHoldActivated;

    private float lmbDownTime;
    private float rmbDownTime;

    private Coroutine pushRoutine;
    private Coroutine rushRoutine;

    private QueuedInput queuedInput = QueuedInput.None;

    private void Awake()
    {
        controller = GetComponent<CharacterController>();

        if (animator == null)
            animator = GetComponentInChildren<Animator>();
    }

    private void Update()
    {
        Vector3 moveInput = ReadMoveInput();

        HandleRotation(moveInput);
        HandleMovement(moveInput);
        HandleGravity();

        HandleSwordInput();
        HandleShieldInput();

        UpdateAnimatorMovement(moveInput);
    }

    private Vector3 ReadMoveInput()
    {
        float x = Input.GetAxisRaw("Horizontal");
        float z = Input.GetAxisRaw("Vertical");

        Vector3 input = new Vector3(x, 0f, z);

        if (input.sqrMagnitude > 1f)
            input.Normalize();

        // Get the main camera
        Camera cam = Camera.main;

        if (cam == null)
            return input;

        // Get camera forward and right directions
        Vector3 cameraForward = cam.transform.forward;
        Vector3 cameraRight = cam.transform.right;

        // Keep movement horizontal
        cameraForward.y = 0f;
        cameraRight.y = 0f;

        cameraForward.Normalize();
        cameraRight.Normalize();

        // Convert keyboard input to camera-relative movement
        Vector3 moveDirection =
            cameraForward * z +
            cameraRight * x;

        return Vector3.ClampMagnitude(moveDirection, 1f);
    }

    private bool IsMovementLocked()
    {
        return isAttacking || isRushing || isShieldHolding;
    }

    private void HandleRotation(Vector3 input)
    {
        if (input.sqrMagnitude < 0.001f || IsMovementLocked())
            return;

        Quaternion targetRotation = Quaternion.LookRotation(input, Vector3.up);

        transform.rotation = instantRotation
            ? targetRotation
            : Quaternion.RotateTowards(transform.rotation, targetRotation, rotationSpeed * Time.deltaTime);
    }

    private void HandleMovement(Vector3 input)
    {
        if (IsMovementLocked())
            return;

        controller.Move(input * moveSpeed * Time.deltaTime);
    }

    private void HandleGravity()
    {
        if (controller.isGrounded && verticalVelocity.y < 0f)
            verticalVelocity.y = -2f;

        verticalVelocity.y += gravity * Time.deltaTime;
        controller.Move(verticalVelocity * Time.deltaTime);
    }

    private void UpdateAnimatorMovement(Vector3 input)
    {
        if (animator == null)
            return;

        float animSpeed = IsMovementLocked() ? 0f : input.magnitude;
        animator.SetFloat(speedParam, animSpeed);
    }

    private void HandleSwordInput()
    {
        if (isRushing || isShieldHolding)
            return;

        if (Input.GetMouseButtonDown(0))
        {
            lmbDownTime = Time.time;
            heavyHoldActivated = false;
        }

        if (Input.GetMouseButton(0) && !heavyHoldActivated && !isAttacking)
        {
            if (Time.time - lmbDownTime >= heavyHoldThreshold)
            {
                heavyHoldActivated = true;
                animator.SetBool(heavyHoldBool, true);
            }
        }

        if (Input.GetMouseButtonUp(0))
        {
            animator.SetBool(heavyHoldBool, false);

            if (heavyHoldActivated && !isAttacking)
                StartHeavyAttack();
            else
                ReceiveSwordInput();

            heavyHoldActivated = false;
        }
    }

    private void HandleShieldInput()
    {
        if (isRushing)
            return;

        if (Input.GetMouseButtonDown(1))
        {
            rmbDownTime = Time.time;
            shieldHoldActivated = false;
        }

        if (Input.GetMouseButton(1) && !shieldHoldActivated && !isAttacking)
        {
            if (Time.time - rmbDownTime >= shieldHoldThreshold)
            {
                shieldHoldActivated = true;
                isShieldHolding = true;

                BreakComboOnly();
                animator.SetBool(shieldStanceBool, true);
            }
        }

        if (Input.GetMouseButtonUp(1))
        {
            if (shieldHoldActivated && !isAttacking)
                StartShieldRush();
            else
                ReceiveShieldInput();

            shieldHoldActivated = false;
        }
    }

    public bool ReceiveSwordInput()
    {
        return HandleComboInput(QueuedInput.Sword);
    }

    public bool ReceiveShieldInput()
    {
        return HandleComboInput(QueuedInput.Shield);
    }

    private bool HandleComboInput(QueuedInput input)
    {
        if (!isAttacking)
        {
            if (input == QueuedInput.Sword)
                StartSword01();
            else
                StartShieldAttack();

            return true;
        }

        if (comboWindowOpen && !comboBroken)
        {
            queuedInput = input;

            DebugLog(input == QueuedInput.Sword
                ? "<color=green>COMBO OK: SWORD</color>"
                : "<color=green>COMBO OK: SHIELD</color>");

            return true;
        }

        comboBroken = true;
        queuedInput = QueuedInput.None;
        comboWindowOpen = false;

        DebugLog(!comboWindowWasOpened
            ? "<color=red>BAD INPUT: TOO EARLY - COMBO LOST</color>"
            : "<color=red>BAD INPUT: TOO LATE - COMBO LOST</color>");

        return true;
    }

    private void StartSword01()
    {
        isAttacking = true;
        comboBroken = false;
        queuedInput = QueuedInput.None;
        comboWindowOpen = false;
        comboWindowWasOpened = false;

        ResetCombatTriggers();
        animator.SetTrigger(sword01Trigger);

        DebugLog("<color=white>Attack 1</color>");
    }

    private void StartShieldAttack()
    {
        isAttacking = true;
        comboBroken = true;
        queuedInput = QueuedInput.None;
        comboWindowOpen = false;
        comboWindowWasOpened = false;

        ResetCombatTriggers();
        animator.SetTrigger(shieldAttackTrigger);

        DebugLog("<color=white>Shield Attack</color>");
    }

    private void StartHeavyAttack()
    {
        isAttacking = true;
        comboBroken = true;
        queuedInput = QueuedInput.None;
        comboWindowOpen = false;
        comboWindowWasOpened = false;

        ResetCombatTriggers();
        animator.SetTrigger(heavyAttackTrigger);

        DebugLog("<color=white>Heavy Attack</color>");
    }

    private void StartShieldRush()
    {
        isShieldHolding = false;

        isAttacking = true;
        comboBroken = true;
        queuedInput = QueuedInput.None;
        comboWindowOpen = false;
        comboWindowWasOpened = false;

        animator.SetBool(shieldStanceBool, false);

        ResetCombatTriggers();
        animator.SetTrigger(shieldRushTrigger);

        if (rushRoutine != null)
            StopCoroutine(rushRoutine);

        rushRoutine = StartCoroutine(ShieldRushRoutine());

        DebugLog("<color=white>Shield Rush Loop</color>");
    }

    // ---------- Animation Events ----------

    public void OpenComboWindow()
    {
        if (comboBroken)
            return;

        comboWindowOpen = true;
        comboWindowWasOpened = true;

        DebugLog("<color=yellow>WINDOW OPEN</color>");
    }

    public void CloseComboWindow()
    {
        comboWindowOpen = false;
        DebugLog("<color=orange>WINDOW CLOSE</color>");
    }

    public void TryContinueFromSword01()
    {
        comboWindowOpen = false;

        if (!comboBroken && queuedInput == QueuedInput.Sword)
        {
            queuedInput = QueuedInput.None;
            comboWindowWasOpened = false;

            ResetCombatTriggers();
            animator.SetTrigger(sword02Trigger);

            DebugLog("<color=green>Attack 2</color>");
            return;
        }

        ReturnToIdle();
    }

    public void TryContinueFromSword02()
    {
        comboWindowOpen = false;

        if (!comboBroken && queuedInput == QueuedInput.Sword)
        {
            queuedInput = QueuedInput.None;
            comboWindowWasOpened = false;

            ResetCombatTriggers();
            animator.SetTrigger(sword03Trigger);

            DebugLog("<color=green>Attack 3: SWORD</color>");
            return;
        }

        if (!comboBroken && queuedInput == QueuedInput.Shield)
        {
            queuedInput = QueuedInput.None;
            comboWindowWasOpened = false;

            ResetCombatTriggers();
            animator.SetTrigger(shield03Trigger);

            DebugLog("<color=green>Attack 3: SHIELD</color>");
            return;
        }

        ReturnToIdle();
    }

    public void PushSword03()
    {
        StartDirectionalPush(sword03PushDistance, sword03PushDuration);
    }

    public void PushShield03()
    {
        StartDirectionalPush(shield03PushDistance, shield03PushDuration);
    }

    public void PushShieldAttack()
    {
        StartDirectionalPush(shieldAttackPushDistance, shieldAttackPushDuration);
    }

    public void PushHeavyAttack()
    {
        StartDirectionalPush(heavyAttackPushDistance, heavyAttackPushDuration);
    }

    public void BackstepShieldRushImpact()
    {
        StartDirectionalPush(-shieldRushImpactBackstepDistance, shieldRushImpactBackstepDuration);
    }

    public void EndCombo()
    {
        ReturnToIdle();
    }

    // ---------- Movement Bursts ----------

    private void StartDirectionalPush(float distance, float duration)
    {
        if (pushRoutine != null)
            StopCoroutine(pushRoutine);

        pushRoutine = StartCoroutine(DirectionalPushRoutine(distance, duration));
    }

    private IEnumerator DirectionalPushRoutine(float distance, float duration)
    {
        float elapsed = 0f;
        float speed = distance / Mathf.Max(duration, 0.01f);

        while (elapsed < duration)
        {
            float delta = Time.deltaTime;
            elapsed += delta;

            controller.Move(transform.forward * speed * delta);
            yield return null;
        }

        pushRoutine = null;
    }

    private IEnumerator ShieldRushRoutine()
    {
        isRushing = true;

        float timer = 0f;
        bool hitSomething = false;

        while (timer < shieldRushDuration)
        {
            Vector3 move = transform.forward * shieldRushSpeed * Time.deltaTime;
            CollisionFlags flags = controller.Move(move);

            if ((flags & CollisionFlags.Sides) != 0)
            {
                hitSomething = true;
                break;
            }

            timer += Time.deltaTime;
            yield return null;
        }

        isRushing = false;
        rushRoutine = null;

        ResetCombatTriggers();

        if (hitSomething)
        {
            animator.SetTrigger(shieldRushImpactTrigger);
            DebugLog("<color=white>Shield Rush Impact</color>");
        }
        else
        {
            ReturnToIdle();
            DebugLog("<color=white>Shield Rush End - no impact</color>");
        }
    }

    // ---------- State Helpers ----------

    private void ReturnToIdle()
    {
        isAttacking = false;
        comboBroken = false;
        queuedInput = QueuedInput.None;
        comboWindowOpen = false;
        comboWindowWasOpened = false;

        ResetCombatTriggers();
        animator.SetTrigger(returnIdleTrigger);

        DebugLog("<color=white>Combo ended - ReturnIdle</color>");
    }

    private void BreakComboOnly()
    {
        isAttacking = false;
        comboBroken = true;
        queuedInput = QueuedInput.None;
        comboWindowOpen = false;
        comboWindowWasOpened = false;
    }

    private void ResetCombatTriggers()
    {
        animator.ResetTrigger(sword01Trigger);
        animator.ResetTrigger(sword02Trigger);
        animator.ResetTrigger(sword03Trigger);
        animator.ResetTrigger(shield03Trigger);
        animator.ResetTrigger(shieldAttackTrigger);
        animator.ResetTrigger(shieldRushTrigger);
        animator.ResetTrigger(shieldRushImpactTrigger);
        animator.ResetTrigger(heavyAttackTrigger);
        animator.ResetTrigger(returnIdleTrigger);
    }

    private void DebugLog(string message)
    {
        if (!showDebug) return;
        Debug.Log(message, this);
    }
}