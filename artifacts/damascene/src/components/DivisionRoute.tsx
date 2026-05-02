import React from "react";
import { Redirect } from "wouter";
import { useBusinessUnit } from "@/contexts/BusinessUnitContext";

type DivisionKind = "factory" | "showroom";

/**
 * Route guard that restricts a page to users whose active business unit is of
 * the given `kind`. Per Task #28 spec: owners/admins always pass (regardless
 * of which BU they currently have selected) — they're trusted to navigate
 * the whole system. Non-privileged users are redirected to
 * /admin/unauthorized when their assigned BU's kind doesn't match.
 */
export function DivisionRoute({
  kind,
  children,
}: {
  kind: DivisionKind;
  children: React.ReactNode;
}) {
  const { activeBu, isPrivileged, isLoading } = useBusinessUnit();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-primary">
        جاري التحميل...
      </div>
    );
  }

  // Owner/admin always pass — they may freely browse any division.
  if (isPrivileged) return <>{children}</>;

  if (!activeBu) {
    return <Redirect to="~/unauthorized" />;
  }

  if (activeBu.kind !== kind) {
    return <Redirect to="~/unauthorized" />;
  }

  return <>{children}</>;
}
