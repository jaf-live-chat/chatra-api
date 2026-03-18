import { APP_LOGO, APP_NAME } from '../../constants/constants.js';

const headerTemplate = () => {

	return `
		<tr>
			<td style="background-color: rgb(15, 23, 42); background-image: linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 50%, rgb(15, 23, 42) 100%); padding: 24px 24px 18px 24px; text-align: center;">
				<img src="${APP_LOGO.logoLight}" alt="${APP_NAME} logo" width="196" style="display: block; width: 196px; max-width: 100%; height: auto; margin: 0 auto 8px auto; border: 0; outline: none; text-decoration: none;" />
				<p style="margin: 0; font-family: Inter, Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.4; letter-spacing: 1px; text-transform: uppercase; color: #cbd5e1;">
					JAF Chatra - Live Chat Management
				</p>
			</td>
		</tr>
		<tr>
			<td style="background-color: #1d4ed8; background-color: var(--color-blue-700, #1d4ed8); height: 2px; line-height: 2px; font-size: 0;">&nbsp;</td>
		</tr>
	`;
};

export default headerTemplate;
