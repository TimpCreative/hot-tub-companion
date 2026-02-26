import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import routes from './routes';
import { defaultRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Required when behind a reverse proxy (Railway, etc.) so express-rate-limit can use X-Forwarded-For
app.set('trust proxy', 1);

app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

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
