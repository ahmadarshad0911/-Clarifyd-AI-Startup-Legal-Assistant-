"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AuroraBackground } from "../../../components/common/aurora-background";
import { OrbitalLoader } from "../../../components/common/orbital-loader";

const TOKEN_KEY = "clarifyd.token";
const ROLE_KEY = "clarifyd.role";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    const role = params.get("role") ?? "reviewer";
    const err = params.get("error");
    const isNew = params.get("new") === "1";

    if (err) {
      setError(err);
      return;
    }
    if (!token) {
      setError("missing_token");
      return;
    }
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(ROLE_KEY, role);
    } catch {
      setError("storage_blocked");
      return;
    }
    // Hard reload so AuthProvider re-hydrates from the freshly written token.
    const next = isNew ? "/terms?next=/onboarding/profile" : "/dashboard";
    window.location.replace(next);
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
