const { execSync } = require('node:child_process')
const path = require('node:path')

const task = process.argv[2]
if (!task) { console.error('Usage: node src/cli/run.js <script>'); process.exit(1) }

const basename = path.basename(task, path.extname(task))

execSync(`npx vite build --config vite.cli.config.mjs`, { stdio: 'ignore', env: { ...process.env, TASK: task } })
execSync(`npx electron .vite/cli/${basename}.js`, { stdio: 'inherit' })
