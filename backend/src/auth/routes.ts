import { Router, type NextFunction, type Request, type Response } from 'express';
import { ApiError } from '../errors';
import type { AuthService } from './service';
import * as v from './validation';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export function authRouter(auth: AuthService): Router {
  const r = Router();
  const ip = (req: Request) => req.ip ?? 'unknown';

  const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new ApiError('TOKEN_INVALID');
    req.userId = await auth.authenticate(token);
    next();
  };

  r.post('/register', async (req, res) => {
    res.status(201).json(await auth.register(v.parse(v.registerBody, req.body), ip(req)));
  });

  r.post('/login', async (req, res) => {
    res.json(await auth.login(v.parse(v.loginBody, req.body), ip(req)));
  });

  r.post('/refresh', async (req, res) => {
    const { refreshToken } = v.parse(v.refreshBody, req.body);
    res.json({ tokens: await auth.refresh(refreshToken) });
  });

  r.post('/logout', requireAuth, async (req, res) => {
    const { refreshToken } = v.parse(v.refreshBody, req.body);
    await auth.logout(req.userId!, refreshToken);
    res.status(204).end();
  });

  r.get('/me', requireAuth, async (req, res) => {
    res.json(await auth.getMe(req.userId!));
  });

  r.patch('/me', requireAuth, async (req, res) => {
    const { displayName } = v.parse(v.updateMeBody, req.body);
    res.json(await auth.updateMe(req.userId!, displayName));
  });

  r.delete('/me', requireAuth, async (req, res) => {
    const { password } = v.parse(v.deleteMeBody, req.body);
    await auth.deleteMe(req.userId!, password);
    res.status(204).end();
  });

  r.post('/password/forgot', async (req, res) => {
    await auth.forgotPassword(v.parse(v.forgotBody, req.body).email);
    res.status(202).end();
  });

  r.post('/password/reset', async (req, res) => {
    const { token, newPassword } = v.parse(v.resetBody, req.body);
    await auth.resetPassword(token, newPassword);
    res.status(204).end();
  });

  return r;
}
