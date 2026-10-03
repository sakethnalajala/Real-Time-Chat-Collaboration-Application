import { config } from '../config/env.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

const write = (level, args) => {
  if (config.isTest && level !== 'error') return;
  if (LEVELS[level] < threshold) return;
  const stamp = new Date().toISOString();
  const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  method(`[${stamp}] ${level.toUpperCase().padEnd(5)}`, ...args);
};

export const logger = {
  debug: (...args) => write('debug', args),
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
};
