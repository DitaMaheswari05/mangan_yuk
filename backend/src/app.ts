import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './auth/routes';
import type { AuthService } from './auth/service';
import { ApiError } from './errors';

export function createApp({ auth, trustProxy = 0 }: { auth: AuthService; trustProxy?: number }) {
  const app = express();
  app.set('trust proxy', trustProxy);

  // OWASP M4 & M8: Security headers dengan helmet
  app.use(helmet());

  // OWASP M4 & M8: Pembatasan CORS yang ketat
  app.use(
    cors({
      origin: (origin, callback) => {
        // Izinkan request tanpa origin (mobile apps native, curl, testing)
        if (!origin) return callback(null, true);
        const allowed = ['http://localhost:8081', 'http://localhost:3000', 'http://127.0.0.1:8081'];
        if (allowed.includes(origin)) return callback(null, true);
        return callback(new ApiError('VALIDATION_ERROR', [{ field: 'origin', rule: 'cors' }]));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400,
    }),
  );

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/v1/auth', authRouter(auth));

  app.use(() => {
    throw new ApiError('NOT_FOUND');
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let error: ApiError;
    if (err instanceof ApiError) error = err;
    else if ((err as { type?: string }).type === 'entity.parse.failed') {
      error = new ApiError('VALIDATION_ERROR', [{ field: 'body', rule: 'json' }]);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.error(err);
      } else {
        console.error('[server error] Terjadi kesalahan internal');
      }
      error = new ApiError('INTERNAL_ERROR');
    }
    if (error.retryAfterSec) res.set('Retry-After', String(error.retryAfterSec));
    res.status(error.status).json(error.toBody());
  });

  return app;
}
