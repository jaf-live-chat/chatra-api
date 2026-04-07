import { APP_URL } from "../../constants/constants.js";

const subscriptionReminderEmailTemplate = ({
  adminName,
  companyName,
  planName,
  remainingDays,
  subscriptionEnd,
}) => {
  const remainingDaysLabel = remainingDays === 1 ? "1 day" : `${remainingDays} days`;
  const remainingDaysCaps = remainingDays === 1 ? "1 DAY LEFT" : `${remainingDays} DAYS LEFT`;
  const [expiryDate, expiryTime] = String(subscriptionEnd || "").split(" at ");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 20px 0;">
      <tr>
        <td style="width: 44px; vertical-align: top; padding-top: 2px;">
          <div style="width: 30px; height: 30px; border-radius: 999px; border: 1px solid rgb(251, 191, 36); text-align: center; line-height: 30px; font-size: 13px; color: rgb(245, 158, 11); font-family: Arial, sans-serif;">&#9716;</div>
        </td>
        <td style="vertical-align: top;">
          <h2 style="font-family: Arial, sans-serif; font-size: 23px; font-weight: 800; color: rgb(15, 23, 42); margin: 0 0 8px 0; line-height: 1.25; letter-spacing: -0.2px;">
            Your ${planName} plan expires in ${remainingDaysLabel}!
          </h2>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: rgb(71, 85, 105); margin: 0; line-height: 1.65;">
            Hi ${adminName}, this is a quick reminder that your <strong style="color: rgb(15, 23, 42);">${companyName}</strong> subscription is scheduled to expire soon.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius: 16px; overflow: hidden; border: 1px solid rgb(203, 213, 225); background-color: rgb(248, 250, 252); margin-bottom: 26px;">
      <tr>
        <td style="padding: 18px 22px 14px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align: middle;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(217, 119, 6); font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase;">Subscription Status</span>
              </td>
              <td style="vertical-align: middle; text-align: right;">
                <span style="display: inline-block; padding: 6px 12px; border-radius: 999px; border: 1px solid rgb(251, 191, 36); background-color: rgb(254, 249, 195); font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: rgb(146, 64, 14); text-transform: uppercase;">${remainingDaysCaps}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 22px 18px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-bottom: 14px;">
                <span style="font-family: Arial, sans-serif; font-size: 10px; color: rgb(148, 163, 184); font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Current Plan</span><br>
                <span style="display: inline-block; margin-top: 6px; padding: 7px 12px; border-radius: 8px; border: 1px solid rgb(203, 213, 225); background-color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: 800; color: rgb(15, 23, 42); line-height: 1.2;">${planName} <span style="font-size: 10px; vertical-align: super; color: rgb(14, 116, 144);">&#10022;</span></span>
              </td>
              <td style="width: 50%; vertical-align: top; padding-bottom: 14px; text-align: right;">
                <span style="font-family: Arial, sans-serif; font-size: 10px; color: rgb(148, 163, 184); font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Company</span><br>
                <span style="display: inline-block; margin-top: 10px; font-family: Arial, sans-serif; font-size: 18px; font-weight: 800; color: rgb(15, 23, 42); line-height: 1.35;">${companyName}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0 22px 22px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius: 12px; border: 1px solid rgb(203, 213, 225); background-color: #ffffff;">
            <tr>
              <td style="padding: 16px 18px; width: 50%; vertical-align: top;">
                <span style="font-family: Arial, sans-serif; font-size: 12px; color: rgb(100, 116, 139); letter-spacing: 1px; text-transform: uppercase;">Expiration Date</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(148, 163, 184);">Time until plan ends</span>
              </td>
              <td style="padding: 16px 18px; width: 50%; vertical-align: top; text-align: right;">
                <span style="display: block; font-family: Arial, sans-serif; font-size: 19px; font-weight: 800; color: rgb(15, 23, 42); line-height: 1.2;">${expiryDate || subscriptionEnd}</span>
                ${expiryTime ? `<span style="display: block; margin-top: 2px; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; color: rgb(217, 119, 6); line-height: 1.2;">at ${expiryTime}</span>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="font-family: Arial, sans-serif; font-size: 15px; color: rgb(71, 85, 105); margin: 0 0 24px 0; line-height: 1.75;">
      To prevent any interruption to your live chat service and ensure your agents can continue supporting your visitors, please update your billing details or renew your plan before the expiration date.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 8px 0;">
      <tr>
        <td style="background-color: rgb(14, 116, 144); border-radius: 10px; text-align: center; box-shadow: 0 8px 18px rgba(14, 116, 144, 0.25);">
          <a href="${APP_URL}/portal/tenants/69d484d5ed96f32a73a7eeaa" style="display: inline-block; width: 100%; padding: 14px 18px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: 0.3px;">
            Renew Subscription Now
          </a>
        </td>
      </tr>
    </table>
  `;
};

export default subscriptionReminderEmailTemplate;