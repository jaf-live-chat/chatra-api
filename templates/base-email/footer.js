import { APP_EMAIL, APP_LOGO, APP_NAME } from '../../constants/constants.js';

const footerTemplate = () => {
	return `
		<tr>
			<td style="background-color: rgb(15, 23, 42); background-image: linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 50%, rgb(15, 23, 42) 100%); padding: 6px 20px 10px 20px; text-align: center; border-top: 1px solid #dbeafe;">
				<img src="${APP_LOGO.logoLight}" alt="${APP_NAME} logo" width="92" style="display: block; width: 92px; max-width: 100%; height: auto; margin: 0 auto 6px auto; border: 0; outline: none; text-decoration: none; opacity: 0.98;" />
				<p style="font-family: Inter, Arial, Helvetica, sans-serif; font-size: 11px; color: #64748b; margin: 0 0 2px 0; line-height: 1.6;">
					This is an auto-generated email. Please do not reply to this message.
				</p>
				<p style="font-family: Inter, Arial, Helvetica, sans-serif; font-size: 11px; color: #64748b; margin: 0 0 6px 0; line-height: 1.6;">
					Need help? Contact
					<a href="mailto:${APP_EMAIL}" style="color: #1d4ed8; color: var(--color-blue-700, #1d4ed8); text-decoration: none; font-weight: 600;">${APP_EMAIL}</a>
				</p>
				<p style="font-family: Inter, Arial, Helvetica, sans-serif; font-size: 10px; color: #94a3b8; margin: 0; line-height: 1.6;">
					&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
				</p>
			</td>
		</tr>
	`;
};

export default footerTemplate;
