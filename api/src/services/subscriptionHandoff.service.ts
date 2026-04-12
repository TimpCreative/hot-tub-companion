import jwt from 'jsonwebtoken';
import { env } from '../config/environment';

export const SUBSCRIPTION_HANDOFF_AUDIENCE = 'subscription_handoff';
const HANDOFF_TTL_SEC = 900;

export type SubscriptionHandoffClaims = {
  userId: string;
  tenantId: string;
  bundleId: string;
  spaProfileId: string | null;
  email: string;
};

export function signSubscriptionHandoff(claims: SubscriptionHandoffClaims): string {
  return jwt.sign(
    {
      aud: SUBSCRIPTION_HANDOFF_AUDIENCE,
      tid: claims.tenantId,
      bid: claims.bundleId,
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
  const bid = decoded.bid as string | undefined;
  const email = (decoded.email as string | undefined)?.trim();
  if (!userId || !tid || !bid || !email) {
    throw new Error('INVALID_HANDOFF_TOKEN');
  }
  return {
    userId,
    tenantId: tid,
    bundleId: bid,
    spaProfileId: typeof decoded.spa === 'string' ? decoded.spa : null,
    email,
  };
}
