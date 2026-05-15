"use client";

import { Children, ReactNode } from "react";

import { ScrollReveal } from "./scroll-reveal";

type Props = { children: ReactNode };

/**
 * Wraps each top-level child in a ScrollReveal so any page dropped into the
 * AppShell gets seamless scroll-in motion without per-page wiring.
 */
export function RevealChildren({ children }: Props) {
  return (
    <>
      {Children.map(children, (child, i) =>
        child == null || child === false ? (
          child
        ) : (
          <ScrollReveal delay={i === 0 ? 0 : 60}>{child}</ScrollReveal>
        )
      )}
    </>
  );
}
