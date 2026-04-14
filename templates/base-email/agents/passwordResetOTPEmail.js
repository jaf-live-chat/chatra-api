const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const passwordResetOTPEmail = ({
    companyCode = "",
    email = "",
    otp = "",
    expiresInMinutes = 10,
    resetUrl = "",
}) => {
    const escapedCompanyCode = escapeHtml(companyCode);
  const escapedEmail = escapeHtml(email);
  const escapedOTP = escapeHtml(otp);
    const escapedResetUrl = escapeHtml(resetUrl);

  return `
    <h2 style="font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: rgb(15, 23, 42); margin: 0 0 8px 0; line-height: 1.3;">
        Password Reset Request
    </h2>
    <p style="font-family: Arial, sans-serif; font-size: 15px; color: rgb(71, 85, 105); margin: 0 0 12px 0; line-height: 1.75;">
        We received a request to reset the password for your JAF Chatra account associated with <strong style="color: rgb(15, 23, 42);">${escapedEmail}</strong>.
    </p>
        ${escapedCompanyCode
            ? `<p style="font-family: Arial, sans-serif; font-size: 13px; color: rgb(71, 85, 105); margin: 0 0 12px 0; line-height: 1.75;">
                Company Code: <strong style="color: rgb(15, 23, 42);">${escapedCompanyCode}</strong>
            </p>`
            : ""
        }
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: rgb(100, 116, 139); margin: 0 0 28px 0; line-height: 1.7;">
        Use the One-Time Password (OTP) below to verify your identity and reset your password. This code will expire in ${expiresInMinutes} minutes.
    </p>

    <div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

    <div style="border-radius: 10px; overflow: hidden; border: 1px solid rgb(186, 230, 253); margin-bottom: 32px; background-color: rgb(240, 249, 255); padding: 28px;">
        <p style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase; margin: 0 0 12px 0;">Your One-Time Password</p>
        <div style="background-color: rgb(255, 255, 255); border-radius: 8px; padding: 20px; text-align: center;">
            <span style="font-family: monospace; font-size: 40px; font-weight: bold; color: rgb(6, 182, 212); letter-spacing: 8px;">${escapedOTP}</span>
        </div>
        <p style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); margin: 12px 0 0 0; text-align: center;">Valid for ${expiresInMinutes} minutes</p>
    </div>

    <div style="background-color: rgb(248, 250, 252); border-radius: 8px; border-left: 4px solid rgb(251, 146, 60); padding: 16px; margin-bottom: 28px;">
        <p style="font-family: Arial, sans-serif; font-size: 13px; color: rgb(15, 23, 42); margin: 0; font-weight: 600;">Security Notice</p>
        <p style="font-family: Arial, sans-serif; font-size: 12px; color: rgb(100, 116, 139); margin: 6px 0 0 0; line-height: 1.6;">
            If you did not request a password reset, please ignore this email or contact our support team. Do not share this OTP with anyone.
        </p>
    </div>

        ${escapedResetUrl
            ? `<div style="margin-bottom: 28px; text-align: center;">
                <a href="${escapedResetUrl}" style="display: inline-block; border-radius: 8px; background-color: rgb(8, 145, 178); color: rgb(255, 255, 255); text-decoration: none; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; padding: 12px 20px;">
                    Reset Password
                </a>
                <p style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); margin: 10px 0 0 0; line-height: 1.6;">
                    This button opens the reset password page. You still need the OTP above to finish the password reset.
                </p>
            </div>`
            : ""
        }

    <div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

    <p style="font-family: Arial, sans-serif; font-size: 12px; color: rgb(100, 116, 139); margin: 0;">
        If you have any questions, please don't hesitate to reach out to our support team. We're here to help!
    </p>
  `;
};

export default passwordResetOTPEmail;
