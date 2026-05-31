"use client";

import type { CSSProperties } from "react";

/**
 * Broadsheet skeleton primitive. A muted paper-deep block with a slow
 * shimmer (defined in globals.css as .bsd-shimmer). Compose these into
 * page-shaped placeholders while data loads.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = 2,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className="bsd-shimmer"
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius,
        background: "var(--bsd-paper-deep)",
        ...style,
      }}
    />
  );
}

/** A stack of text-line skeletons. */
export function SkeletonText({
  lines = 3,
  gap = 10,
  lastWidth = "60%",
}: {
  lines?: number;
  gap?: number;
  lastWidth?: string;
}) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={13}
          width={i === lines - 1 ? lastWidth : "100%"}
        />
      ))}
    </span>
  );
}

/** A bordered card-shaped skeleton (eyebrow + title + body lines). */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      aria-busy="true"
      style={{
        border: "1px solid var(--bsd-rule)",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <Skeleton width={90} height={10} />
      <Skeleton width="70%" height={20} />
      <SkeletonText lines={lines} />
    </div>
  );
}
