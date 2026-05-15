"use client";

import { ElementType, ReactNode, useEffect, useRef, useState } from "react";

type Variant = "up" | "left" | "right" | "scale" | "stagger";

type Props = {
  children: ReactNode;
  /** Motion style. Default "up". */
  variant?: Variant;
  /** Extra classes on the wrapper. */
  className?: string;
  /** Element tag to render. Default "div". */
  as?: ElementType;
  /** Delay before revealing, ms. */
  delay?: number;
  /** Re-trigger every time it enters view. Default false (reveal once). */
  repeat?: boolean;
};

const VARIANT_CLASS: Record<Variant, string> = {
  up: "reveal",
  left: "reveal reveal-left",
  right: "reveal reveal-right",
  scale: "reveal reveal-scale",
  stagger: "reveal-stagger",
};

export function ScrollReveal({
  children,
  variant = "up",
  className = "",
  as,
  delay = 0,
  repeat = false,
}: Props) {
  const Tag: ElementType = as ?? "div";
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            if (!repeat) obs.unobserve(e.target);
          } else if (repeat) {
            setVisible(false);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [repeat]);

  return (
    <Tag
      ref={ref}
      className={`${VARIANT_CLASS[variant]} ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
