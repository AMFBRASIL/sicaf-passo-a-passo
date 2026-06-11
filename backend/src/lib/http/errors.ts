export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: ErrorCode = "INTERNAL_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(message, 400, "BAD_REQUEST", details);
}

export function unauthorized(message = "Não autenticado"): AppError {
  return new AppError(message, 401, "UNAUTHORIZED");
}

export function forbidden(message = "Acesso negado"): AppError {
  return new AppError(message, 403, "FORBIDDEN");
}

export function notFound(message = "Recurso não encontrado"): AppError {
  return new AppError(message, 404, "NOT_FOUND");
}
