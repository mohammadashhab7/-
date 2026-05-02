import { db, activityLog } from "@workspace/db";
import type { AppUser } from "./auth";

export async function logActivity(args: {
  kind:
    | "order_placed"
    | "order_status_changed"
    | "production_started"
    | "production_completed"
    | "transfer_requested"
    | "transfer_approved"
    | "transfer_done"
    | "transfer_cancelled"
    | "low_stock"
    | "financial_entry"
    | "user_action"
    | "wholesale_order";
  titleAr: string;
  descriptionAr?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  actor?: AppUser | null;
  /**
   * Business unit this activity belongs to. NULL for global / cross-BU events
   * (e.g. catalog edits, settings changes). The recent-activity feed filters
   * by this column when an active BU is selected.
   */
  businessUnitId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityLog).values({
    kind: args.kind,
    titleAr: args.titleAr,
    descriptionAr: args.descriptionAr ?? null,
    referenceType: args.referenceType ?? null,
    referenceId: args.referenceId ?? null,
    actorUserId: args.actor?.id ?? null,
    actorNameAr: args.actor?.nameAr ?? null,
    businessUnitId: args.businessUnitId ?? null,
    metadata: args.metadata ?? {},
  });
}
