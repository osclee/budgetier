import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import bcrypt from "bcryptjs";
import { container } from "../lib/cosmos";
import { User } from "../lib/types";
import { authCookie, clearAuthCookie, requireAuth, signToken } from "../lib/auth";
import { ok, unauthorized, withErrors } from "../lib/http";
import { loginSchema } from "../lib/validate";

// --- Simple in-memory login rate limiting (best-effort; resets on cold start) ---
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

async function findUser(username: string): Promise<User | null> {
  const { resources } = await container("users")
    .items.query<User>({
      query: "SELECT * FROM c WHERE c.username = @u",
      parameters: [{ name: "@u", value: username }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

const login = withErrors(async (request: HttpRequest): Promise<HttpResponseInit> => {
  const clientKey = request.headers.get("x-forwarded-for") || "local";
  if (rateLimited(clientKey)) {
    return { status: 429, jsonBody: { error: "Too many attempts, try again later." } };
  }

  const body = loginSchema.parse(await request.json());
  const user = await findUser(body.username);

  // Always run a bcrypt comparison to reduce username-enumeration timing differences.
  const hash = user?.passwordHash ?? "$2a$12$0000000000000000000000000000000000000000000000000000";
  const valid = await bcrypt.compare(body.password, hash);

  if (!user || !valid) {
    return unauthorized();
  }

  const token = signToken({ sub: user.id, username: user.username });
  return {
    status: 200,
    cookies: [authCookie(token)],
    jsonBody: { username: user.username },
  };
});

const logout = async (): Promise<HttpResponseInit> => {
  return { status: 200, cookies: [clearAuthCookie()], jsonBody: { ok: true } };
};

const me = async (request: HttpRequest): Promise<HttpResponseInit> => {
  const user = requireAuth(request);
  if (!user) return unauthorized();
  return ok({ username: user.username });
};

app.http("authLogin", { methods: ["POST"], authLevel: "anonymous", route: "auth/login", handler: login });
app.http("authLogout", { methods: ["POST"], authLevel: "anonymous", route: "auth/logout", handler: logout });
app.http("authMe", { methods: ["GET"], authLevel: "anonymous", route: "auth/me", handler: me });
