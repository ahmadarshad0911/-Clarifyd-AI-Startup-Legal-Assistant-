import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that demand a signed-in user. Everything else (landing, /login, /faq,
// /pricing, etc.) stays public so the marketing site still works for
// unauthenticated visitors.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/findings(.*)",
  "/copilot(.*)",
  "/negotiation(.*)",
  "/exports(.*)",
  "/profile(.*)",
  "/admin(.*)",
  "/onboarding(.*)",
  "/comments(.*)",
  "/feedback(.*)",
  "/lawyer(.*)",
  "/library(.*)",
  "/reasoning(.*)",
  "/integrations(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals + static files
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
