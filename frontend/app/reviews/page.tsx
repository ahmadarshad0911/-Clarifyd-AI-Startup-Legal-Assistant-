"use client";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ReviewQueue } from "../../components/reviews/review-queue";

export default function ReviewsPage() {
  return (
    <AppShell>
      <ReviewQueue />
    </AppShell>
  );
}
