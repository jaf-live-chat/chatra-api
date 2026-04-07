/**
 * Resolves environment variables based on NODE_ENV
 * Automatically appends NODE_ENV suffix to env var names
 * e.g., getEnv('HITPAY_API_KEY') -> process.env.HITPAY_API_KEY_LOCAL (if NODE_ENV=LOCAL)
 */
const getEnv = (varName) => {
  const nodeEnv = (process.env.NODE_ENV || 'LOCAL').toUpperCase();
  const suffixedVarName = `${varName}_${nodeEnv}`;
  return process.env[suffixedVarName];
};

/**
 * Get env var with fallback to non-suffixed version
 * Useful for vars that may not have environment-specific variants
 */
const getEnvWithFallback = (varName) => {
  const nodeEnv = (process.env.NODE_ENV || 'LOCAL').toUpperCase();
  const suffixedVarName = `${varName}_${nodeEnv}`;
  return process.env[suffixedVarName] || process.env[varName];
};

export { getEnv, getEnvWithFallback };
