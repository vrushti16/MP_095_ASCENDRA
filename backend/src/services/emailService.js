const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// In-memory test store for automated testing isolation
let testSentEmails = [];
let customTransport = null;

/**
 * Cleanly extract value stripping whitespace and surrounding quotes
 * @param {string} val
 * @returns {string}
 */
function cleanEnv(val) {
  if (!val) return '';
  return val.toString().trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Extract clean email address from string that may contain "Name <email@domain>"
 * @param {string} val
 * @returns {string}
 */
function extractEmailAddress(val) {
  const cleaned = cleanEnv(val);
  const match = cleaned.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return cleaned;
}

/**
 * Resolve effective SMTP configuration from environment variables
 */
function getSmtpConfig() {
  const host = cleanEnv(process.env.SMTP_HOST) || 'smtp.gmail.com';
  const port = parseInt(cleanEnv(process.env.SMTP_PORT), 10) || 587;
  const pass = cleanEnv(process.env.SMTP_PASSWORD);

  const rawUser = cleanEnv(process.env.SMTP_USER);
  const rawAuthUser = cleanEnv(process.env.SMTP_AUTH_USER);
  const rawFromEmail = cleanEnv(process.env.SMTP_FROM_EMAIL) || cleanEnv(process.env.EMAIL_FROM);
  const rawFromName = cleanEnv(process.env.SMTP_FROM_NAME);

  // Determine actual authentication username (must be a valid email for Gmail SMTP)
  let authUser = '';
  if (rawAuthUser && rawAuthUser.includes('@')) {
    authUser = rawAuthUser;
  } else if (rawUser && rawUser.includes('@')) {
    authUser = rawUser;
  } else if (rawFromEmail && rawFromEmail.includes('@')) {
    authUser = extractEmailAddress(rawFromEmail);
  } else {
    authUser = rawUser;
  }

  // Determine sender display name and from email
  let fromEmail = extractEmailAddress(rawFromEmail) || authUser;
  let fromName = rawFromName || (rawUser && !rawUser.includes('@') ? rawUser : 'ASCENDRA SMTP');

  let fromHeader = '';
  if (fromName && fromEmail) {
    fromHeader = `"${fromName}" <${fromEmail}>`;
  } else {
    fromHeader = fromEmail || 'ASCENDRA <noreply@ascendra.game>';
  }

  const isConfigured = Boolean(authUser && authUser !== '' && pass && pass !== '');

  return {
    host,
    port,
    secure: port === 465,
    authUser,
    authPass: pass,
    fromHeader,
    isConfigured
  };
}

/**
 * Check whether SMTP credentials are affirmatively configured in backend/.env
 * @returns {boolean}
 */
function isEmailConfigured() {
  const config = getSmtpConfig();
  return config.isConfigured;
}

/**
 * Mask an email address for safe logging without exposing full PII
 * @param {string} email
 * @returns {string} e.g. "ex*****@gmail.com"
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return 'unknown';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  return `${user.substring(0, 2)}${'*'.repeat(Math.min(5, user.length - 2))}@${domain}`;
}

/**
 * Obtain an active nodemailer transporter instance
 */
function getTransporter() {
  if (customTransport) {
    return customTransport;
  }

  const { host, port, secure, authUser, authPass } = getSmtpConfig();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: authUser,
      pass: authPass
    },
    // Useful timeout limits
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

/**
 * Safe startup diagnostic check: logs SMTP status WITHOUT revealing passwords
 * @returns {Promise<{ ok: boolean, status: string }>}
 */
async function checkSmtpConfiguration() {
  const config = getSmtpConfig();

  if (!config.isConfigured) {
    console.log(`📧 [EMAIL SERVICE] SMTP Configuration Detected: NO (Running without live email delivery)`);
    return { ok: false, status: 'unconfigured' };
  }

  console.log(`📧 [EMAIL SERVICE] SMTP Configuration Detected: YES`);
  console.log(`📡 [EMAIL SERVICE] Provider: ${config.host}:${config.port} | Auth User: ${maskEmail(config.authUser)} | From: ${config.fromHeader}`);

  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log(`✅ [EMAIL SERVICE] SMTP connection verified successfully.`);
    return { ok: true, status: 'connected' };
  } catch (err) {
    console.warn(`⚠️ [EMAIL SERVICE] SMTP connection verification notice: ${err.message}`);
    return { ok: false, status: 'verification_failed', error: err.message };
  }
}

/**
 * Send 6-digit password reset OTP email to user's registered inbox
 * @param {{ toEmail: string, otpCode: string, playerName?: string }} param0
 * @returns {Promise<{ delivered: boolean, messageId?: string }>}
 */
async function sendPasswordResetOtpEmail({ toEmail, otpCode, playerName = 'Explorer' }) {
  if (!toEmail || !otpCode) {
    throw new Error('toEmail and otpCode are required to send verification email');
  }

  // 1. In test environment, record in memory for assertions (never attempt outbound network calls to test emails)
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_LIVE_SMTP) {
    testSentEmails.push({
      to: toEmail,
      subject: 'ASCENDRA Password Reset Verification Code',
      otpCode,
      playerName,
      sentAt: new Date()
    });
    return { delivered: true, messageId: `test-mock-${Date.now()}` };
  }

  // 2. In real browser flow, if SMTP is not configured, reject with clear configuration error
  if (!isEmailConfigured()) {
    throw new Error(
      'Email service is not configured. Please configure SMTP credentials (SMTP_USER, SMTP_PASSWORD) in backend/.env to send real verification emails.'
    );
  }

  const { fromHeader } = getSmtpConfig();
  const from = fromHeader;
  const subject = 'ASCENDRA Password Reset Verification Code';

  // Plaintext content matching specification (Requirement 14)
  const textContent = `Hello ${playerName},\n\n` +
    `We received a request to reset your ASCENDRA password.\n\n` +
    `Your verification code is:\n\n` +
    `    ${otpCode}\n\n` +
    `This code expires in 10 minutes.\n\n` +
    `If you did not request this password reset, you can safely ignore this email.\n\n` +
    `ASCENDRA\n` +
    `Your Adventure. Your Knowledge. Your Journey.`;

  // HTML content with rich ASCENDRA fantasy styling
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9;">
  <div style="max-width: 520px; margin: 0 auto; background: #16223b; border: 1px solid #334155; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 38px; line-height: 1; margin-bottom: 8px;">⚔️</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #38bdf8; letter-spacing: 2px;">ASCENDRA</h1>
      <p style="margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #94a3b8;">The Lost Realms</p>
    </div>

    <div style="background: #111a2e; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #f1f5f9;">Hello <strong>${playerName}</strong>,</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
        We received a request to reset the password for your ASCENDRA expedition account. Use the verification code below to proceed:
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #090d16; border: 2px solid #38bdf8; border-radius: 12px; padding: 14px 28px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);">
          ${otpCode}
        </div>
      </div>

      <p style="margin: 0; font-size: 13px; color: #f59e0b; text-align: center;">
        ⏳ This code expires in <strong>10 minutes</strong> and can only be used once.
      </p>
    </div>

    <p style="margin: 0 0 20px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
      If you did not request this password reset, no further action is required. Your account remains secure.
    </p>

    <div style="border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; font-size: 11px; color: #64748b;">
      <p style="margin: 0;">ASCENDRA — Your Adventure. Your Knowledge. Your Journey.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Log dispatch without exposing the plaintext OTP
  console.log(`📧 [EMAIL] Dispatching password reset verification email to ${maskEmail(toEmail)}`);

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text: textContent,
    html: htmlContent
  });

  return { delivered: true, messageId: info.messageId };
}

/**
 * Send 6-digit registration verification OTP email to Explorer's Gmail address
 * @param {{ toEmail: string, otpCode: string, playerName?: string }} param0
 */
async function sendRegistrationOtpEmail({ toEmail, otpCode, playerName = 'Explorer' }) {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_LIVE_SMTP) {
    testSentEmails.push({
      to: toEmail,
      otpCode,
      subject: 'ASCENDRA — Verify Your Email',
      type: 'registration_otp',
      sentAt: new Date()
    });
    return { delivered: true, messageId: `test-registration-${Date.now()}` };
  }

  if (!isEmailConfigured()) {
    throw new Error(
      'Email service is not configured. Please configure SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) in backend/.env to send verification emails.'
    );
  }

  const { fromHeader } = getSmtpConfig();
  const from = fromHeader;
  const subject = 'ASCENDRA — Verify Your Email';

  const textContent = `ASCENDRA\n` +
    `Verify Your Email\n\n` +
    `Welcome, Explorer!\n\n` +
    `Use the verification code below to verify your email address:\n\n` +
    `  ${otpCode}\n\n` +
    `This code expires in 10 minutes.\n\n` +
    `If you did not create an ASCENDRA account, you can safely ignore this email.\n\n` +
    `ASCENDRA\n` +
    `Your Adventure. Your Knowledge. Your Journey.`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9;">
  <div style="max-width: 520px; margin: 0 auto; background: #16223b; border: 1px solid #334155; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 38px; line-height: 1; margin-bottom: 8px;">⚔️</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #38bdf8; letter-spacing: 2px;">ASCENDRA</h1>
      <p style="margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #94a3b8;">Verify Your Email</p>
    </div>

    <div style="background: #111a2e; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #f1f5f9;">Welcome, <strong>${playerName}</strong>!</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
        Use the verification code below to verify your email address:
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; background: #090d16; border: 2px solid #38bdf8; border-radius: 12px; padding: 14px 28px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);">
          ${otpCode}
        </div>
      </div>

      <p style="margin: 0; font-size: 13px; color: #f59e0b; text-align: center;">
        ⏳ This code expires in <strong>10 minutes</strong>.
      </p>
    </div>

    <p style="margin: 0 0 20px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
      If you did not create an ASCENDRA account, you can safely ignore this email.
    </p>

    <div style="border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; font-size: 11px; color: #64748b;">
      <p style="margin: 0;">ASCENDRA — Your Adventure. Your Knowledge. Your Journey.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  console.log(`📧 [EMAIL] Dispatching registration verification code to ${maskEmail(toEmail)}`);

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text: textContent,
    html: htmlContent
  });

  return { delivered: true, messageId: info.messageId };
}

/**
 * Send informational notice to Google OAuth registered user
 * @param {{ toEmail: string, playerName?: string }} param0
 */
async function sendGoogleAccountNoticeEmail({ toEmail, playerName = 'Explorer' }) {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_LIVE_SMTP) {
    testSentEmails.push({
      to: toEmail,
      subject: 'ASCENDRA Account Notice: Sign in with Google',
      type: 'google_notice',
      sentAt: new Date()
    });
    return { delivered: true, messageId: `test-notice-${Date.now()}` };
  }

  if (!isEmailConfigured()) {
    // If SMTP is not configured, do not crash on notice
    return { delivered: false };
  }

  const { fromHeader } = getSmtpConfig();
  const from = fromHeader;
  const subject = 'ASCENDRA Account Notice: Sign in with Google';

  const textContent = `Hello ${playerName},\n\n` +
    `We received a request to reset your ASCENDRA account password.\n\n` +
    `Your account is registered directly through Google OAuth and does not utilize a separate password.\n\n` +
    `To sign in to ASCENDRA, please return to the login screen and select "Continue with Google".\n\n` +
    `ASCENDRA\n` +
    `Your Adventure. Your Knowledge. Your Journey.`;

  console.log(`📧 [EMAIL] Dispatching Google-only account notice to ${maskEmail(toEmail)}`);

  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text: textContent
  });

  return { delivered: true };
}

/**
 * Test utility helpers for automated Jest test suites
 */
function setTestTransport(transport) {
  customTransport = transport;
}

function getSentEmailsForTesting() {
  return [...testSentEmails];
}

function clearTestEmails() {
  testSentEmails = [];
}

module.exports = {
  getSmtpConfig,
  isEmailConfigured,
  maskEmail,
  checkSmtpConfiguration,
  sendPasswordResetOtpEmail,
  sendRegistrationOtpEmail,
  sendGoogleAccountNoticeEmail,
  setTestTransport,
  getSentEmailsForTesting,
  clearTestEmails
};
