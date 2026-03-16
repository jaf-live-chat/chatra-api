import nodemailer from 'nodemailer';

/**
 * Creates and configures a nodemailer transporter
 * @returns {nodemailer.Transporter} Configured transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Sends an email using the configured transporter
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 * @param {string} [options.from] - Sender email (optional, defaults to env var)
 * @param {string} [options.text] - Plain text version (optional)
 * @returns {Promise<Object>} Result of sending email
 */
const sendEmail = async ({ to, subject, html, from, text }) => {
  try {
    if (!to) {
      throw new Error('[Email] Recipient email address is required.');
    }
    if (!subject) {
      throw new Error('[Email] Email subject is required.');
    }
    if (!html) {
      throw new Error('[Email] Email content is required.');
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: from || process.env.EMAIL_FROM || `"${process.env.APP_NAME}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || '', // Plain text version
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[Email] Email sent successfully to ${to}. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    throw new Error(`[Email] Failed to send email: ${error.message}`);
  }
};

/**
 * Sends multiple emails (useful for batch operations)
 * @param {Array<Object>} emailList - Array of email options
 * @returns {Promise<Array>} Array of results
 */
const sendBulkEmails = async (emailList) => {
  try {
    const results = await Promise.allSettled(
      emailList.map(emailOptions => sendEmail(emailOptions))
    );

    return results.map((result, index) => ({
      to: emailList[index].to,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
    }));
  } catch (error) {
    console.error('[Email] Error sending bulk emails:', error);
    throw new Error(`[Email] Failed to send bulk emails: ${error.message}`);
  }
};

/**
 * Verifies the email configuration by testing the connection
 * @returns {Promise<boolean>} True if connection is successful
 */
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('[Email] Email configuration verified successfully.');
    return true;
  } catch (error) {
    console.error('[Email] Email configuration verification failed:', error);
    return false;
  }
};

export default {
  sendEmail,
  sendBulkEmails,
  verifyEmailConfig,
};
