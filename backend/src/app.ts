import express, { type NextFunction, type Request, type Response } from 'express';
import { authRouter } from './auth/routes';
import type { AuthService } from './auth/service';
import { ApiError } from './errors';

export function createApp({ auth, trustProxy = 0 }: { auth: AuthService; trustProxy?: number }) {
  const app = express();
  app.set('trust proxy', trustProxy);
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
      console.error(err);
      error = new ApiError('INTERNAL_ERROR');
    }
    if (error.retryAfterSec) res.set('Retry-After', String(error.retryAfterSec));
    res.status(error.status).json(error.toBody());
  });

  return app;
}
