import { COLORS } from "../constants/colors.js";

const timestamp = () => new Date().toISOString();

export const logger = {
  info: (message) => {
    console.log(`${COLORS.fg.cyan}[INFO]${COLORS.reset}  ${timestamp()} ${message}`);
  },

  warn: (message) => {
    console.warn(`${COLORS.fg.yellow}[WARN]${COLORS.reset}  ${timestamp()} ${message}`);
  },

  error: (message) => {
    console.error(`${COLORS.fg.red}[ERROR]${COLORS.reset} ${timestamp()} ${message}`);
  },

  debug: (message) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${COLORS.fg.gray}[DEBUG]${COLORS.reset} ${timestamp()} ${message}`);
    }
  },
};
