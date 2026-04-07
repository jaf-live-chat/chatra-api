const subscriptionReminderEmailTemplate = ({
  adminName,
  companyName,
  planName,
  remainingDays,
  subscriptionEnd,
}) => {
  const remainingDaysLabel = remainingDays === 1 ? "1 day" : `${remainingDays} days`;

  return `
    <h2 style="font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: rgb(15, 23, 42); margin: 0 0 8px 0; line-height: 1.3;">
      Subscription reminder for ${adminName}
    </h2>
    <p style="font-family: Arial, sans-serif; font-size: 15px; color: rgb(71, 85, 105); margin: 0 0 12px 0; line-height: 1.75;">
      Your subscription for <strong style="color: rgb(15, 23, 42);">${companyName}</strong> has
      <strong style="color: rgb(220, 38, 38);">${remainingDaysLabel}</strong> remaining.
    </p>
    <div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius: 10px; overflow: hidden; border: 1px solid rgb(254, 202, 202); margin-bottom: 28px;">
      <tr>
        <td style="background-color: rgb(153, 27, 27); padding: 14px 22px;">
          <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(254, 226, 226); font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">Subscription Expiry Reminder</span>
        </td>
      </tr>
      <tr>
        <td style="background-color: rgb(254, 242, 242); padding: 24px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-bottom: 16px; width: 50%; vertical-align: top;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(127, 29, 29); letter-spacing: 0.5px; text-transform: uppercase;">Current Plan</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(15, 23, 42);">${planName}</span>
              </td>
              <td style="padding-bottom: 16px; width: 50%; vertical-align: top; text-align: right;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(127, 29, 29); letter-spacing: 0.5px; text-transform: uppercase;">Days Remaining</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(185, 28, 28);">${remainingDaysLabel}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-bottom: 16px;">
                <div style="height: 1px; background-color: rgb(254, 202, 202);"></div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="width: 100%; vertical-align: top;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(127, 29, 29); letter-spacing: 0.5px; text-transform: uppercase;">Subscription End Date</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: rgb(15, 23, 42);">${subscriptionEnd}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="font-family: Arial, sans-serif; font-size: 14px; color: rgb(71, 85, 105); margin: 0 0 18px 0; line-height: 1.7;">
      To avoid interruption to your service, please renew or update your plan before the subscription end date.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 13px; color: rgb(100, 116, 139); margin: 0; line-height: 1.6;">
      If you already updated your plan recently, you can safely ignore this reminder.
    </p>
  `;
};

export default subscriptionReminderEmailTemplate;