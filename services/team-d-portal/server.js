const express = require('express');
const path = require('path');
const app = express();

const correlationMiddleware = require('./src/bff/middleware/correlation');
const errorHandler = require('./src/bff/middleware/errorHandler');
const uiRoutes = require('./src/bff/routes/uiRoutes');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(correlationMiddleware);
app.use(express.static(path.join(__dirname, 'src/frontend'), {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') // always revalidate: the SPA is edited live during development
}));

app.get('/health', (req, res) => res.json({ service: 'team-d-portal', status: 'ok' }));

app.use('/api/v1/ui', uiRoutes);

// Unknown API routes must answer JSON, never the SPA shell
app.use('/api', (req, res) => res.status(404).json({
  error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found`, details: [] },
  meta: { correlation_id: req.correlationId, timestamp: new Date().toISOString() }
}));

// Fallback: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/frontend/index.html'));
});

app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Team D — Placement Portal running on port ${PORT}`));
}

module.exports = app;

