// Drizzle CLI needs to run under Electron's bundled Node runtime so native modules
// compile against the same ABI that desktop uses.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const electronBinary = path.resolve(
  __dirname,
  '../../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
);
const drizzleBin = path.resolve(__dirname, '../../../node_modules/.bin/drizzle-kit');

const args = process.argv.slice(2);

const child = spawn(electronBinary, [drizzleBin, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
