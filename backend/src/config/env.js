import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
);

const supportedEnvironments = ['development', 'test', 'staging', 'production'];

function readPort(rawPort) {
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: "${rawPort}". Expected an integer between 1 and 65535.`);
  }

  return port;
}

function readOrigins(rawOrigins) {
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

if (!supportedEnvironments.includes(nodeEnv)) {
  throw new Error(
    `Invalid NODE_ENV "${nodeEnv}". Expected one of: ${supportedEnvironments.join(', ')}.`,
  );
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  // API_PORT takes precedence because some hosts pre-set PORT for their own tooling.
  port: readPort(process.env.API_PORT ?? process.env.PORT ?? 4000),
  clientOrigins: readOrigins(process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'),
  serviceName: 'trackmaster-hub-api',
  version: pkg.version,
};
