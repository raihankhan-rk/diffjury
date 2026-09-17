import type { ReviewInput } from "@/lib/types";

/** Small public PR used by the quiet sample chip on the landing screen. */
export const SAMPLE_PR_URL = "https://github.com/actions/checkout/pull/1";

/** Realistic TypeScript PR fixture for API/docs demos. */
export const SAMPLE_PR: ReviewInput = {
  title: "feat(auth): add session refresh middleware for API routes",
  body: `## Summary
Adds a Next.js middleware that refreshes short-lived session tokens before they expire, and wires it into protected \`/api/*\` routes.

## Motivation
Users were getting 401s mid-session when access tokens expired during long form edits. Support ticket #482.

## Changes
- New \`src/middleware.ts\` that checks \`Authorization\` / session cookie
- Shared \`refreshSession()\` helper with 5s timeout
- Unit tests for happy path + expired token
- Docs note in \`README.md\`

## Test plan
- [x] Unit tests for refresh helper
- [ ] Manual QA on staging with slow network
- [ ] Confirm no refresh loop on public routes

## Rollout
Feature-flagged via \`ENABLE_SESSION_REFRESH\` (default off in prod until canary).`,
  diff: `diff --git a/src/middleware.ts b/src/middleware.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/middleware.ts
@@ -0,0 +1,48 @@
+import { NextResponse } from "next/server";
+import type { NextRequest } from "next/server";
+import { refreshSession } from "@/lib/auth/refresh";
+
+export async function middleware(request: NextRequest) {
+  if (!process.env.ENABLE_SESSION_REFRESH) {
+    return NextResponse.next();
+  }
+
+  const path = request.nextUrl.pathname;
+  if (!path.startsWith("/api/") || path.startsWith("/api/public")) {
+    return NextResponse.next();
+  }
+
+  const token = request.cookies.get("session")?.value;
+  if (!token) {
+    return NextResponse.next();
+  }
+
+  try {
+    const refreshed = await refreshSession(token);
+    if (!refreshed) {
+      return NextResponse.next();
+    }
+
+    const response = NextResponse.next();
+    response.cookies.set("session", refreshed, {
+      httpOnly: true,
+      secure: true,
+      sameSite: "lax",
+      path: "/",
+    });
+    return response;
+  } catch {
+    // Fail open: do not block the request if refresh fails
+    return NextResponse.next();
+  }
+}
+
+export const config = {
+  matcher: ["/api/:path*"],
+};
diff --git a/src/lib/auth/refresh.ts b/src/lib/auth/refresh.ts
new file mode 100644
index 0000000..d4e5f6a
--- /dev/null
+++ b/src/lib/auth/refresh.ts
@@ -0,0 +1,36 @@
+const REFRESH_URL = process.env.AUTH_REFRESH_URL ?? "https://auth.example.com/oauth/token";
+
+export async function refreshSession(token: string): Promise<string | null> {
+  const controller = new AbortController();
+  const timer = setTimeout(() => controller.abort(), 5000);
+
+  try {
+    const res = await fetch(REFRESH_URL, {
+      method: "POST",
+      headers: { "Content-Type": "application/json" },
+      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: token }),
+      signal: controller.signal,
+    });
+
+    if (!res.ok) {
+      return null;
+    }
+
+    const data = (await res.json()) as { access_token?: string };
+    return data.access_token ?? null;
+  } finally {
+    clearTimeout(timer);
+  }
+}
diff --git a/src/lib/auth/refresh.test.ts b/src/lib/auth/refresh.test.ts
new file mode 100644
index 0000000..b7c8d9e
--- /dev/null
+++ b/src/lib/auth/refresh.test.ts
@@ -0,0 +1,28 @@
+import { describe, it, expect, vi, afterEach } from "vitest";
+import { refreshSession } from "./refresh";
+
+afterEach(() => {
+  vi.restoreAllMocks();
+});
+
+describe("refreshSession", () => {
+  it("returns access_token on success", async () => {
+    vi.stubGlobal(
+      "fetch",
+      vi.fn().mockResolvedValue({
+        ok: true,
+        json: async () => ({ access_token: "new-token" }),
+      }),
+    );
+
+    await expect(refreshSession("old")).resolves.toBe("new-token");
+  });
+
+  it("returns null when upstream fails", async () => {
+    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
+    await expect(refreshSession("old")).resolves.toBeNull();
+  });
+});
diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -12,6 +12,10 @@
 ## Auth
 Session cookies are httpOnly. Access tokens expire after 15 minutes.
+
+### Session refresh
+Set \`ENABLE_SESSION_REFRESH=1\` to refresh sessions in middleware for \`/api/*\` routes.
+Requires \`AUTH_REFRESH_URL\` pointing at your OAuth token endpoint.
`,
  ciLog: `✓ lint (12s)
✓ typecheck (18s)
✓ unit (vitest) — 2 passed (1.4s)
⚠ e2e — skipped (no staging credentials in CI)
Bundle size: middleware +4.2kb gzipped`,
  linkedIssue:
    "#482 Users get intermittent 401s during long editing sessions when access tokens expire.",
};
