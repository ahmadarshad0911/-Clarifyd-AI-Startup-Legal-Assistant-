import { clerkMiddleware } from "@clerk/nextjs/server";

// NOTE: We deliberately do NOT call auth.protect() / redirect at the edge.
// On a hard refresh the server-side session cookie isn't always visible in
// time, so edge protection bounced authenticated users through /login —
// and Clerk's own post-handshake redirect then dumped them on /dashboard,
// losing the page they were on. Gating now lives client-side in the app
// shells (DarkAppShell redirects to /login when there's no token), which
// sees the rehydrated Clerk session reliably. clerkMiddleware still runs so
// auth() context is available; it just never redirects.
export default clerkMiddleware(async () => {
  // Intentionally empty — session context only, no protection redirect.
});

export const config = {
  matcher: [
    // Skip Next internals + static files
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk auto-proxy path (per Clerk docs)
    "/__clerk/(.*)",
  ],
};
