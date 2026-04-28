import React from "react";
import { Redirect } from "wouter";
import { useGetMe } from "@workspace/api-client-react";

export type ModuleName =
  | "products"
  | "categories"
  | "raw_materials"
  | "recipes"
  | "inventory"
  | "production"
  | "transfers"
  | "pos"
  | "orders"
  | "financial"
  | "reports"
  | "employees"
  | "users"
  | "cms"
  | "settings"
  | "media";

export function hasModulePerm(
  perms: string[] | undefined,
  role: string | undefined,
  module: ModuleName,
  action: "read" | "write" = "read",
): boolean {
  if (role === "owner" || role === "admin") return true;
  if (!perms) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(`${module}:*`)) return true;
  if (perms.includes(`${module}:${action}`)) return true;
  if (action === "read" && perms.includes(`${module}:write`)) return true;
  return false;
}

export function PermissionRoute({
  module,
  action = "read",
  children,
}: {
  module: ModuleName;
  action?: "read" | "write";
  children: React.ReactNode;
}) {
  const { data: me, isLoading } = useGetMe();
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-primary">
        جاري التحميل...
      </div>
    );
  }
  const ok = hasModulePerm(me?.permissions as string[] | undefined, me?.role, module, action);
  if (!ok) {
    return <Redirect to="/unauthorized" />;
  }
  return <>{children}</>;
}
