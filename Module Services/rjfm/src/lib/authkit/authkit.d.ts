// Deklarasi tipe untuk salinan authkit (shared/authkit) — file sumber .js.
export type GatewayUser = { userId: number | string; name: string; email: string; role: string; source?: string };
export declare function verifyGatewayIdentity(headers: Record<string, unknown> | Headers): GatewayUser | null;
export declare function hasRole(user: { role?: string } | null, ...roles: string[]): boolean;
export declare function verifyPortalCookie(token: string | null | undefined, opts?: { keysDir?: string }): Record<string, any> | null;
export declare function extractPortalToken(cookieHeader: string | null | undefined): string | null;
export declare function resolveIdentity(args?: {
  headers?: Record<string, unknown>
  cookie?: string | null
  opts?: { keysDir?: string; tokenIsValue?: boolean }
}): GatewayUser | null;
export declare function requireAuth(options?: { roles?: string[] }): (req: any, res: any, next: any) => void;
declare const _default: {
  verifyGatewayIdentity: typeof verifyGatewayIdentity
  hasRole: typeof hasRole
  verifyPortalCookie: typeof verifyPortalCookie
  extractPortalToken: typeof extractPortalToken
  resolveIdentity: typeof resolveIdentity
  requireAuth: typeof requireAuth
};
export default _default;
