import 'dotenv/config'
import app from './app'
import { prisma } from './lib/prisma'
import { ensureBaseData } from './bootstrap/ensure-base-data'

const PORT = Number(process.env.PORT || 3000)

async function start() {
  try {
    console.log('[startup] Starting ORDR backend...')
    console.log('[startup] NODE_ENV:', process.env.NODE_ENV)
    console.log('[startup] PORT:', process.env.PORT)
    console.log('[startup] DATABASE_URL exists:', Boolean(process.env.DATABASE_URL))

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined')
    }

    await prisma.$queryRaw`SELECT 1`
    console.log('[startup] Database connected')

    await ensureBaseData()
    console.log('[startup] Base data ensured')

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('[startup] Failed to start server:', error)
    process.exit(1)
  }
}

start()