import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/http/errors";
import { logger } from "@/lib/logger/logger";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function jsonSuccess<T>(
  data: T,
  init?: { status?: number; meta?: Record<string, unknown> },
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    { success: true as const, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 },
  );
}

export function jsonError(error: AppError): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      success: false as const,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    },
    { status: error.statusCode },
  );
}

export function handleRouteError(error: unknown): NextResponse<ApiFailure> {
  if (isAppError(error)) {
    if (error.statusCode >= 500) {
      logger.error({ err: error }, error.message);
    }
    return jsonError(error);
  }

  logger.error({ err: error }, "Erro interno não tratado");
  return jsonError(new AppError("Erro interno do servidor", 500, "INTERNAL_ERROR"));
}
