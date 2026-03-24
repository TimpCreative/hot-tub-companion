import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import routes from './routes';
import webhooksRoutes from './routes/webhooks.routes';
import { defaultRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { tenantMiddleware } from './middleware/tenant';

const app = express();

// Required when behind a reverse proxy (Railway, etc.) so express-rate-limit can use X-Forwarded-For
app.set('trust proxy', 1);

app.use(helmet());
app.use(morgan('combined'));
app.use(compression());

// Webhook routes need raw body for HMAC verification - mount before json parser
app.use(
  '/api/v1/webhooks',
  express.raw({ type: 'application/json', limit: '1mb' }),
  (req, res, next) => {
    (req as Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
    next();
  },
  webhooksRoutes
);

app.use(express.json({ limit: '10mb' }));

// Attach tenant context for tenant-scoped routes
app.use(tenantMiddleware);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (/^https:\/\/.*\.hottubcompanion\.com$/.test(origin)) return callback(null, true);
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      callback(null, true);
    },
  })
);

app.use(defaultRateLimiter);
app.use(routes);
app.use(errorHandler);

export default app;
