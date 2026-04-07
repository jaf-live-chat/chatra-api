const planChangeEmailTemplate = ({
  adminName,
  companyName,
  currentPlanName,
  nextPlanName,
  nextPlanPrice,
  effectiveDate,
  nextBillingDate,
}) => {
  return `
    <h2 style="font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: rgb(15, 23, 42); margin: 0 0 8px 0; line-height: 1.3;">
      Your plan change has been processed successfully, ${adminName}.
    </h2>
    <p style="font-family: Arial, sans-serif; font-size: 15px; color: rgb(71, 85, 105); margin: 0 0 12px 0; line-height: 1.75;">
      We received your payment for <strong style="color: rgb(15, 23, 42);">${companyName}</strong> and queued your new subscription safely.
      Your current plan will remain active until it expires.
    </p>
    <div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius: 10px; overflow: hidden; border: 1px solid rgb(191, 219, 254); margin-bottom: 28px;">
      <tr>
        <td style="background-color: rgb(30, 64, 175); padding: 14px 22px;">
          <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(191, 219, 254); font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">Subscription Update</span>
        </td>
      </tr>
      <tr>
        <td style="background-color: rgb(239, 246, 255); padding: 24px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-bottom: 16px; width: 50%; vertical-align: top;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Current Plan</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(15, 23, 42);">${currentPlanName}</span>
              </td>
              <td style="padding-bottom: 16px; width: 50%; vertical-align: top; text-align: right;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">New Plan</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(29, 78, 216);">${nextPlanName}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-bottom: 16px;">
                <div style="height: 1px; background-color: rgb(191, 219, 254);"></div>
              </td>
            </tr>
            <tr>
              <td style="width: 50%; vertical-align: top;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Effective Date</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: rgb(15, 23, 42);">${effectiveDate}</span>
              </td>
              <td style="width: 50%; vertical-align: top; text-align: right;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Next Billing Date</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: rgb(15, 23, 42);">${nextBillingDate}</span>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 16px;">
                <span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Plan Price</span><br>
                <span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(29, 78, 216);">${nextPlanPrice}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="font-family: Arial, sans-serif; font-size: 14px; color: rgb(71, 85, 105); margin: 0 0 18px 0; line-height: 1.7;">
      Once your current plan ends, the new plan will activate automatically with no overlap. You do not need to take any additional action.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 13px; color: rgb(100, 116, 139); margin: 0; line-height: 1.6;">
      If you did not request this change, contact support immediately at support@jafchatra.com.
    </p>
  `;
};

export default planChangeEmailTemplate;
