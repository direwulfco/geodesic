import * as net from 'net';
import { createServer } from './http-server.js';
import { GEODE_VERSION } from '../version.js';

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      const port = addr.port;
      srv.close(() => { resolve(port); });
    });
    srv.on('error', reject);
  });
}

async function main(): Promise<void> {
  const port = await findFreePort();
  const server = createServer(GEODE_VERSION);

  server.listen(port, '127.0.0.1', () => {
    // Write port to stdout so engine manager can capture it
    process.stdout.write(`GEODE_ENGINE_PORT=${String(port)}\n`);
  });

  server.on('error', (err) => {
    process.stderr.write(`Engine server error: ${err.message}\n`);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    server.close(() => { process.exit(0); });
  });
  process.on('SIGINT', () => {
    server.close(() => { process.exit(0); });
  });
}

void main();
