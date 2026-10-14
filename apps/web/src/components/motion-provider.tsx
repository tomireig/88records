"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Con prefers-reduced-motion, Motion salta las animaciones de transform y deja todo visible. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
