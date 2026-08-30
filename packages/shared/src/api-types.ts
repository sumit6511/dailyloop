export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export function isApiError(body: unknown): body is ApiErrorBody {
  return typeof body === "object" && body !== null && "error" in body;
}
