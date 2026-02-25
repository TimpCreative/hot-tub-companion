import { Response } from 'express';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function success(
  res: Response,
  data: unknown,
  message?: string,
  pagination?: Pagination
): void {
  const body: Record<string, unknown> = {
    success: true,
    data,
  };
  if (message) body.message = message;
  if (pagination) body.pagination = pagination;
  res.json(body);
}

export function error(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: Record<string, unknown>
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  });
}
