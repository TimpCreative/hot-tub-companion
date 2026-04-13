import jwt from 'jsonwebtoken';
import { env } from '../config/environment';

export const SUBSCRIPTION_HANDOFF_AUDIENCE = 'subscription_handoff';
const HANDOFF_TTL_SEC = 900;

export type SubscriptionHandoffClaims = {
  userId: string;
  tenantId: string;
  /** Set for kit bundle checkout (XOR with singlePosProductId). */
  bundleId: string | null;
  /** Set for single-SKU subscription checkout (XOR with bundleId). */
  singlePosProductId: string | null;
  spaProfileId: string | null;
  email: string;
};

export function signSubscriptionHandoff(claims: SubscriptionHandoffClaims): string {
  const hasBundle = !!(claims.bundleId && claims.bundleId.trim());
  const hasSingle = !!(claims.singlePosProductId && claims.singlePosProductId.trim());
  if (hasBundle === hasSingle) {
    throw new Error('HANDOFF_XOR');
  }
  return jwt.sign(
    {
      aud: SUBSCRIPTION_HANDOFF_AUDIENCE,
      tid: claims.tenantId,
      ...(hasBundle ? { bid: claims.bundleId!.trim() } : {}),
      ...(hasSingle ? { spid: claims.singlePosProductId!.trim() } : {}),
      spa: claims.spaProfileId,
      email: claims.email,
    },
    env.JWT_SECRET,
    { subject: claims.userId, expiresIn: HANDOFF_TTL_SEC }
  );
}

export function verifySubscriptionHandoff(token: string): SubscriptionHandoffClaims {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    audience: SUBSCRIPTION_HANDOFF_AUDIENCE,
  }) as jwt.JwtPayload;
  const userId = decoded.sub;
  const tid = decoded.tid as string | undefined;
  const bid = typeof decoded.bid === 'string' ? decoded.bid.trim() : '';
  const spid = typeof decoded.spid === 'string' ? decoded.spid.trim() : '';
  const email = (decoded.email as string | undefined)?.trim();
  const hasB = bid.length > 0;
  const hasS = spid.length > 0;
  if (!userId || !tid || !email || hasB === hasS) {
    throw new Error('INVALID_HANDOFF_TOKEN');
  }
  return {
    userId,
    tenantId: tid,
    bundleId: hasB ? bid : null,
    singlePosProductId: hasS ? spid : null,
    spaProfileId: typeof decoded.spa === 'string' ? decoded.spa : null,
    email,
  };
}
