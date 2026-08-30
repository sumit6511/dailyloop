export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/** Fastify's error handler types its `error` param as `unknown` — this narrows without
 * assuming which concrete error class actually produced it (e.g. @fastify/rate-limit's). */
export function hasStatusCode(error: unknown, statusCode: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === statusCode
  );
}

export const Errors = {
  unauthorized: (message = "Authentication required") => new ApiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You don't have permission to do that") => new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") => new ApiError(404, "NOT_FOUND", message),
  conflict: (message: string) => new ApiError(409, "CONFLICT", message),
  badRequest: (message: string, details?: unknown) => new ApiError(400, "BAD_REQUEST", message, details),
};
