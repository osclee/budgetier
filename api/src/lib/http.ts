import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ZodError } from "zod";
import { requireAuth } from "./auth";
import { JwtPayload } from "./types";

export function json(status: number, body: unknown): HttpResponseInit {
  return { status, jsonBody: body };
}

export function ok(body: unknown): HttpResponseInit {
  return json(200, body);
}

export function badRequest(message: string, details?: unknown): HttpResponseInit {
  return json(400, { error: message, details });
}

export function unauthorized(): HttpResponseInit {
  return json(401, { error: "Unauthorized" });
}

export function notFound(message = "Not found"): HttpResponseInit {
  return json(404, { error: message });
}

export type AuthedHandler = (
  request: HttpRequest,
  context: InvocationContext,
  user: JwtPayload
) => Promise<HttpResponseInit>;

/**
 * Wraps a handler so it only runs for authenticated requests. Also converts thrown
 * ZodErrors into 400s and unexpected errors into 500s (without leaking internals).
 */
export function withAuth(handler: AuthedHandler) {
  return async (
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> => {
    const user = requireAuth(request);
    if (!user) return unauthorized();
    try {
      return await handler(request, context, user);
    } catch (err) {
      return handleError(err, context);
    }
  };
}

/** Wraps a public handler with the same error handling (used by login). */
export function withErrors(
  handler: (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
) {
  return async (
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> => {
    try {
      return await handler(request, context);
    } catch (err) {
      return handleError(err, context);
    }
  };
}

function handleError(err: unknown, context: InvocationContext): HttpResponseInit {
  if (err instanceof ZodError) {
    return badRequest("Validation failed", err.flatten());
  }
  context.error("Unhandled error", err);
  return json(500, { error: "Internal server error" });
}
