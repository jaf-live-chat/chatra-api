import crypto from 'crypto';

const generateAPIKey = () => {
  const prefix = "jaf";
  const randomPart = crypto.randomBytes(24).toString("hex");

  return `${prefix}_${randomPart}`;
}

export default generateAPIKey;