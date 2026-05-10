require('dotenv/config')

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('[index] Starting backend from index.js')
console.log('[index] cwd:', process.cwd())
console.log('[index] NODE_ENV:', process.env.NODE_ENV)
console.log('[index] PORT:', process.env.PORT)
console.log('[index] DATABASE_URL exists:', Boolean(process.env.DATABASE_URL))

const serverPath = path.join(__dirname, 'dist', 'server.js')

try {
  const srcAdminPath = path.join(__dirname, 'src', 'services', 'admin.service.ts')
  const distMissing = !fs.existsSync(serverPath)
  const srcChanged = fs.existsSync(srcAdminPath) && (!fs.existsSync(serverPath) || fs.statSync(srcAdminPath).mtimeMs > fs.statSync(serverPath).mtimeMs)

  if (distMissing || srcChanged) {
    console.log('[index] Build output is missing or older than source. Running npm run build...')

    execSync('npm run build', {
      cwd: __dirname,
      stdio: 'inherit',
    })

    console.log('[index] Build completed')
  }

  console.log('[index] Loading:', serverPath)
  require(serverPath)
} catch (error) {
  console.error('[index] Failed to start backend:', error)
  process.exit(1)
}