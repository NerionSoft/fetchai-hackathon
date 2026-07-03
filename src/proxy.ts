/**
 * ClassroomSim runs without authentication, so the request proxy is a no-op.
 * (The starter's auth gating — which redirected "/" to /sign-in and required a
 * database + better-auth secret — is intentionally disabled here.)
 */
export async function proxy(): Promise<void> {
  return;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
