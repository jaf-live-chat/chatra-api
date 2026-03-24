import crypto from 'crypto';

const generatePaymentReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(8).toString('hex').toUpperCase();

  return `PAY-${timestamp}-${randomPart}`;
};

export default generatePaymentReference;
