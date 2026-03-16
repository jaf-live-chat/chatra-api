import headerTemplate from './header.js';
import footerTemplate from './footer.js';

const baseEmailTemplate = (bodyContent = '', options = {}) => {
  const { headerOptions = {}, footerOptions = {} } = options;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Email</title>
      </head>
      <body style="margin: 0; padding: 24px 12px; background-color: #f3f4f6;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          ${headerTemplate(headerOptions)}
          <tr>
            <td style="padding: 16px 24px 24px 24px; font-family: Arial, sans-serif; font-size: 14px; color: #111827; line-height: 1.7;">
              ${bodyContent}
            </td>
          </tr>
          ${footerTemplate(footerOptions)}
        </table>
      </body>
    </html>
  `;
};

export default baseEmailTemplate;