import { createApp } from './app.js';
import { env } from './config/env.js';
import { setMongoUri, connectDatabase } from './config/db.js';

// Set the MongoDB URI from environment variables before starting the server.
setMongoUri(env.mongoUri);

async function start() {
  try {
    await connectDatabase();
    console.log(`[trackmaster-hub-api] MongoDB connected`);
  } catch (error) {
    console.error(`[trackmaster-hub-api] MongoDB connection failed:`, error.message);
    process.exit(1);
  }

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
}

start().catch((error) => {
  console.error('[trackmaster-hub-api] failed to start:', error);
  process.exit(1);
});
