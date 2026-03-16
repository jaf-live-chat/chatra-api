const footerTemplate = ({
  appName = '',
  supportEmail = '',
  year = new Date().getFullYear(),
} = {}) => {
  return `
		<tr>
			<td style="padding: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
				<p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #6b7280; line-height: 1.6;">
					Need help? Contact us at
					<a href="mailto:${supportEmail}" style="color: #2563eb; text-decoration: none;">${supportEmail}</a>
				</p>
				<p style="margin: 8px 0 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af; line-height: 1.6;">
					&copy; ${year} ${appName}. All rights reserved.
				</p>
			</td>
		</tr>
	`;
};

export default footerTemplate;
