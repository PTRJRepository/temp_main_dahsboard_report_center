import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
// authkit — salinan shared/authkit (aturan isolasi: copy, jangan import lintas modul).
// Dipakai untuk memverifikasi portal RS256 cookie saat akses direct-port.
import { verifyPortalCookie } from '../lib/authkit/authkit.js';

export type AuthedUser = { user_id: number; username: string; role_code: string; afdeling_id?: number | null };

// Role setara atasan. 'ADMIN' dimasukkan karena token dari portal bridge
// (Dashboard_Utama) membawa role mentah user_ptrj seperti 'ADMIN'/'GM_ESTATE'.
export const MANAGER_ROLES = ['MANAGER', 'ASISTEN', 'SUPERADMIN', 'ADMIN', 'GM_ESTATE'];

// Role yang boleh MEMBUAT tugas (kebijakan: hanya Manager/Admin/GM).
// Asisten tetap boleh review & melihat data, tapi tidak membuat penugasan.
export const TASK_CREATOR_ROLES = ['MANAGER', 'SUPERADMIN', 'ADMIN', 'GM_ESTATE'];

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export function auth(requiredRoles?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // SSO path: when reached THROUGH the gateway, it strips any inbound x-user-*
    // and injects headers derived from the verified portal JWT. Trust them.
    const gwId = req.headers['x-user-id'];
    const gwRole = req.headers['x-user-role'] as string | undefined;
    if (gwId) {
      const user: AuthedUser = {
        user_id: Number(gwId),
        username: String(req.headers['x-user-name'] ?? ''),
        role_code: String(gwRole ?? ''),
        afdeling_id: null,
      };
      if (requiredRoles && requiredRoles.length && !requiredRoles.includes(user.role_code)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: role not allowed' });
      }
      req.user = user;
      return next();
    }
    const hdr = req.headers.authorization || '';
    let token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.headers['x-api-key'] as string) || '';
    // Fallback cookie rjfm-token (dipakai UI monolith setelah /file/login —
    // token disimpan di cookie httpOnly=false oleh route login Next).
    if (!token) {
      token = req.cookies?.['rjfm-token']
        || (String(req.headers.cookie || '').match(/(?:^|;\s*)rjfm-token=([^;]+)/)?.[1] ?? '')
    }
    // Portal cookie fallback (direct-port): user login via portal utama lalu
    // buka modul ini langsung — verifikasi RS256 cookie dengan authkit.
    if (!token) {
      const portal = verifyPortalCookie(
        req.cookies?.['auth-token'] || req.cookies?.['payroll_auth_token']
          || (String(req.headers.cookie || '').match(/(?:^|;\s*)(?:auth-token|payroll_auth_token)=([^;]+)/)?.[1] ?? null),
      );
      if (portal) {
        const user: AuthedUser = {
          user_id: Number(portal.userId ?? portal.sub ?? 0),
          username: String(portal.email || portal.username || ''),
          role_code: String(portal.role ?? ''),
          afdeling_id: null,
        };
        if (!user.user_id) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        if (requiredRoles && requiredRoles.length && !requiredRoles.includes(user.role_code)) {
          return res.status(403).json({ status: 'error', message: 'Forbidden: role not allowed' });
        }
        req.user = user;
        return next();
      }
      return res.status(401).json({ status: 'error', message: 'Unauthorized: token required' });
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret) as any;
      const user: AuthedUser = {
        user_id: payload.user_id ?? payload.sub ?? payload.id,
        username: payload.username ?? payload.sub ?? '',
        role_code: payload.role_code ?? payload.role ?? '',
        afdeling_id: payload.afdeling_id ?? null,
      };
      if (!user.user_id) throw new Error('invalid payload');
      if (requiredRoles && requiredRoles.length && !requiredRoles.includes(user.role_code)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: role not allowed' });
      }
      req.user = user;
      next();
    } catch (e: any) {
      return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
    }
  };
}
