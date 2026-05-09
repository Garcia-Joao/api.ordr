import 'dotenv/config'
import app from './app'
import { prisma } from './lib/prisma'
import { ensureBaseData } from './bootstrap/ensure-base-data'

const PORT = Number(process.env.PORT || 3000)

async function start() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined')
    }

    await prisma.$queryRaw`SELECT 1`
    console.log('[startup] Database connected')

    await ensureBaseData()
    console.log('[startup] Base data ensured')

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('[startup] Failed to start server:', error)
    process.exit(1)
  }
}

start()