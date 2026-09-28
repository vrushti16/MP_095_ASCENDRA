using System.Collections;
using UnityEngine;

[DisallowMultipleComponent]
[RequireComponent(typeof(CharacterController))]
public class IsometricShowcaseController : MonoBehaviour
{
    private enum ComboStep
    {
        None,
        Sword01,
        Sword02,
        ShieldAttack
    }

    private enum QueuedInput
    {
        None,
        Sword,
        Shield
    }

    [Header("Movement")]
    [SerializeField] private float moveSpeed = 4.5f;
    [SerializeField] private float gravity = -20f;

    [Header("Rotation")]
    [SerializeField] private bool instantRotation = true;
    [SerializeField] private float rotationSpeed = 720f;

    [Header("Shield Hold")]
    [SerializeField] private float shieldStanceThreshold = 0.25f;

    [Header("Shield Bash Dash")]
    [SerializeField] private float bashDashSpeed = 8f;
    [SerializeField] private float bashDashDuration = 0.18f;

    [Header("Heavy Hold")]
    [SerializeField] private float heavyHoldThreshold = 0.25f;

    [Header("Timing: Sword01 -> Sword02")]
    [SerializeField] private float sword01ToSword02InputStart = 0.25f;
    [SerializeField] private float sword01ToSword02ChainTime = 0.45f;
    [SerializeField] private float sword01ToSword02Expire = 0.75f;

    [Header("Timing: Sword01 -> ShieldAttack")]
    [SerializeField] private float sword01ToShieldInputStart = 0.25f;
    [SerializeField] private float sword01ToShieldChainTime = 0.48f;
    [SerializeField] private float sword01ToShieldExpire = 0.78f;

    [Header("Timing: Sword02 -> ShieldAttack")]
    [SerializeField] private float sword02ToShieldInputStart = 0.25f;
    [SerializeField] private float sword02ToShieldChainTime = 0.45f;
    [SerializeField] private float sword02ToShieldExpire = 0.75f;

    [Header("Timing: ShieldAttack -> Sword02")]
    [SerializeField] private float shieldToSword02InputStart = 0.28f;
    [SerializeField] private float shieldToSword02ChainTime = 0.50f;
    [SerializeField] private float shieldToSword02Expire = 0.82f;

    [Header("Animator")]
    [SerializeField] private Animator animator;

    [Header("Animator Params")]
    [SerializeField] private string speedParam = "Speed";
    [SerializeField] private string sword01Trigger = "Sword01";
    [SerializeField] private string sword02Trigger = "Sword02";
    [SerializeField] private string shieldAttackTrigger = "ShieldAttack";
    [SerializeField] private string shieldStanceBool = "ShieldStance";
    [SerializeField] private string shieldBashTrigger = "ShieldBash";
    [SerializeField] private string heavyHoldBool = "HeavyHold";
    [SerializeField] private string heavyAttackTrigger = "HeavyAttack";

    private CharacterController controller;
    private Vector3 verticalVelocity;

    private bool isShieldStance;
    private bool isBashing;

    private float rmbDownTime;
    private bool shieldStanceActivated;

    private float lmbDownTime;
    private bool heavyHoldActive;

    private bool comboActive;
    private ComboStep currentStep = ComboStep.None;
    private QueuedInput queuedInput = QueuedInput.None;
    private float stepStartTime;

    private float activeInputStart;
    private float activeChainTime;
    private float activeExpire;

    private void Awake()
    {
        controller = GetComponent<CharacterController>();

        if (animator == null)
            animator = GetComponentInChildren<Animator>();
    }

    private void Update()
    {
        Vector3 input = ReadMoveInput();

        HandleRotation(input);
        HandleMovement(input);
        HandleGravity();

        HandleSwordInput();
        HandleShieldInput();
        UpdateCombo();

        UpdateAnimatorMovement(input);
    }

    private Vector3 ReadMoveInput()
    {
        float x = Input.GetAxisRaw("Horizontal");
        float z = Input.GetAxisRaw("Vertical");

        return Vector3.ClampMagnitude(new Vector3(x, 0f, z), 1f);
    }

    private void HandleRotation(Vector3 input)
    {
        if (input.sqrMagnitude < 0.001f)
            return;

        Quaternion targetRotation = Quaternion.LookRotation(input, Vector3.up);

        transform.rotation = instantRotation
            ? targetRotation
            : Quaternion.RotateTowards(transform.rotation, targetRotation, rotationSpeed * Time.deltaTime);
    }

    private void HandleMovement(Vector3 input)
    {
        if (isShieldStance || isBashing)
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

        float animSpeed = isShieldStance || isBashing ? 0f : input.magnitude;
        animator.SetFloat(speedParam, animSpeed);
    }

    private void HandleSwordInput()
    {
        if (isShieldStance || isBashing)
            return;

        if (Input.GetMouseButtonDown(0))
        {
            lmbDownTime = Time.time;
            heavyHoldActive = false;
        }

        if (Input.GetMouseButton(0) && !heavyHoldActive)
        {
            if (Time.time - lmbDownTime >= heavyHoldThreshold)
            {
                heavyHoldActive = true;

                if (animator != null)
                    animator.SetBool(heavyHoldBool, true);
            }
        }

        if (Input.GetMouseButtonUp(0))
        {
            if (animator != null)
                animator.SetBool(heavyHoldBool, false);

            if (heavyHoldActive)
                StartHeavyAttack();
            else
                RegisterSwordInput();

            heavyHoldActive = false;
        }
    }

    private void HandleShieldInput()
    {
        if (isBashing)
            return;

        if (Input.GetMouseButtonDown(1))
        {
            rmbDownTime = Time.time;
            shieldStanceActivated = false;
        }

        if (Input.GetMouseButton(1) && !shieldStanceActivated)
        {
            if (Time.time - rmbDownTime >= shieldStanceThreshold)
            {
                shieldStanceActivated = true;
                isShieldStance = true;

                CancelCombo();

                if (animator != null)
                    animator.SetBool(shieldStanceBool, true);
            }
        }

        if (Input.GetMouseButtonUp(1))
        {
            if (shieldStanceActivated)
                ReleaseShieldBash();
            else
                RegisterShieldInput();

            shieldStanceActivated = false;
        }
    }

    private void RegisterSwordInput()
    {
        if (!comboActive)
        {
            StartSword01();
            return;
        }

        if (!CanQueueInput(QueuedInput.Sword))
            return;

        queuedInput = QueuedInput.Sword;
        LoadTimingForQueuedInput();
    }

    private void RegisterShieldInput()
    {
        if (!comboActive)
        {
            StartShieldAttack();
            return;
        }

        if (!CanQueueInput(QueuedInput.Shield))
            return;

        queuedInput = QueuedInput.Shield;
        LoadTimingForQueuedInput();
    }

    private bool CanQueueInput(QueuedInput input)
    {
        float elapsed = Time.time - stepStartTime;

        switch (currentStep)
        {
            case ComboStep.Sword01:
                if (input == QueuedInput.Sword)
                    return elapsed >= sword01ToSword02InputStart && elapsed <= sword01ToSword02Expire;

                if (input == QueuedInput.Shield)
                    return elapsed >= sword01ToShieldInputStart && elapsed <= sword01ToShieldExpire;

                break;

            case ComboStep.Sword02:
                if (input == QueuedInput.Shield)
                    return elapsed >= sword02ToShieldInputStart && elapsed <= sword02ToShieldExpire;

                break;

            case ComboStep.ShieldAttack:
                if (input == QueuedInput.Sword)
                    return elapsed >= shieldToSword02InputStart && elapsed <= shieldToSword02Expire;

                break;
        }

        return false;
    }

    private void LoadTimingForQueuedInput()
    {
        switch (currentStep)
        {
            case ComboStep.Sword01:
                if (queuedInput == QueuedInput.Sword)
                {
                    activeInputStart = sword01ToSword02InputStart;
                    activeChainTime = sword01ToSword02ChainTime;
                    activeExpire = sword01ToSword02Expire;
                }
                else if (queuedInput == QueuedInput.Shield)
                {
                    activeInputStart = sword01ToShieldInputStart;
                    activeChainTime = sword01ToShieldChainTime;
                    activeExpire = sword01ToShieldExpire;
                }
                break;

            case ComboStep.Sword02:
                if (queuedInput == QueuedInput.Shield)
                {
                    activeInputStart = sword02ToShieldInputStart;
                    activeChainTime = sword02ToShieldChainTime;
                    activeExpire = sword02ToShieldExpire;
                }
                break;

            case ComboStep.ShieldAttack:
                if (queuedInput == QueuedInput.Sword)
                {
                    activeInputStart = shieldToSword02InputStart;
                    activeChainTime = shieldToSword02ChainTime;
                    activeExpire = shieldToSword02Expire;
                }
                break;
        }
    }

    private void UpdateCombo()
    {
        if (!comboActive)
            return;

        float elapsed = Time.time - stepStartTime;

        if (elapsed > GetCurrentStepMaxExpire())
        {
            CancelCombo();
            return;
        }

        if (queuedInput == QueuedInput.None)
            return;

        if (elapsed < activeChainTime)
            return;

        FireQueuedCombo();
    }

    private float GetCurrentStepMaxExpire()
    {
        switch (currentStep)
        {
            case ComboStep.Sword01:
                return Mathf.Max(sword01ToSword02Expire, sword01ToShieldExpire);

            case ComboStep.Sword02:
                return sword02ToShieldExpire;

            case ComboStep.ShieldAttack:
                return shieldToSword02Expire;

            default:
                return 0f;
        }
    }

    private void FireQueuedCombo()
    {
        QueuedInput input = queuedInput;
        queuedInput = QueuedInput.None;

        if (currentStep == ComboStep.Sword01 && input == QueuedInput.Sword)
        {
            StartSword02();
            return;
        }

        if (currentStep == ComboStep.Sword01 && input == QueuedInput.Shield)
        {
            StartShieldAttack();
            return;
        }

        if (currentStep == ComboStep.Sword02 && input == QueuedInput.Shield)
        {
            StartShieldAttack();
            return;
        }

        if (currentStep == ComboStep.ShieldAttack && input == QueuedInput.Sword)
        {
            StartSword02();
            return;
        }

        CancelCombo();
    }

    private void StartSword01()
    {
        CancelCombo();

        comboActive = true;
        currentStep = ComboStep.Sword01;
        stepStartTime = Time.time;

        if (animator != null)
            animator.SetTrigger(sword01Trigger);
    }

    private void StartSword02()
    {
        comboActive = true;
        currentStep = ComboStep.Sword02;
        stepStartTime = Time.time;

        if (animator != null)
            animator.SetTrigger(sword02Trigger);
    }

    private void StartShieldAttack()
    {
        comboActive = true;
        currentStep = ComboStep.ShieldAttack;
        stepStartTime = Time.time;

        if (animator != null)
            animator.SetTrigger(shieldAttackTrigger);
    }

    private void StartHeavyAttack()
    {
        CancelCombo();

        if (animator != null)
            animator.SetTrigger(heavyAttackTrigger);
    }

    private void ReleaseShieldBash()
    {
        isShieldStance = false;
        CancelCombo();

        if (animator != null)
        {
            animator.SetBool(shieldStanceBool, false);
            animator.SetTrigger(shieldBashTrigger);
        }

        StartCoroutine(BashDashRoutine());
    }

    private void CancelCombo()
    {
        comboActive = false;
        currentStep = ComboStep.None;
        queuedInput = QueuedInput.None;
    }

    private IEnumerator BashDashRoutine()
    {
        isBashing = true;

        float timer = 0f;

        while (timer < bashDashDuration)
        {
            controller.Move(transform.forward * bashDashSpeed * Time.deltaTime);
            timer += Time.deltaTime;
            yield return null;
        }

        isBashing = false;
    }
}