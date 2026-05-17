"use client";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { AuditVerifyCard } from "../../components/admin/audit-verify-card";
import { SoftDeleteForm } from "../../components/admin/soft-delete-form";
import { WebhooksPanel } from "../../components/admin/webhooks-panel";
import { useAuth } from "../../lib/auth";

export default function AdminPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  return (
    <AppShell>
      {!isAdmin ? (
        <section className="card">
          <h2>Admin only</h2>
          <p className="muted">
            You&apos;re signed in as <strong>{role ?? "guest"}</strong>. The admin
            panel is restricted to users with the admin role.
          </p>
        </section>
      ) : (
        <>
          <AuditVerifyCard />
          <SoftDeleteForm />
          <WebhooksPanel />
        </>
      )}
    </AppShell>
  );
}
