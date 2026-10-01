/**
 * ASCENDRA Player Authentication Controller
 * Manages player sign in, registration, session persistence, auth modal states,
 * and the Embossed / Neumorphic Gmail OTP Password Reset Flow.
 */

const playerAuth = {
  currentTab: 'signin',
  currentState: 'signin', // 'signin' | 'forgot-password' | 'otp-verification' | 'otp-verified' | 'reset-password' | 'reset-success' | 'invalid-otp'
  resetEmail: null,
  resetToken: null,
  resendCooldownTimer: null,
  otpExpiryTimer: null,

  init() {
    // Existing Modal Elements
    this.authModal = document.getElementById('playerAuthModal');
    this.defaultAuthCard = document.querySelector('.player-modal-card');
    this.authAlert = document.getElementById('authAlert');
    this.signinForm = document.getElementById('signinForm');
    this.registerForm = document.getElementById('registerForm');
    this.tabSigninBtn = document.getElementById('tabSigninBtn');
    this.tabRegisterBtn = document.getElementById('tabRegisterBtn');
    this.googleLoginBtn = document.getElementById('googleLoginBtn');
    this.logoutBtn = document.getElementById('playerLogoutBtn');

    // Password Reset Embossed Elements
    this.passwordResetContainer = document.getElementById('passwordResetFlowContainer');
    this.embossedAlert = document.getElementById('embossedAlert');
    this.forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // Step Cards
    this.cardForgotPassword = document.getElementById('cardForgotPassword');
    this.cardVerifyOtp = document.getElementById('cardVerifyOtp');
    this.cardOtpVerified = document.getElementById('cardOtpVerified');
    this.cardResetPassword = document.getElementById('cardResetPassword');
    this.cardResetSuccess = document.getElementById('cardResetSuccess');
    this.cardInvalidOtp = document.getElementById('cardInvalidOtp');

    // Forms & Controls
    this.forgotPasswordForm = document.getElementById('forgotPasswordForm');
    this.fpEmailInput = document.getElementById('fpEmailInput');
    this.fpSendOtpBtn = document.getElementById('fpSendOtpBtn');

    this.otpVerifyForm = document.getElementById('otpVerifyForm');
    this.otpBoxes = [0, 1, 2, 3, 4, 5].map(i => document.getElementById(`otpBox${i}`));
    this.otpVerifyBtn = document.getElementById('otpVerifyBtn');
    this.otpResendBtn = document.getElementById('otpResendBtn');
    this.otpExpiryCountdown = document.getElementById('otpExpiryCountdown');
    this.otpMaskedEmailDisplay = document.getElementById('otpMaskedEmailDisplay');
    this.otpContinueToResetBtn = document.getElementById('otpContinueToResetBtn');
    this.otpEnterAscendraBtn = document.getElementById('otpEnterAscendraBtn');

    this.resetPasswordForm = document.getElementById('resetPasswordForm');
    this.newPasswordInput = document.getElementById('newPasswordInput');
    this.confirmPasswordInput = document.getElementById('confirmPasswordInput');
    this.resetPasswordSubmitBtn = document.getElementById('resetPasswordSubmitBtn');
    this.toggleNewPasswordBtn = document.getElementById('toggleNewPasswordBtn');
    this.toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPasswordBtn');
    this.resetSuccessGoToSigninBtn = document.getElementById('resetSuccessGoToSigninBtn');

    this.invalidOtpTryAgainBtn = document.getElementById('invalidOtpTryAgainBtn');
    this.invalidOtpResendBtn = document.getElementById('invalidOtpResendBtn');
    this.invalidOtpMessage = document.getElementById('invalidOtpMessage');

    // Tab switching (Sign In / Register)
    if (this.tabSigninBtn) {
      this.tabSigninBtn.addEventListener('click', () => this.switchTab('signin', true));
    }
    if (this.tabRegisterBtn) {
      this.tabRegisterBtn.addEventListener('click', () => this.switchTab('register', true));
    }

    // Modal Close buttons
    this.authModalCloseBtn = document.getElementById('authModalCloseBtn');
    this.passwordResetCloseBtn = document.getElementById('passwordResetCloseBtn');
    if (this.authModalCloseBtn) {
      this.authModalCloseBtn.addEventListener('click', () => this.hideModal(true));
    }
    if (this.passwordResetCloseBtn) {
      this.passwordResetCloseBtn.addEventListener('click', () => this.hideModal(true));
    }

    // Close when clicking modal backdrop outside dialog
    if (this.authModal) {
      this.authModal.addEventListener('click', (e) => {
        if (e.target === this.authModal) {
          this.hideModal(true);
        }
      });
    }

    // Form submissions
    if (this.signinForm) {
      this.signinForm.addEventListener('submit', (e) => this.handleSignin(e));
    }
    if (this.registerForm) {
      this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // Google Sign-In hook
    if (this.googleLoginBtn) {
      this.googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
    }

    // Logout
    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => this.logout());
    }

    // Browser history popstate navigation (Back / Forward buttons)
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname, false);
    });

    // Session expiration listener
    window.addEventListener('player:unauthorized', () => {
      this.setAuthState('signin', true);
      this.showModal('Your session has ended. Please sign in to resume your adventure.', 'signin', true);
    });

    // Initialize Firebase Authentication
    this.initFirebaseAuth();

    // Setup Password Reset Events & Listeners
    this.initPasswordResetFlow();
  },

  /* ========================================================================
     Client-side SPA Router & Route Synchronization
     ======================================================================== */
  updateUrl(path, updateHistory = true, replace = false) {
    const target = path.replace(/\/$/, '') || '/';
    const current = window.location.pathname.replace(/\/$/, '') || '/';
    if (updateHistory && target !== current) {
      if (replace) {
        window.history.replaceState({ path: target }, '', target);
      } else {
        window.history.pushState({ path: target }, '', target);
      }
    } else if (replace && target === current) {
      window.history.replaceState({ path: target }, '', target);
    }
    this.updatePageTitle(target);
  },

  updatePageTitle(path) {
    switch (path) {
      case '/login':
        document.title = 'ASCENDRA — Sign In';
        break;
      case '/register':
        document.title = 'ASCENDRA — Register Explorer';
        break;
      case '/forgot-password':
        document.title = 'ASCENDRA — Reset Password';
        break;
      case '/play':
        document.title = 'ASCENDRA — Realm Dashboard';
        break;
      default:
        document.title = 'ASCENDRA — The Lost Realms';
        break;
    }
  },

  handleRoute(path, updateHistory = false) {
    const normalized = (path || window.location.pathname).replace(/\/$/, '') || '/';
    const token = window.playerApi?.getToken();

    if (token) {
      // Explorer is already signed in!
      // If browser navigates back to /login, /register, /forgot-password, or /, prevent modal and stay in realm
      if (normalized === '/login' || normalized === '/register' || normalized === '/forgot-password' || normalized === '/') {
        this.hideModal(false);
        if (window.playerSplash) window.playerSplash.hideSplash();
        if (window.playerApp) window.playerApp.loadCurrentSection();
        this.updateUrl('/play', true, true);
        return;
      }
      if (normalized === '/play') {
        this.hideModal(false);
        if (window.playerSplash) window.playerSplash.hideSplash();
        if (window.playerApp) window.playerApp.loadCurrentSection();
        this.updateUrl('/play', updateHistory, true);
        return;
      }
    }

    // Unauthenticated explorer routing
    if (normalized === '/login') {
      this.showModal(null, 'signin', updateHistory);
    } else if (normalized === '/register') {
      this.showModal(null, 'register', updateHistory);
    } else if (normalized === '/forgot-password') {
      this.showModal(null, null, updateHistory);
      this.setAuthState('forgot-password', updateHistory);
    } else if (normalized === '/play') {
      this.showModal('Please sign in to enter ASCENDRA.', 'signin', updateHistory);
    } else {
      // Root '/' or splash page
      this.hideModal(false);
      if (window.playerSplash) {
        window.playerSplash.showSplash();
      }
      this.updateUrl('/', updateHistory);
    }
  },

  handleInitialRoute() {
    const current = window.location.pathname.replace(/\/$/, '') || '/';
    if (current === '/login' || current === '/register' || current === '/forgot-password' || current === '/play') {
      this.handleRoute(current, false);
    } else {
      this.updatePageTitle('/');
    }
  },

  /* ========================================================================
     Standard Auth Tabs & Modals
     ======================================================================== */
  switchTab(tab, updateHistory = true) {
    this.currentTab = tab;
    this.hideAlert();

    if (tab === 'signin') {
      if (this.signinForm) this.signinForm.classList.remove('hidden');
      if (this.registerForm) this.registerForm.classList.add('hidden');
      if (this.tabSigninBtn) this.tabSigninBtn.classList.add('active');
      if (this.tabRegisterBtn) this.tabRegisterBtn.classList.remove('active');
      this.updateUrl('/login', updateHistory);
    } else {
      if (this.signinForm) this.signinForm.classList.add('hidden');
      if (this.registerForm) this.registerForm.classList.remove('hidden');
      if (this.tabSigninBtn) this.tabSigninBtn.classList.remove('active');
      if (this.tabRegisterBtn) this.tabRegisterBtn.classList.add('active');
      this.updateUrl('/register', updateHistory);
    }
  },

  showModal(message = null, targetTab = null, updateHistory = true) {
    const token = window.playerApi?.getToken();
    if (token && !message) {
      // Already authenticated: never pop up modal
      this.hideModal(false);
      this.updateUrl('/play', true, true);
      return;
    }

    if (this.authModal) {
      this.authModal.classList.remove('hidden');
    }
    if (targetTab) {
      this.switchTab(targetTab, updateHistory);
    } else if (this.currentState === 'signin') {
      this.updateUrl(this.currentTab === 'register' ? '/register' : '/login', updateHistory);
    }
    if (message) {
      this.showAlert(message, 'warning');
    }
  },

  hideModal(updateHistory = true) {
    if (this.authModal) {
      this.authModal.classList.add('hidden');
    }
    this.hideAlert();
    this.hideEmbossedAlert();
    if (updateHistory) {
      const token = window.playerApi?.getToken();
      this.updateUrl(token ? '/play' : '/', true, true);
    }
  },

  showAlert(message, type = 'danger') {
    if (this.authAlert) {
      this.authAlert.textContent = message;
      this.authAlert.className = `player-alert alert-${type}`;
      this.authAlert.classList.remove('hidden');
    }
  },

  hideAlert() {
    if (this.authAlert) {
      this.authAlert.textContent = '';
      this.authAlert.classList.add('hidden');
    }
  },

  showEmbossedAlert(message, type = 'danger') {
    if (this.embossedAlert) {
      this.embossedAlert.textContent = message;
      this.embossedAlert.className = `embossed-alert alert-${type}`;
      this.embossedAlert.classList.remove('hidden');
    }
  },

  hideEmbossedAlert() {
    if (this.embossedAlert) {
      this.embossedAlert.textContent = '';
      this.embossedAlert.classList.add('hidden');
    }
  },

  /* ========================================================================
     Password Reset Flow: State Machine & Event Handling
     ======================================================================== */
  initPasswordResetFlow() {
    // "Forgot Password?" entry trigger from Sign In form
    if (this.forgotPasswordLink) {
      this.forgotPasswordLink.addEventListener('click', () => {
        const currentEmail = document.getElementById('signinEmail')?.value.trim();
        if (this.fpEmailInput && currentEmail) {
          this.fpEmailInput.value = currentEmail;
        }
        this.setAuthState('forgot-password');
      });
    }

    // "Back to Sign In" links on all embossed cards
    const backBtns = document.querySelectorAll('.fpBackToSigninBtn');
    backBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.otpMode === 'registration') {
          this.setAuthState('signin');
          this.switchTab('register');
        } else {
          this.setAuthState('signin');
        }
      });
    });

    // Step 1: Submit email to request OTP
    if (this.forgotPasswordForm) {
      this.forgotPasswordForm.addEventListener('submit', (e) => this.handleRequestOtp(e));
    }

    // Step 2: OTP Box Inputs (Auto-advance, Backspace, Paste, Arrow keys)
    this.setupOtpInputBehavior();

    // Step 2: Submit OTP verification
    if (this.otpVerifyForm) {
      this.otpVerifyForm.addEventListener('submit', (e) => this.handleVerifyOtp(e));
    }

    // Step 2: Resend OTP trigger
    if (this.otpResendBtn) {
      this.otpResendBtn.addEventListener('click', () => this.handleResendOtp());
    }

    // Step 2-Success: Continue to Set New Password
    if (this.otpContinueToResetBtn) {
      this.otpContinueToResetBtn.addEventListener('click', () => {
        this.setAuthState('reset-password');
      });
    }

    // Step 2-Error: Try Again / Resend from error card
    if (this.invalidOtpTryAgainBtn) {
      this.invalidOtpTryAgainBtn.addEventListener('click', () => {
        this.setAuthState('otp-verification');
      });
    }
    if (this.invalidOtpResendBtn) {
      this.invalidOtpResendBtn.addEventListener('click', () => {
        this.handleResendOtp();
        this.setAuthState('otp-verification');
      });
    }

    // Step 3: Password Criteria Realtime Validation & Visibility Toggles
    this.setupPasswordCriteriaValidation();

    // Step 3: Submit Reset Password
    if (this.resetPasswordForm) {
      this.resetPasswordForm.addEventListener('submit', (e) => this.handleResetPassword(e));
    }

    // Step 4: Password Reset Success -> Go to Sign In
    if (this.resetSuccessGoToSigninBtn) {
      this.resetSuccessGoToSigninBtn.addEventListener('click', () => {
        this.setAuthState('signin');
        this.showAlert('Password updated successfully! Please sign in with your new password.', 'info');
      });
    }
  },

  getActiveOtpBoxes() {
    if (this.otpMode === 'registration') {
      return this.otpBoxes;
    }
    // Forgot password uses 5 digits
    return this.otpBoxes.slice(0, 5);
  },

  /**
   * Transition between authentication and password-reset states
   * Explicit States:
   * 'signin' | 'forgot-password' | 'otp-verification' | 'otp-verified' | 'reset-password' | 'reset-success' | 'invalid-otp'
   */
  setAuthState(state, updateHistory = true) {
    this.currentState = state;
    this.hideAlert();
    this.hideEmbossedAlert();

    const allStepCards = [
      this.cardForgotPassword,
      this.cardVerifyOtp,
      this.cardOtpVerified,
      this.cardResetPassword,
      this.cardResetSuccess,
      this.cardInvalidOtp
    ];

    if (state === 'signin') {
      this.clearTimers();
      if (this.passwordResetContainer) this.passwordResetContainer.classList.add('hidden');
      if (this.defaultAuthCard) this.defaultAuthCard.classList.remove('hidden');
      this.switchTab('signin', updateHistory);
      return;
    }

    // Switch to Embossed Password Reset Container
    if (this.defaultAuthCard) this.defaultAuthCard.classList.add('hidden');
    if (this.passwordResetContainer) this.passwordResetContainer.classList.remove('hidden');

    allStepCards.forEach(card => {
      if (card) card.classList.add('hidden');
    });

    switch (state) {
      case 'forgot-password':
        this.otpMode = 'forgot-password';
        if (this.cardForgotPassword) this.cardForgotPassword.classList.remove('hidden');
        if (this.fpEmailInput) this.fpEmailInput.focus();
        this.updateUrl('/forgot-password', updateHistory);
        break;

      case 'otp-verification':
        if (this.cardVerifyOtp) this.cardVerifyOtp.classList.remove('hidden');
        const isRegistration = this.otpMode === 'registration';
        const activeEmail = isRegistration ? this.regEmail : this.resetEmail;
        const requiredDigits = isRegistration ? 6 : 5;

        if (this.otpMaskedEmailDisplay && activeEmail) {
          this.otpMaskedEmailDisplay.textContent = this.maskEmail(activeEmail);
        }
        const verifyTitle = this.cardVerifyOtp?.querySelector('.embossed-card-title');
        const verifyDesc = this.cardVerifyOtp?.querySelector('.embossed-card-desc');
        const backBtn = this.cardVerifyOtp?.querySelector('.fpBackToSigninBtn');

        if (verifyTitle) {
          verifyTitle.textContent = isRegistration ? 'Verify Your Email' : 'Verify Your OTP';
        }
        if (verifyDesc && activeEmail) {
          verifyDesc.innerHTML = `We've sent a ${requiredDigits}-digit verification code to<br><strong class="embossed-masked-email">${this.maskEmail(activeEmail)}</strong>`;
        }
        if (this.otpVerifyBtn) {
          this.otpVerifyBtn.textContent = isRegistration ? 'VERIFY EMAIL' : 'VERIFY OTP';
          this.otpVerifyBtn.disabled = true;
        }
        if (backBtn) {
          backBtn.textContent = isRegistration ? '← Back to Register' : '← Back to Sign In';
        }

        // Configure 6th box (otpBox5) visibility based on mode
        if (this.otpBoxes[5]) {
          this.otpBoxes[5].style.display = isRegistration ? '' : 'none';
          this.otpBoxes[5].required = isRegistration;
        }

        // Clear OTP boxes
        this.otpBoxes.forEach(box => {
          if (box) {
            box.value = '';
            box.classList.remove('filled', 'error');
          }
        });
        if (this.otpBoxes[0]) this.otpBoxes[0].focus();
        // Start timers
        this.startTimers();
        if (!isRegistration) {
          this.updateUrl('/forgot-password', false);
        }
        break;

      case 'otp-verified':
        this.clearTimers();
        if (this.cardOtpVerified) this.cardOtpVerified.classList.remove('hidden');

        const titleEl = document.getElementById('otpVerifiedTitle');
        const descEl = document.getElementById('otpVerifiedDesc');
        const enterAscendraBtn = document.getElementById('otpEnterAscendraBtn');
        const continueResetBtn = document.getElementById('otpContinueToResetBtn');

        if (this.otpMode === 'registration') {
          if (titleEl) titleEl.textContent = 'Verification Successful';
          if (descEl) descEl.innerHTML = 'Your email has been verified successfully.<br><br>Your ASCENDRA account is ready.';
          if (enterAscendraBtn) {
            enterAscendraBtn.classList.remove('hidden');
            enterAscendraBtn.onclick = () => {
              this.hideModal(false);
              this.updateUrl('/play', true, true);
              if (window.playerApp && this.authenticatedUser) {
                window.playerApp.onAuthenticated(this.authenticatedUser);
              }
            };
          }
          if (continueResetBtn) continueResetBtn.classList.add('hidden');
        } else {
          if (titleEl) titleEl.textContent = 'Verification Successful!';
          if (descEl) descEl.textContent = 'Your email has been verified successfully.';
          if (enterAscendraBtn) enterAscendraBtn.classList.add('hidden');
          if (continueResetBtn) continueResetBtn.classList.remove('hidden');
          this.updateUrl('/forgot-password', false);
        }
        break;

      case 'reset-password':
        if (this.cardResetPassword) this.cardResetPassword.classList.remove('hidden');
        if (this.newPasswordInput) {
          this.newPasswordInput.value = '';
          this.newPasswordInput.focus();
        }
        if (this.confirmPasswordInput) this.confirmPasswordInput.value = '';
        this.updateCriteriaState('', '');
        this.updateUrl('/forgot-password', false);
        break;

      case 'reset-success':
        if (this.cardResetSuccess) this.cardResetSuccess.classList.remove('hidden');
        this.updateUrl('/forgot-password', false);
        break;

      case 'invalid-otp':
        if (this.cardInvalidOtp) this.cardInvalidOtp.classList.remove('hidden');
        this.updateUrl('/forgot-password', false);
        break;
    }
  },

  /**
   * Six individual OTP input boxes behavior:
   * Auto-advance, backspace navigation, paste handling, arrow navigation
   */
  setupOtpInputBehavior() {
    const updateVerifyBtnState = () => {
      const activeBoxes = this.getActiveOtpBoxes();
      const allFilled = activeBoxes.every(b => b && b.value.trim().length === 1);
      if (this.otpVerifyBtn) {
        this.otpVerifyBtn.disabled = !allFilled;
      }
    };

    this.otpBoxes.forEach((box, idx) => {
      if (!box) return;

      // Keydown handler: Backspace and Arrow keys
      box.addEventListener('keydown', (e) => {
        const activeBoxes = this.getActiveOtpBoxes();
        if (idx >= activeBoxes.length) return;

        if (e.key === 'Backspace') {
          if (!box.value && idx > 0) {
            e.preventDefault();
            activeBoxes[idx - 1].value = '';
            activeBoxes[idx - 1].classList.remove('filled');
            activeBoxes[idx - 1].focus();
          } else {
            box.classList.remove('filled');
          }
          setTimeout(updateVerifyBtnState, 10);
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault();
          activeBoxes[idx - 1].focus();
        } else if (e.key === 'ArrowRight' && idx < activeBoxes.length - 1) {
          e.preventDefault();
          activeBoxes[idx + 1].focus();
        }
      });

      // Input handler: single numeric digit entry & auto-advance
      box.addEventListener('input', (e) => {
        const activeBoxes = this.getActiveOtpBoxes();
        if (idx >= activeBoxes.length) return;

        const val = box.value.replace(/[^0-9]/g, '');
        if (val.length > 0) {
          box.value = val[val.length - 1]; // take the latest digit
          box.classList.add('filled');
          box.classList.remove('error');
          if (idx < activeBoxes.length - 1) {
            activeBoxes[idx + 1].focus();
          }
        } else {
          box.value = '';
          box.classList.remove('filled');
        }
        updateVerifyBtnState();
      });

      // Paste handler on any box
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const activeBoxes = this.getActiveOtpBoxes();
        const clipboardData = (e.clipboardData || window.clipboardData).getData('text');
        const digits = clipboardData.replace(/[^0-9]/g, '').slice(0, activeBoxes.length);

        if (digits.length > 0) {
          digits.split('').forEach((d, i) => {
            if (activeBoxes[i]) {
              activeBoxes[i].value = d;
              activeBoxes[i].classList.add('filled');
              activeBoxes[i].classList.remove('error');
            }
          });

          // Focus the next empty box or the last box
          const focusIndex = Math.min(digits.length, activeBoxes.length - 1);
          if (activeBoxes[focusIndex]) {
            activeBoxes[focusIndex].focus();
          }
        }
        updateVerifyBtnState();
      });
    });
  },

  /**
   * Password validation criteria checklist and visibility toggles
   */
  setupPasswordCriteriaValidation() {
    const checkCriteria = () => {
      const pw = this.newPasswordInput?.value || '';
      const confirm = this.confirmPasswordInput?.value || '';
      this.updateCriteriaState(pw, confirm);
    };

    if (this.newPasswordInput) {
      this.newPasswordInput.addEventListener('input', checkCriteria);
    }
    if (this.confirmPasswordInput) {
      this.confirmPasswordInput.addEventListener('input', checkCriteria);
    }

    // Visibility toggles
    if (this.toggleNewPasswordBtn && this.newPasswordInput) {
      this.toggleNewPasswordBtn.addEventListener('click', () => {
        const isPw = this.newPasswordInput.type === 'password';
        this.newPasswordInput.type = isPw ? 'text' : 'password';
        this.toggleNewPasswordBtn.textContent = isPw ? '🙈' : '👁️';
      });
    }

    if (this.toggleConfirmPasswordBtn && this.confirmPasswordInput) {
      this.toggleConfirmPasswordBtn.addEventListener('click', () => {
        const isPw = this.confirmPasswordInput.type === 'password';
        this.confirmPasswordInput.type = isPw ? 'text' : 'password';
        this.toggleConfirmPasswordBtn.textContent = isPw ? '🙈' : '👁️';
      });
    }
  },

  updateCriteriaState(pw, confirm) {
    const critLength = document.getElementById('pwCritLength');
    const critMix = document.getElementById('pwCritMix');
    const critMatch = document.getElementById('pwCritMatch');

    const hasLength = pw.length >= 6;
    const hasMix = /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
    const hasMatch = pw.length > 0 && pw === confirm;

    this.toggleCriterion(critLength, hasLength);
    this.toggleCriterion(critMix, hasMix);
    this.toggleCriterion(critMatch, hasMatch);
  },

  toggleCriterion(el, isValid) {
    if (!el) return;
    const checkSpan = el.querySelector('.criteria-check');
    if (isValid) {
      el.classList.add('valid');
      if (checkSpan) checkSpan.textContent = '✓';
    } else {
      el.classList.remove('valid');
      if (checkSpan) checkSpan.textContent = '○';
    }
  },

  /**
   * Countdown Timers:
   * 1. 60-second resend cooldown
   * 2. 10-minute (600s) OTP expiry countdown
   */
  startTimers() {
    this.clearTimers();

    // 1. Resend Cooldown (60s)
    let resendSeconds = 60;
    if (this.otpResendBtn) {
      this.otpResendBtn.disabled = true;
      this.otpResendBtn.textContent = `Resend OTP in ${resendSeconds}s`;
    }

    this.resendCooldownTimer = setInterval(() => {
      resendSeconds--;
      if (resendSeconds > 0) {
        if (this.otpResendBtn) {
          this.otpResendBtn.textContent = `Resend OTP in ${resendSeconds}s`;
        }
      } else {
        clearInterval(this.resendCooldownTimer);
        this.resendCooldownTimer = null;
        if (this.otpResendBtn) {
          this.otpResendBtn.disabled = false;
          this.otpResendBtn.textContent = 'Resend OTP';
        }
      }
    }, 1000);

    // 2. OTP Expiry Countdown (10m = 600s)
    let expirySeconds = 600;
    const updateExpiryDisplay = () => {
      const mins = Math.floor(expirySeconds / 60).toString().padStart(2, '0');
      const secs = (expirySeconds % 60).toString().padStart(2, '0');
      if (this.otpExpiryCountdown) {
        this.otpExpiryCountdown.textContent = `OTP expires in ${mins}:${secs}`;
      }
    };
    updateExpiryDisplay();

    this.otpExpiryTimer = setInterval(() => {
      expirySeconds--;
      if (expirySeconds > 0) {
        updateExpiryDisplay();
      } else {
        clearInterval(this.otpExpiryTimer);
        this.otpExpiryTimer = null;
        if (this.otpExpiryCountdown) {
          this.otpExpiryCountdown.textContent = 'OTP expired. Please request a new code.';
        }
        if (this.otpVerifyBtn) {
          this.otpVerifyBtn.disabled = true;
        }
      }
    }, 1000);

    if (this.otpVerifyBtn) {
      this.otpVerifyBtn.disabled = false;
    }
  },

  clearTimers() {
    if (this.resendCooldownTimer) {
      clearInterval(this.resendCooldownTimer);
      this.resendCooldownTimer = null;
    }
    if (this.otpExpiryTimer) {
      clearInterval(this.otpExpiryTimer);
      this.otpExpiryTimer = null;
    }
    if (this.fpCooldownTimer) {
      clearInterval(this.fpCooldownTimer);
      this.fpCooldownTimer = null;
    }
    if (this.fpSendOtpBtn) {
      this.fpSendOtpBtn.disabled = false;
      this.fpSendOtpBtn.textContent = 'Send OTP';
    }
  },

  startForgotPasswordCooldown(initialSeconds = 60) {
    if (this.fpCooldownTimer) {
      clearInterval(this.fpCooldownTimer);
      this.fpCooldownTimer = null;
    }

    let remaining = Math.max(1, parseInt(initialSeconds, 10) || 60);

    if (this.fpSendOtpBtn) {
      this.fpSendOtpBtn.disabled = true;
      this.fpSendOtpBtn.textContent = `Send OTP (${remaining}s)`;
    }

    this.showEmbossedAlert(
      `Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before requesting a new verification code.`,
      'warning'
    );

    this.fpCooldownTimer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        if (this.fpSendOtpBtn) {
          this.fpSendOtpBtn.textContent = `Send OTP (${remaining}s)`;
        }
        this.showEmbossedAlert(
          `Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before requesting a new verification code.`,
          'warning'
        );
      } else {
        clearInterval(this.fpCooldownTimer);
        this.fpCooldownTimer = null;
        if (this.fpSendOtpBtn) {
          this.fpSendOtpBtn.disabled = false;
          this.fpSendOtpBtn.textContent = 'Send OTP';
        }
        this.showEmbossedAlert('You can now request a new verification code.', 'success');
        setTimeout(() => {
          if (!this.fpCooldownTimer) {
            this.hideEmbossedAlert();
          }
        }, 3500);
      }
    }, 1000);
  },

  startResendCooldown(initialSeconds = 60) {
    if (this.resendCooldownTimer) {
      clearInterval(this.resendCooldownTimer);
      this.resendCooldownTimer = null;
    }

    let resendSeconds = Math.max(1, parseInt(initialSeconds, 10) || 60);
    if (this.otpResendBtn) {
      this.otpResendBtn.disabled = true;
      this.otpResendBtn.textContent = `Resend OTP in ${resendSeconds}s`;
    }

    this.resendCooldownTimer = setInterval(() => {
      resendSeconds--;
      if (resendSeconds > 0) {
        if (this.otpResendBtn) {
          this.otpResendBtn.textContent = `Resend OTP in ${resendSeconds}s`;
        }
      } else {
        clearInterval(this.resendCooldownTimer);
        this.resendCooldownTimer = null;
        if (this.otpResendBtn) {
          this.otpResendBtn.disabled = false;
          this.otpResendBtn.textContent = 'Resend OTP';
        }
      }
    }, 1000);
  },

  maskEmail(email) {
    if (!email || !email.includes('@')) return 'unknown';
    const [user, domain] = email.split('@');
    if (user.length <= 2) {
      return `${user[0]}*@${domain}`;
    }
    return `${user.substring(0, 2)}${'*'.repeat(Math.min(5, user.length - 2))}@${domain}`;
  },

  /* ========================================================================
     Action Handlers for Password Reset
     ======================================================================== */

  // 1. Request OTP
  async handleRequestOtp(e) {
    e.preventDefault();
    if (this.fpCooldownTimer) {
      return; // Countdown is running
    }
    const email = this.fpEmailInput?.value.trim();
    if (!email) {
      this.showEmbossedAlert('Please enter your registered Gmail address.');
      return;
    }

    // Enforce Gmail ID requirement
    const isGmail = /@(gmail\.com|googlemail\.com)$/i.test(email);
    if (!isGmail) {
      this.showEmbossedAlert('Only Gmail addresses (@gmail.com) are allowed for password reset.');
      return;
    }

    this.setButtonLoading(this.fpSendOtpBtn, true, 'Sending Code...');
    this.hideEmbossedAlert();

    try {
      await window.playerApi.requestPasswordResetOtp(email);
      this.resetEmail = email;
      this.otpMode = 'forgot-password';
      this.setAuthState('otp-verification');
    } catch (err) {
      this.setButtonLoading(this.fpSendOtpBtn, false, 'Send OTP');
      const waitMatch = (err.message || '').match(/(\d+)\s+seconds/i);
      const waitSeconds = err.waitSeconds || (waitMatch ? parseInt(waitMatch[1], 10) : 0);

      if (err.code === 'COOLDOWN_ACTIVE' || waitSeconds > 0) {
        this.startForgotPasswordCooldown(waitSeconds || 60);
      } else {
        this.showEmbossedAlert(err.message || 'Unable to send verification code. Please try again.');
      }
    }
  },

  // 2. Verify OTP
  async handleVerifyOtp(e) {
    e.preventDefault();
    const isRegistration = this.otpMode === 'registration';
    const activeBoxes = this.getActiveOtpBoxes();
    const requiredLength = isRegistration ? 6 : 5;
    const otp = activeBoxes.map(b => b.value.trim()).join('');

    const otpRegex = isRegistration ? /^\d{6}$/ : /^\d{5}$/;
    if (otp.length !== requiredLength || !otpRegex.test(otp)) {
      this.showEmbossedAlert(`Please enter all ${requiredLength} digits of your verification code.`);
      return;
    }

    this.setButtonLoading(this.otpVerifyBtn, true, 'Verifying...');
    this.hideEmbossedAlert();

    // A. Registration OTP Verification
    if (this.otpMode === 'registration') {
      try {
        const res = await window.playerApi.verifyEmail(this.regEmail, otp);
        const user = res.user || res.data?.user;
        const accessToken = res.accessToken || res.data?.accessToken;
        const refreshToken = res.refreshToken || res.data?.refreshToken;
        if (accessToken) {
          window.playerApi.setSession({ accessToken, refreshToken }, user);
        }
        this.authenticatedUser = user;

        this.setAuthState('otp-verified');
      } catch (err) {
        this.otpBoxes.forEach(b => b?.classList.add('error'));
        if (err.code === 'MAX_ATTEMPTS_EXCEEDED') {
          this.showEmbossedAlert('Too many incorrect attempts. Please request a new verification code.');
        } else if (err.code === 'EXPIRED_OTP') {
          this.showEmbossedAlert('This verification code has expired. Please request a new code.');
        } else if (err.code === 'INVALID_OTP') {
          this.showEmbossedAlert('Invalid verification code. Please try again.');
        } else if (err.message && err.message.includes('unavailable')) {
          this.showEmbossedAlert('Email verification is temporarily unavailable. Please try again later.');
        } else {
          this.showEmbossedAlert(err.message || 'Invalid verification code. Please try again.');
        }
      } finally {
        this.setButtonLoading(this.otpVerifyBtn, false, 'VERIFY EMAIL');
      }
      return;
    }

    // B. Password Reset OTP Verification (Existing)
    try {
      const res = await window.playerApi.verifyPasswordResetOtp(this.resetEmail, otp);
      this.resetToken = res.resetToken || res.data?.resetToken;

      if (!this.resetToken) {
        throw new Error('Verification failed: no authorization token issued.');
      }

      this.setAuthState('otp-verified');
      // Automatically transition smoothly to Set New Password after 1.2 seconds
      setTimeout(() => {
        if (this.currentState === 'otp-verified') {
          this.setAuthState('reset-password');
        }
      }, 1200);
    } catch (err) {
      // Mark boxes with error class
      this.otpBoxes.forEach(b => b?.classList.add('error'));
      if (err.code === 'MAX_ATTEMPTS_EXCEEDED') {
        if (this.invalidOtpMessage) {
          this.invalidOtpMessage.textContent = 'Too many incorrect attempts. Please request a new verification code.';
        }
        this.setAuthState('invalid-otp');
      } else if (err.code === 'EXPIRED_OTP') {
        this.showEmbossedAlert('This verification code has expired. Please request a new code.');
      } else {
        this.showEmbossedAlert(err.message || 'Invalid verification code. Please try again.');
      }
    } finally {
      this.setButtonLoading(this.otpVerifyBtn, false, 'VERIFY OTP');
    }
  },

  // 3. Resend OTP
  async handleResendOtp() {
    if (this.otpMode === 'registration') {
      if (!this.regEmail) return;
      this.setButtonLoading(this.otpResendBtn, true, 'Sending...');
      this.hideEmbossedAlert();
      try {
        await window.playerApi.resendEmailVerification(this.regEmail);
        this.showEmbossedAlert('New verification code sent to your Gmail address.', 'success');
        this.startTimers();
        this.otpBoxes.forEach(b => {
          if (b) {
            b.value = '';
            b.classList.remove('filled', 'error');
          }
        });
        if (this.otpBoxes[0]) this.otpBoxes[0].focus();
      } catch (err) {
        if (err.code === 'COOLDOWN_ACTIVE') {
          this.showEmbossedAlert('Please wait before requesting another code.');
        } else if (err.message && err.message.includes('unavailable')) {
          this.showEmbossedAlert('Email verification is temporarily unavailable. Please try again later.');
        } else {
          this.showEmbossedAlert(err.message || 'Could not resend code. Please try again.');
        }
      } finally {
        this.setButtonLoading(this.otpResendBtn, false, 'Resend code in 60s');
      }
      return;
    }

    if (!this.resetEmail) return;

    this.setButtonLoading(this.otpResendBtn, true, 'Sending...');
    this.hideEmbossedAlert();

    try {
      await window.playerApi.requestPasswordResetOtp(this.resetEmail);
      this.showEmbossedAlert('New verification code sent to your email.', 'success');
      this.startTimers();
      // Clear OTP boxes
      this.otpBoxes.forEach(b => {
        if (b) {
          b.value = '';
          b.classList.remove('filled', 'error');
        }
      });
      if (this.otpBoxes[0]) this.otpBoxes[0].focus();
    } catch (err) {
      const waitMatch = (err.message || '').match(/(\d+)\s+seconds/i);
      const waitSeconds = err.waitSeconds || (waitMatch ? parseInt(waitMatch[1], 10) : 0);
      if (err.code === 'COOLDOWN_ACTIVE' || waitSeconds > 0) {
        this.startResendCooldown(waitSeconds || 60);
        this.showEmbossedAlert(`Please wait ${waitSeconds || 60} seconds before requesting another code.`, 'warning');
      } else {
        this.showEmbossedAlert(err.message || 'Could not resend code. Please try again.');
      }
    } finally {
      this.setButtonLoading(this.otpResendBtn, false, 'Resend OTP');
    }
  },

  // 4. Reset Password
  async handleResetPassword(e) {
    e.preventDefault();
    const newPassword = this.newPasswordInput?.value;
    const confirmPassword = this.confirmPasswordInput?.value;

    if (!newPassword || newPassword.length < 6) {
      this.showEmbossedAlert('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showEmbossedAlert('Passwords do not match. Please re-enter.');
      return;
    }

    if (!this.resetToken) {
      this.showEmbossedAlert('Missing reset authorization. Please restart the verification flow.');
      return;
    }

    this.setButtonLoading(this.resetPasswordSubmitBtn, true, 'Updating Password...');
    this.hideEmbossedAlert();

    try {
      await window.playerApi.resetPassword(this.resetToken, newPassword, confirmPassword);
      this.resetToken = null;
      this.setAuthState('reset-success');
    } catch (err) {
      this.showEmbossedAlert(err.message || 'Failed to update password. Please try again.');
    } finally {
      this.setButtonLoading(this.resetPasswordSubmitBtn, false, 'Reset Password');
    }
  },

  /* ========================================================================
     Standard Authentication Handlers (Preserved 100%)
     ======================================================================== */
  async handleSignin(e) {
    e.preventDefault();
    const email = document.getElementById('signinEmail')?.value.trim();
    const password = document.getElementById('signinPassword')?.value;
    const submitBtn = document.getElementById('signinSubmitBtn');

    if (!email || !password) {
      this.showAlert('Please provide both Gmail address and password.');
      return;
    }

    const parts = email.split('@');
    if (parts.length !== 2) {
      this.showAlert('Please enter a valid Gmail address.');
      return;
    }

    const username = parts[0];
    const domain = parts[1].toLowerCase();

    if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
      this.showAlert('Only Gmail addresses (@gmail.com) are allowed for sign in.');
      return;
    }

    if (username.length < 6) {
      this.showAlert('Gmail username must be at least 6 characters long.');
      return;
    }

    this.setButtonLoading(submitBtn, true, 'Signing In...');
    this.hideAlert();

    try {
      const data = await window.playerApi.login(email, password);
      window.playerApi.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }, data.user);

      this.hideModal(false);
      this.updateUrl('/play', true, true);
      if (window.playerApp) {
        window.playerApp.onAuthenticated(data.user);
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED' || err.message?.includes('verify your email')) {
        this.showAlert('Please verify your email address before signing in.', 'warning');
        const resendContainer = document.createElement('div');
        resendContainer.style.marginTop = '10px';
        const resendBtn = document.createElement('button');
        resendBtn.type = 'button';
        resendBtn.className = 'game-btn game-btn-secondary';
        resendBtn.style.fontSize = '0.82rem';
        resendBtn.style.padding = '5px 12px';
        resendBtn.textContent = 'Resend Verification Code';
        resendBtn.onclick = async () => {
          this.setButtonLoading(resendBtn, true, 'Resending...');
          try {
            await window.playerApi.resendEmailVerification(email);
            this.regEmail = email;
            this.resetEmail = email;
            this.otpMode = 'registration';
            this.setAuthState('otp-verification');
            this.showEmbossedAlert('New verification code sent to your Gmail address.', 'success');
          } catch (resendErr) {
            this.showAlert(resendErr.message || 'Could not resend code. Please wait before trying again.');
          } finally {
            this.setButtonLoading(resendBtn, false, 'Resend Verification Code');
          }
        };
        resendContainer.appendChild(resendBtn);
        if (this.authAlert) {
          this.authAlert.appendChild(resendContainer);
        }
      } else if (err.code === 'ACCOUNT_NOT_FOUND') {
        this.showAlert('No ASCENDRA account found with this Gmail address. Please register first.');
      } else {
        this.showAlert(err.message || 'Login failed. Please verify your credentials.');
      }
    } finally {
      this.setButtonLoading(submitBtn, false, 'Enter ASCENDRA');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim();
    const password = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
    const submitBtn = document.getElementById('registerSubmitBtn');

    if (!name || !email || !password) {
      this.showAlert('All fields are required to begin your journey.');
      return;
    }

    if (name.length < 2) {
      this.showAlert('Explorer name must be at least 2 characters long.');
      return;
    }

    const parts = email.split('@');
    if (parts.length !== 2) {
      this.showAlert('Please enter a valid Gmail address.');
      return;
    }

    const username = parts[0];
    const domain = parts[1].toLowerCase();

    if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
      this.showAlert('Only Gmail addresses (@gmail.com) are allowed for registration.');
      return;
    }

    if (username.length < 6 || username.length > 30) {
      this.showAlert('Gmail username must be between 6 and 30 characters long.');
      return;
    }

    if (!/^[a-z0-9.]+$/i.test(username)) {
      this.showAlert('Gmail username can only contain letters (a-z), numbers (0-9), and periods (.).');
      return;
    }

    if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
      this.showAlert('Gmail username cannot start, end, or contain consecutive periods.');
      return;
    }

    if (password.length < 8) {
      this.showAlert('Password must be at least 8 characters long.');
      return;
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      this.showAlert('Passwords do not match. Please re-enter.');
      return;
    }

    this.setButtonLoading(submitBtn, true, 'Sending Verification Code...');
    this.hideAlert();

    try {
      await window.playerApi.sendEmailVerification(email, password, name, confirmPassword);
      this.regEmail = email;
      this.regName = name;
      this.resetEmail = email;
      this.otpMode = 'registration';
      this.setAuthState('otp-verification');
      this.showEmbossedAlert('Verification code sent! Please check your Gmail inbox.', 'success');
    } catch (err) {
      if (err.code === 'EMAIL_ALREADY_EXISTS') {
        this.showAlert('An account with this Gmail address already exists. Please sign in.');
      } else {
        this.showAlert(err.message || 'Registration could not be initiated.');
      }
    } finally {
      this.setButtonLoading(submitBtn, false, 'Create Account');
    }
  },

  async initFirebaseAuth() {
    if (typeof firebase === 'undefined') return;
    const config = window.ASCENDRA_PLAYER_CONFIG?.FIREBASE_CONFIG;
    if (!config || !config.apiKey) return;

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
    } catch (err) {
      console.warn('Firebase initialization notice:', err.message);
    }
  },

  async handleGoogleLogin() {
    await this.triggerFirebasePopupLogin();
  },

  async triggerFirebasePopupLogin() {
    if (typeof firebase === 'undefined') {
      this.showAlert('Authentication service is loading. Please check network connectivity.', 'warning');
      return;
    }

    const config = window.ASCENDRA_PLAYER_CONFIG?.FIREBASE_CONFIG;
    if (!config || !config.apiKey) {
      this.showAlert('Firebase Web API Key is pending in frontend/player/config.js.', 'warning');
      return;
    }

    this.setButtonLoading(this.googleLoginBtn, true, 'Opening Google...');
    this.hideAlert();

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await firebase.auth().signInWithPopup(provider);

      this.setButtonLoading(this.googleLoginBtn, true, 'Attuning explorer credentials...');

      // Extract verified Google ID token
      const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
      const idToken = credential?.idToken || (await result.user.getIdToken());

      const data = await window.playerApi.loginWithGoogle(idToken);
      window.playerApi.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }, data.user);

      this.hideModal(false);
      this.updateUrl('/play', true, true);
      if (window.playerApp) {
        window.playerApp.onAuthenticated(data.user);
      }

      // Clear transient popup polling notices from DevTools console
      if (typeof console !== 'undefined' && console.clear) {
        console.clear();
        console.log(`⚔️ Welcome to ASCENDRA, ${data.user.name}! Expedition session attuned.`);
      }
    } catch (err) {
      console.error('Firebase Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        this.showAlert('Google Sign-In was closed. If the popup was blank, click the 👁️ in the address bar to allow cookies, or retry.', 'warning');
      } else if (err.code === 'auth/unauthorized-domain') {
        this.showAlert('This domain is not authorized in Firebase Console -> Authentication -> Authorised domains.', 'danger');
      } else {
        this.showAlert(err.message || 'Google authentication could not be completed.', 'danger');
      }
    } finally {
      this.setButtonLoading(this.googleLoginBtn, false, 'Continue with Google');
    }
  },

  async logout() {
    await window.playerApi.logout();
    this.hideModal(false);
    this.updateUrl('/', true);
    if (window.playerSplash) {
      window.playerSplash.showSplash();
    } else {
      window.location.reload();
    }
  },

  setButtonLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = text;
  }
};

window.playerAuth = playerAuth;
