const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { randomUUID } = require('node:crypto');
const config = require('./config');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const gigRoutes = require('./routes/gigRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const financeRoutes = require('./routes/financeRoutes');

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
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
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gigs', gigRoutes);

app.use('/api/bookings', bookingRoutes);
app.use('/api', financeRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
