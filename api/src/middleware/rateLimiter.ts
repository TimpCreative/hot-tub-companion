import rateLimit from 'express-rate-limit';

export const defaultRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const fcmTokenRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many FCM token updates' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const notificationSendRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many notification actions' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const superAdminAnnouncementRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many announcement sends' } },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Customer order history reads (abuse-resistant; per IP + tenant still bounded by auth). */
export const commerceOrdersReadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many order list requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});
