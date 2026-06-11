import type { NextRequest } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { badRequest } from "@/lib/http/errors";
import { handleRouteError, jsonSuccess, type ApiSuccess } from "@/lib/http/response";
import type { NextResponse } from "next/server";

type HandlerContext = {
  request: NextRequest;
  params: Record<string, string>;
};

type RouteHandler<T> = (ctx: HandlerContext) => Promise<T>;

export function createApiHandler<T>(handler: RouteHandler<T>) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ) => {
    try {
      const params = await context.params;
      const data = await handler({ request, params });
      return jsonSuccess(data);
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

export async function parseJsonBody<T>(request: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Corpo da requisição inválido (JSON esperado)");
  }

  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw badRequest("Dados inválidos", error.flatten());
    }
    throw error;
  }
}
