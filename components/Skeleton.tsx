import type { ReactNode } from "react";

// Shimmering placeholder. Pass the same classes the real element uses so sizes match.
export function Skeleton({ className = "", children }: { className?: string; children?: ReactNode }) {
  return <span className={`sk ${className}`}>{children}</span>;
}

// Mirrors a person row in the share panel (nbsp keeps the real line heights),
// so swapping in the loaded rows doesn't shift the layout.
export function PersonRowSkeleton() {
  return (
    <li aria-hidden="true">
      <Skeleton className="avatar sm" />
      <span className="person">
        <Skeleton className="sk-name">&nbsp;</Skeleton>
        <Skeleton className="muted sk-email">&nbsp;</Skeleton>
      </span>
      <Skeleton className="sk-control" />
    </li>
  );
}
