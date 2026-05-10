import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import authRouter from './routes/auth.routes'
import productsRouter from './routes/products.routes'
import categoriesRouter from './routes/categories.routes'
import ordersRouter from './routes/orders.routes'
import companiesRouter from './routes/companies.routes'
import { internalCustomersRoutes } from './routes/internal-customers.routes'
import salesEnvironmentsRouter from './routes/sales-environments.routes'
import stockRouter from './routes/stock.routes'
import printersRouter from './routes/printers.routes'
import { peopleRoutes } from './routes/people.routes'
import eventsRoutes from './routes/events.routes'
import customersRoutes from './routes/customers.routes'
import staffEvaluationsRoutes from './routes/staff-evaluations.routes'
import buysRoutes from './routes/buys.routes'
import reportsRoutes from './routes/reports.routes'
import router from './routes/product-cost-history.routes'
import accessRoutes from './routes/access.routes'
import auditRoutes from './routes/audit.routes'
import devicesRoutes from './routes/devices.routes'
import adminRouter from './routes/admin.routes'

import { prisma } from './lib/prisma'

const app = express()

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://192.168.15.4:3001',
  'https://panelordr.com.br',
  'https://admin.panelordr.com.br',
  process.env.FRONTEND_URL,
  process.env.FRONTEND_LAN_URL,
  process.env.ADMIN_FRONTEND_URL,
].filter(Boolean) as string[]

app.use((req, _res, next) => {
  console.log('[request]', req.method, req.path, 'origin:', req.headers.origin)
  next()
})

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      console.error('[cors] blocked origin:', origin)
      return callback(new Error(`CORS blocked origin: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id', 'x-device-id'],
  })
)

app.use(cookieParser())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    return res.json({
      ok: true,
      db: 'connected',
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      ok: false,
      db: 'disconnected',
    })
  }
})

app.get('/auth/me', (req, res, next) => {
  if (!req.cookies?.auth) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  return next()
})

app.use('/admin', adminRouter)
app.use('/auth', authRouter)
app.use('/products', productsRouter)
app.use('/categories', categoriesRouter)
app.use('/orders', ordersRouter)
app.use('/companies', companiesRouter)
app.use('/internal-customers', internalCustomersRoutes)
app.use('/sales-environments', salesEnvironmentsRouter)
app.use('/stock', stockRouter)
app.use('/printers', printersRouter)
app.use('/people', peopleRoutes)
app.use('/events', eventsRoutes)
app.use('/customers', customersRoutes)
app.use('/staff-evaluations', staffEvaluationsRoutes)
app.use('/buys', buysRoutes)
app.use('/reports', reportsRoutes)
app.use('/product-cost-history', router)
app.use('/access', accessRoutes)
app.use('/audit', auditRoutes)
app.use('/devices', devicesRoutes)

export default app