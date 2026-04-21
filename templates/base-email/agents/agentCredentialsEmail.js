const escapeHtml = (value = "") =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

const formatRoleLabel = (role = "") =>
    String(role)
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const agentCredentialsEmail = ({ agentData = {}, createBy = {} }) => {
    const fullName = escapeHtml(agentData.fullName || "Agent");
    const emailAddress = escapeHtml(agentData.emailAddress || "");
    const password = escapeHtml(agentData.password || "");
    const companyCode = escapeHtml(
        agentData.companyCode || createBy.companyCode || "N/A",
    );
    const role = escapeHtml(formatRoleLabel(agentData.role) || "Support Agent");
    const creatorName = escapeHtml(
        createBy.fullName || createBy.name || "Your administrator",
    );
    const loginUrl = escapeHtml(
        process.env.AGENT_LOGIN_URL || process.env.APP_LOGIN_URL || "#",
    );

    return `
        <h2 style="font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: rgb(15, 23, 42); margin: 0 0 8px 0; line-height: 1.3;">
            Welcome to JAF Chatra, ${fullName}!
        </h2>
        <p style="font-family: Arial, sans-serif; font-size: 15px; color: rgb(71, 85, 105); margin: 0 0 12px 0; line-height: 1.75;">
            Your agent account is now active and was created by <strong style="color: rgb(15, 23, 42);">${creatorName}</strong>.
        </p>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: rgb(100, 116, 139); margin: 0 0 28px 0; line-height: 1.7;">
            Use the credentials below to sign in and start handling customer conversations.
        </p>

        <div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius: 10px; overflow: hidden; border: 1px solid rgb(186, 230, 253); margin-bottom: 32px;">
            <tr>
                <td style='padding: 14px 22px;'>
                    <span style="font-family: Arial, sans-serif; font-size: 15px; color: rgb(0, 0, 0); font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">Agent Credentials</span>
                </td>
            </tr>
            <tr>
                <td style="background-color: rgb(240, 249, 255); padding: 24px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                            <td style="padding-bottom: 18px; width: 50%; vertical-align: top;">
                                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Role</span><br>
                                <span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(15, 23, 42);">${role}</span>
                            </td>
                            <td style="padding-bottom: 18px; width: 50%; vertical-align: top; text-align: right;">
                                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Created By</span><br>
                                <span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(15, 23, 42);">${creatorName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding-bottom: 18px;">
                                <div style="height: 1px; background-color: rgb(186, 230, 253);"></div>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding-bottom: 18px; vertical-align: top;">
                                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Company Code</span><br>
                                <span style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: rgb(15, 23, 42);">${companyCode}</span>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding-bottom: 18px; vertical-align: top;">
                                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Email Address</span><br>
                                <span style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: rgb(15, 23, 42);">${emailAddress}</span>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding-bottom: 10px;">
                                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Temporary Password</span>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="background-color: rgb(243, 244, 244); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 13px; color: rgb(25, 25, 27); letter-spacing: 0.4px; word-break: break-word;">
                                ${password}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
            <tr>
                <td style="vertical-align: middle;">
                    <h3 style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(15, 23, 42); margin: 0;">
                        Next Steps
                    </h3>
                </td>
                <td align="right" style="vertical-align: middle; text-align: right; padding-left: 12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" align="right">
                        <tr>
                            <td style="background-color: rgb(29, 78, 216); border-radius: 8px; text-align: center;">
                                <a href="${loginUrl}" style="display: inline-block; padding: 12px 22px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 0.3px; border-radius: 8px; white-space: nowrap; line-height: 1.2;">
                                    Go to Agent Login
                                </a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgb(248, 250, 252); border: 1px solid rgb(226, 232, 240); border-radius: 8px; margin-bottom: 32px;">
            <tr>
                <td style="padding: 16px 18px; font-family: Arial, sans-serif; font-size: 13px; color: rgb(71, 85, 105); line-height: 1.8;">
                    1. Sign in using the credentials above.<br>
                    2. Change your temporary password immediately.<br>
                    3. Set your status and start assisting visitors.
                </td>
            </tr>
        </table>

         <p style="text-align: center; font-family: Arial, sans-serif; font-size: 12px; color: rgb(100, 116, 139); margin: 0; line-height: 1.6;">
            If you did not expect this account, contact your administrator immediately.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"     padding: 14px 16px; margin-bottom: 22px;">
            <tr>
                <td style="font-family: Arial, sans-serif; text-align: center; font-size: 12px; color: rgb(153, 27, 27); line-height: 1.7;">
                    Heads up: This is a temporary password, please update it as soon as you log in.
                </td>
            </tr>
        </table>
    `;
};

export default agentCredentialsEmail;
