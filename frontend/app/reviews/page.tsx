"use client";

import { AppShell } from "../../components/shell/app-shell";
import { ReviewQueue } from "../../components/reviews/review-queue";

export default function ReviewsPage() {
  return (
    <AppShell>
      <ReviewQueue />
    </AppShell>
  );
}
