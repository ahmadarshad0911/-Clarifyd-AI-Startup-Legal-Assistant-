// Minimal ambient shim — @types/react-dom has a peer-conflict on this
// project's React version. We only use createPortal so type just that.
declare module "react-dom" {
  import type { ReactNode } from "react";
  export function createPortal(
    children: ReactNode,
    container: Element | DocumentFragment,
    key?: string | null
  ): ReactNode;
}
