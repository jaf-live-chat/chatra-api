import headerTemplate from './header.js';
import footerTemplate from './footer.js';
import { APP_NAME } from '../../constants/constants.js';

const baseEmailTemplate = (bodyContent) => {

  return `
		<!doctype html>
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>${APP_NAME}</title>
			</head>
			<body style="margin: 0; padding: 40px 16px; background-color: rgb(224, 242, 254); background-image: linear-gradient(135deg, rgb(240, 249, 255) 0%, rgb(224, 242, 254) 50%, rgb(248, 250, 252) 100%); --color-blue-700: #1d4ed8; font-family: Inter, Arial, Helvetica, sans-serif;">
				<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(15, 23, 42, 0.15);">
					${headerTemplate()}
					<tr>
						<td style="background-color: #ffffff; background-image: linear-gradient(rgb(240, 249, 255) 0%, rgb(255, 255, 255) 100%); padding: 36px 36px 44px 36px; font-family: Inter, Arial, Helvetica, sans-serif; font-size: 15px; color: rgb(30, 41, 59); line-height: 1.75;">
							${bodyContent}
						</td>
					</tr>
					${footerTemplate()}
				</table>
			</body>
		</html>
	`;
};

export default baseEmailTemplate;