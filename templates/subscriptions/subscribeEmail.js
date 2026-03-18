const subscribeEmailTemplate = ({ adminName, companyName, planName, planPrice, subscriptionStart, subscriptionEnd, apiKey }) => {

	return `
		<h2 style="font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: rgb(15, 23, 42); margin: 0 0 8px 0; line-height: 1.3;">
		  Welcome to JAF Chatra, ${adminName}!
		</h2>
		<p style="font-family: Arial, sans-serif; font-size: 15px; color: rgb(71, 85, 105); margin: 0 0 12px 0; line-height: 1.75;">
			Your customer support platform is ready to go. We're thrilled to have <strong style="color: rgb(15, 23, 42);">${companyName}</strong> on board!
		</p>
		<p style="font-family: Arial, sans-serif; font-size: 14px; color: rgb(100, 116, 139); margin: 0 0 28px 0; line-height: 1.7;">
			Start connecting with your visitors in minutes. This email contains everything you need to get started.
		</p>

		<!-- Divider -->
		<div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

		<!-- Plan Summary Card -->
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius: 10px; overflow: hidden; border: 1px solid rgb(186, 230, 253); margin-bottom: 32px;">
			<!-- Card Header -->
			<tr>
				<td style="background-color: rgb(29, 78, 216); background-image: linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 50%, rgb(15, 23, 42) 100%); padding: 14px 22px;">
					<span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(147, 197, 253); font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">Active Subscription</span>
				</td>
			</tr>
			<!-- Card Body -->
			<tr>
				<td style="background-color: rgb(240, 249, 255); padding: 24px 22px;">
					<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
						<!-- Plan Name + Price -->
						<tr>
							<td style="padding-bottom: 18px; width: 50%; vertical-align: top;">
								<span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Plan</span><br>
								<span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(15, 23, 42);">${planName}</span>
							</td>
							<td style="padding-bottom: 18px; width: 50%; vertical-align: top; text-align: right;">
								<span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Price</span><br>
								<span style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(29, 78, 216);">${planPrice === 0 ? 'Free' : '₱' + planPrice + ' / mo'}</span>
							</td>
						</tr>
						<!-- Divider -->
						<tr>
							<td colspan="2" style="padding-bottom: 18px;">
								<div style="height: 1px; background-color: rgb(186, 230, 253);"></div>
							</td>
						</tr>
						<!-- Company -->
						<tr>
							<td style="padding-bottom: 18px; vertical-align: top;" colspan="2">
								<span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Company</span><br>
								<span style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: rgb(15, 23, 42);">${companyName}</span>
							</td>
						</tr>
						<!-- Dates -->
						<tr>
							<td style="width: 50%; vertical-align: top;">
								<span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Start Date</span><br>
								<span style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: rgb(15, 23, 42);">${subscriptionStart}</span>
							</td>
							<td style="width: 50%; vertical-align: top; text-align: right;">
								<span style="font-family: Arial, sans-serif; font-size: 11px; color: rgb(100, 116, 139); letter-spacing: 0.5px; text-transform: uppercase;">Renewal Date</span><br>
								<span style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: rgb(15, 23, 42);">${subscriptionEnd}</span>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>

		<!-- Divider -->
		<div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

		<!-- API Key Section -->
		<h3 style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(15, 23, 42); margin: 0 0 16px 0;">
			Your API Key
		</h3>
		<p style="font-family: Arial, sans-serif; font-size: 13px; color: rgb(71, 85, 105); margin: 0 0 16px 0; line-height: 1.6;">
			Use this API key to integrate JAF Chatra with your website and applications. <strong>Keep it safe and never share it publicly.</strong>
		</p>
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid rgb(226, 232, 240); border-radius: 8px; margin-bottom: 28px; overflow: hidden;">
			<tr>
				<td style="background-color: rgb(248, 250, 252); padding: 16px 18px; font-family: monospace; font-size: 12px; color: rgb(15, 23, 42); word-break: break-all; letter-spacing: 0.5px;">
					${apiKey}
				</td>
			</tr>
		</table>

		<!-- Divider -->
		<div style="height: 1px; background-color: rgb(226, 232, 240); margin-bottom: 28px;"></div>

		<!-- Widget Integration Section -->
		<h3 style="font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: rgb(15, 23, 42); margin: 0 0 16px 0;">
			Add Chat Widget to Your Website
		</h3>
		<p style="font-family: Arial, sans-serif; font-size: 13px; color: rgb(71, 85, 105); margin: 0 0 14px 0; line-height: 1.6;">
			Copy and paste the code below into your website's HTML <code style="background-color: rgb(248, 250, 252); padding: 2px 6px; border-radius: 3px; color: rgb(220, 38, 38); font-family: monospace; font-size: 12px;">&lt;head&gt;</code> or before <code style="background-color: rgb(248, 250, 252); padding: 2px 6px; border-radius: 3px; color: rgb(220, 38, 38); font-family: monospace; font-size: 12px;">&lt;/body&gt;</code> tag:
		</p>
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid rgb(226, 232, 240); border-radius: 8px; margin-bottom: 28px; overflow: hidden;">
			<tr>
				<td style="background-color: rgb(15, 23, 42); padding: 18px; font-family: monospace; font-size: 11px; color: rgb(209, 213, 219); line-height: 1.6; overflow-x: auto;">
<span style="color: rgb(101, 198, 255);">&lt;script&gt;</span><br>
&nbsp;&nbsp;window.chatConfig = {<br>
&nbsp;&nbsp;&nbsp;&nbsp;apiKey: '${apiKey}',<br>
&nbsp;&nbsp;&nbsp;&nbsp;position: 'bottom-right'<br>
&nbsp;&nbsp;};<br>
<span style="color: rgb(101, 198, 255);">&lt;/script&gt;</span><br>
<span style="color: rgb(101, 198, 255);">&lt;script</span> src="https://widget.jafchatra.com/chat.js"<span style="color: rgb(101, 198, 255);">&gt;&lt;/script&gt;</span>
			</td>
			</tr>
		</table>

		<!-- CTA Buttons Row -->
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
			<tr>
				<td style="padding-right: 12px; width: 100%;">
					<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
						<tr>
							<td style="background-color: rgb(29, 78, 216); border-radius: 8px; text-align: center;">
								<a href="#" style="display: inline-block; padding: 12px 20px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 0.3px; border-radius: 8px;">
									Go to Login
								</a>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>

		<!-- Support Section -->
		<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgb(240, 249, 255); border-radius: 8px; padding: 20px 18px; margin-bottom: 24px; border: 1px solid rgb(186, 230, 253);">
			<tr>
				<td>
					<span style="font-family: Arial, sans-serif; font-size: 12px; color: rgb(15, 23, 42); font-weight: bold;">Need Help?</span>
					<p style="font-family: Arial, sans-serif; font-size: 12px; color: rgb(71, 85, 105); margin: 8px 0 0 0; line-height: 1.6;">
						Our support team is here to help. Check our documentation, browse FAQs, or reach out directly at <a href="mailto:support@jafchatra.com" style="color: rgb(29, 78, 216); text-decoration: none;">support@jafchatra.com</a>.
					</p>
				</td>
			</tr>
		</table>

		<!-- Closing -->
		<p style="font-family: Arial, sans-serif; font-size: 12px; color: rgb(100, 116, 139); margin: 0; line-height: 1.6;">
			Happy to have you on board! We look forward to helping you deliver exceptional customer support.
		</p>
	`;
};

export default subscribeEmailTemplate;
