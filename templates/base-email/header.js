const headerTemplate = ({ appName = 'JAF Chatra', title = 'Notification' } = {}) => {
  return `
		<tr>
			<td style="padding: 24px 24px 8px 24px; text-align: center;">
				<div style="font-family: Arial, sans-serif; font-size: 12px; color: #6b7280; letter-spacing: 0.5px; text-transform: uppercase;">
					${appName}
				</div>
				<h1 style="margin: 8px 0 0 0; font-family: Arial, sans-serif; font-size: 24px; color: #111827; line-height: 1.3;">
					${title}
				</h1>
			</td>
		</tr>
	`;
};

export default headerTemplate;
