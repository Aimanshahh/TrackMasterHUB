import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(
    `[trackmaster-hub-api] ${env.nodeEnv} listening on http://localhost:${env.port} (v${env.version})`,
  );
});

function shutdown(signal) {
  console.log(`[trackmaster-hub-api] ${signal} received, closing server.`);

  server.close((error) => {
    if (error) {
      console.error('[trackmaster-hub-api] shutdown failed', error);
      process.exitCode = 1;
    }

    process.exit();
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
