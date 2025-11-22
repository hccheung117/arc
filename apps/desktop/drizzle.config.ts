import { defineConfig } from 'drizzle-kit'
import { homedir } from 'os'
import { join } from 'path'

function getUserDataPath(appName: string): string {
  const home = homedir()

  switch (process.platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', appName)
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), appName)
    case 'linux':
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), appName)
    default:
      return join(home, '.config', appName)
  }
}

export default defineConfig({
  schema: './src/main/db/schema.ts',
  out: './src/main/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: join(getUserDataPath('desktop-vite'), 'arc.db'),
  },
  strict: true,
})
