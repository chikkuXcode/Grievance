const nodemailer = require("nodemailer");

/**
 * Send a generic email via Brevo SMTP
 * @param {string} to - Recipient email
 * @param {string} toName - Recipient name
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 */
const sendMail = async (to, toName, subject, html) => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT || 465;
  const user = process.env.SMTP_USER || "doraemonxdev@gmail.com";
  const pass = process.env.SMTP_PASS || "xtgx assk wtju lojh"; // Use SMTP_PASS or fall back to BREVO_API_KEY
  const fromEmail = process.env.MAIL_FROM_EMAIL || "chiks0950@gmail.com";
  const fromName = process.env.MAIL_FROM_NAME || "Grievance.io";

  if (!pass) {
    console.warn(
      "[Mailer] SMTP Password (or Brevo API Key) not configured — set SMTP_PASS in .env to enable emails.",
    );
    return {
      success: false,
      message: "Email not configured. Set SMTP_PASS in .env",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: true, // Use true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: `"${toName || to}" <${to}>`,
      subject,
      html,
    });

    console.log(
      `[Mailer] Email sent to ${to} via SMTP. MessageId: ${info.messageId}`,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Mailer] SMTP Error:", error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Send case resolved notification to student
 */
const sendResolutionEmail = async (
  studentEmail,
  studentName,
  caseId,
  subject,
  remark,
) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; background: #f5f5f7; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.08); }
        .header { background: #000; padding: 32px 40px; text-align: center; }
        .header h1 { color: #fff; font-size: 22px; margin: 0; letter-spacing: -0.5px; }
        .header p { color: #888; font-size: 12px; margin: 4px 0 0; }
        .body { padding: 40px; }
        .badge { display: inline-block; background: #ECFDF5; color: #059669; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px; }
        h2 { font-size: 20px; color: #111; margin: 0 0 8px; }
        p { color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 16px; }
        .case-box { background: #f9f9f9; border: 1px solid #eee; border-radius: 16px; padding: 20px 24px; margin: 24px 0; }
        .case-box .label { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.05em; }
        .case-box .value { font-size: 14px; font-weight: 600; color: #111; margin-top: 2px; margin-bottom: 12px; }
        .remark-box { background: #F0FDF4; border-left: 4px solid #22C55E; padding: 16px 20px; border-radius: 0 12px 12px 0; margin: 20px 0; }
        .remark-box p { color: #166534; margin: 0; font-size: 13px; }
        .footer { background: #f5f5f7; padding: 24px 40px; text-align: center; }
        .footer p { color: #aaa; font-size: 11px; margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Grievance.io</h1>
          <p>University Grievance Management System</p>
        </div>
        <div class="body">
          <span class="badge">&#10003; Case Resolved</span>
          <h2>Your grievance has been resolved!</h2>
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>We're happy to inform you that your grievance has been reviewed and successfully resolved by our team.</p>

          <div class="case-box">
            <div class="label">Case ID</div>
            <div class="value">#${caseId}</div>
            <div class="label">Subject</div>
            <div class="value">${subject}</div>
          </div>

          <div class="remark-box">
            <p><strong>Resolution Note:</strong> ${remark || "Your case has been resolved. Thank you for your patience."}</p>
          </div>

          <p>If you feel the issue has not been fully addressed, you may reopen the case or file a new grievance through the student portal.</p>
          <p>Thank you for using Grievance.io.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p style="margin-top:8px;">&#169; ${new Date().getFullYear()} University Grievance System</p>
        </div>
      </div>
    </body>
    </html>`;

  return sendMail(
    studentEmail,
    studentName,
    `Case #${caseId} Resolved - Grievance.io`,
    html,
  );
};

/**
 * Send password reset OTP email
 */
const sendPasswordResetEmail = async (email, name, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; background: #f5f5f7; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.08); }
        .header { background: #000; padding: 32px 40px; text-align: center; }
        .header h1 { color: #fff; font-size: 22px; margin: 0; }
        .header p { color: #888; font-size: 12px; margin: 4px 0 0; }
        .body { padding: 40px; text-align: center; }
        h2 { font-size: 20px; color: #111; margin: 0 0 8px; }
        p { color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 16px; }
        .otp-box { background: #000; color: #fff; font-size: 36px; font-weight: 700; letter-spacing: 12px; padding: 24px 40px; border-radius: 16px; display: inline-block; margin: 24px 0; font-family: monospace; }
        .warning { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px; padding: 14px 20px; font-size: 12px; color: #92400E; margin-top: 20px; }
        .footer { background: #f5f5f7; padding: 24px 40px; text-align: center; }
        .footer p { color: #aaa; font-size: 11px; margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Grievance.io</h1>
          <p>University Grievance Management System</p>
        </div>
        <div class="body">
          <h2>Password Reset OTP</h2>
          <p>Hi <strong>${name || "User"}</strong>, use the OTP below to reset your password.</p>
          <div class="otp-box">${otp}</div>
          <p>This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <div class="warning">&#9888;&#65039; If you did not request a password reset, please ignore this email. Your account is safe.</div>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply.</p>
          <p style="margin-top:8px;">&#169; ${new Date().getFullYear()} University Grievance System</p>
        </div>
      </div>
    </body>
    </html>`;

  return sendMail(
    email,
    name || "User",
    "Password Reset OTP - Grievance.io",
    html,
  );
};

module.exports = { sendMail, sendResolutionEmail, sendPasswordResetEmail };
