const headerTemplate = () => {
	return `
		<tr>
			<td style="background-color: rgb(15, 23, 42); background-image: linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 50%, rgb(15, 23, 42) 100%); padding: 32px 32px 28px 32px; text-align: center;">
				<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
					<tr>
						<td style="padding-right: 12px; vertical-align: middle;">
							<div style="background-color: rgb(29, 78, 216); border-radius: 10px; padding: 9px 10px; line-height: 0; display: inline-block;">
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="#ffffff"/>
								</svg>
							</div>
						</td>
						<td style="vertical-align: middle;">
							<span style="font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">JAF Chatra</span>
						</td>
					</tr>
				</table>
				<p style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); margin: 12px 0 0 0; letter-spacing: 2px; text-transform: uppercase; line-height: 1;">Customer Support Platform</p>
			</td>
		</tr>
		<tr>
			<td style="background-color: rgb(29, 78, 216); height: 3px; line-height: 3px; font-size: 0;">&nbsp;</td>
		</tr>
	`;
};

export default headerTemplate;
