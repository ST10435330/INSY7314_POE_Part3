const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { randomUUID } = require('node:crypto');
const config = require('./config');
const database = require('./database');
const audit = require('./utils/audit');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const gigRoutes = require('./routes/gigRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const financeRoutes = require('./routes/financeRoutes');

const app = express();
app.disable('x-powered-by');
if (config.behindProxy) app.set('trust proxy', 1);

app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});
app.use('/api', (req, res, next) => {
  const login = req.method === 'POST' && /^\/auth\/login\/?$/i.test(req.path);

  res.once('finish', () => {
    const status = res.statusCode;
    if (status < 400) return;

    const level = status >= 500 ? 'error' : 'warn';
    const event = { requestId: req.requestId, method: req.method, status };
    audit('api.error', event, level);

    if (login) {
      const outcome = { 400: 'invalid', 401: 'denied', 429: 'throttled' }[status] || 'error';
      audit('auth.login', { ...event, outcome }, level);
    }
  });

  next();
});
app.use(helmet());
//no store tells the browser not to save any API responses such as tokens and potential financial info
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(cors({
  origin: config.allowedOrigin,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '20kb', strict: true }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/ready', async (_req, res) => {
  const ready = await database.isReady();
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'unavailable'
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gigs', gigRoutes);

app.use('/api/bookings', bookingRoutes);
app.use('/api', financeRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
