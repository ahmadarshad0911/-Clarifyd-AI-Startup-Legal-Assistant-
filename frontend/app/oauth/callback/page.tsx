"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuroraBackground } from "../../../components/common/aurora-background";
import { OrbitalLoader } from "../../../components/common/orbital-loader";

export default function OAuthCallbackPage() {
  // useSearchParams() requires a Suspense boundary in Next 14 App Router.
  return (
    <Suspense fallback={<div className="min-h-screen"><AuroraBackground /><OrbitalLoader fullscreen /></div>}>
      <OAuthCallbackInner />
    </Suspense>
  );
}

function OAuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auth is handled by Clerk; this legacy callback no longer persists a
    // bearer token client-side (a localStorage token is XSS-readable). Surface
    // any provider error, otherwise send the user to the Clerk sign-in flow.
    const err = params.get("error");
    if (err) {
      setError(err);
      return;
    }
    const isNew = params.get("new") === "1";
    window.location.replace(isNew ? "/terms?next=/onboarding/profile" : "/login");
  }, [params, router]);

  return (
    <div className="min-h-screen relative">
      <AuroraBackground />
      {error ? (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="crystal-glass rounded-3xl p-8 max-w-md text-center">
            <span className="material-symbols-outlined text-status-danger text-[48px] mb-2 block">
              error
            </span>
            <h2 className="font-display-hero text-h2 text-onboarding-navy m-0">
              Sign-in failed
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-2 m-0">
              {decodeURIComponent(error)}
            </p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="btn-capsule btn-capsule-primary mt-6"
            >
              Back to sign in
            </button>
          </div>
        </div>
      ) : (
        <OrbitalLoader fullscreen statusLines={["Verifying identity…", "Issuing session token…", "Loading workspace…"]} />
      )}
    </div>
  );
}
