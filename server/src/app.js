import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import routes from './routes/index.js';
import { storage } from './services/storage/index.js';
import { LOCAL_UPLOAD_ROOT } from './services/storage/localDriver.js';

const IMAGE_FILE = /\.(jpe?g|png|webp|gif)$/i;

export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Allow the SPA (another origin) to display uploaded images served by this API in development.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.get('/', (_req, res) => {
    res.json({ name: `${config.appName} API`, status: 'running', docs: '/api/health' });
  });

  if (storage.driverName === 'local') {
    app.use(
      '/uploads',
      express.static(LOCAL_UPLOAD_ROOT, {
        index: false,
        dotfiles: 'deny',
        maxAge: '7d',
        setHeaders(res, filePath) {
          res.set('X-Content-Type-Options', 'nosniff');
          res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
          if (!IMAGE_FILE.test(filePath)) res.set('Content-Disposition', 'attachment');
        },
      })
    );
  }

  app.use('/api', apiLimiter, routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
