import React from "react";
import { Redirect } from "wouter";
import { useBusinessUnit } from "@/contexts/BusinessUnitContext";

type DivisionKind = "factory" | "showroom";

/**
 * Route guard that restricts a page to users whose active business unit is of
 * the given `kind`. Owners/admins on the "all divisions" view always pass —
 * the sectioned sidebar already shows them every section, and we only want to
 * block users who land on a wrong-kind URL via direct navigation.
 *
 * Non-privileged users are redirected to /admin/unauthorized when their
 * assigned BU doesn't match. Privileged users with an active BU of the wrong
 * kind are also redirected — when they want the other side, they switch via
 * the DivisionSwitcher.
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

  // Owner/admin on global view — always allowed.
  if (isPrivileged && !activeBu) return <>{children}</>;

  if (!activeBu) {
    return <Redirect to="~/unauthorized" />;
  }

  if (activeBu.kind !== kind) {
    return <Redirect to="~/unauthorized" />;
  }

  return <>{children}</>;
}
