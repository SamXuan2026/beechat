import type { ReactNode } from "react";
import "./Badge.css";

interface BadgeProps {
  children: ReactNode;
  tone?: "success" | "danger" | "neutral" | "warning";
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`bc-badge bc-badge-${tone}`}>{children}</span>;
}
