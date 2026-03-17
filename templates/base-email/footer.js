const footerTemplate = () => {
	return `
		<tr>
			<td style="background-color: rgb(15, 23, 42); background-image: linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 50%, rgb(15, 23, 42) 100%); padding: 28px 32px; text-align: center; border-top: 3px solid rgb(29, 78, 216);">
				<p style="font-family: Arial, sans-serif; font-size: 12px; color: rgb(148, 163, 184); margin: 0 0 10px 0; line-height: 1.6;">
					This is an auto-generated email. Please do not reply to this message.
				</p>
				<p style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(71, 85, 105); margin: 0; line-height: 1.6;">
					&copy; ${new Date().getFullYear()} JAF Chatra &nbsp;&bull;&nbsp;
					<a href="mailto:support@jafchatra.com" style="color: rgb(100, 116, 139); text-decoration: none;">support@jafchatra.com</a>
				</p>
			</td>
		</tr>
	`;
};

export default footerTemplate;
