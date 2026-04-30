import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  transfers,
  transferItems,
  inventoryLocations,
  products,
} from "@workspace/db";
import { requirePermission } from "../lib/auth";
import {
  applyLedgerEntry,
  getStockQuantity,
  InsufficientStockError,
} from "../lib/inventory";
import { nextTransferNumber } from "../lib/sequences";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

type TransferStatus = "pending" | "approved" | "completed" | "cancelled";

router.get("/transfers", requirePermission("transfers", "read"), async (_req, res) => {
  const rows = await db
    .select({
      t: transfers,
    })
    .from(transfers)
    .orderBy(desc(transfers.createdAt))
    .limit(100);
  const all = await Promise.all(
    rows.map(async (r) => {
      const items = await db
        .select({ ti: transferItems, p: products })
        .from(transferItems)
        .innerJoin(products, eq(transferItems.productId, products.id))
        .where(eq(transferItems.transferId, r.t.id));
      const locs = await db
        .select()
        .from(inventoryLocations)
        .where(eq(inventoryLocations.id, r.t.fromLocationId));
      const locTo = await db
        .select()
        .from(inventoryLocations)
        .where(eq(inventoryLocations.id, r.t.toLocationId));
      return {
        id: r.t.id,
        transferNumber: r.t.transferNumber,
        fromLocationId: r.t.fromLocationId,
        fromLocationNameAr: locs[0]?.nameAr ?? null,
        toLocationId: r.t.toLocationId,
        toLocationNameAr: locTo[0]?.nameAr ?? null,
        status: r.t.status as TransferStatus,
        notesAr: r.t.notesAr,
        createdAt: r.t.createdAt.toISOString(),
        approvedAt: r.t.approvedAt ? r.t.approvedAt.toISOString() : null,
        completedAt: r.t.completedAt ? r.t.completedAt.toISOString() : null,
        cancelledAt: r.t.cancelledAt ? r.t.cancelledAt.toISOString() : null,
        items: items.map((x) => ({
          productId: x.ti.productId,
          productNameAr: x.p.nameAr,
          quantity: x.ti.quantity,
          unitCostMinor: x.ti.unitCostMinor,
        })),
      };
    }),
  );
  res.json(all);
});

router.post("/transfers", requirePermission("transfers", "write"), async (req, res) => {
  const b = req.body ?? {};
  if (
    !b.fromLocationId ||
    !b.toLocationId ||
    !Array.isArray(b.items) ||
    b.items.length === 0
  ) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  if (b.fromLocationId === b.toLocationId) {
    res.status(400).json({ error: "SAME_LOCATION" });
    return;
  }

  // Only "pending" or "completed" are valid create-time statuses. Reject other inputs
  // explicitly rather than silently coercing them.
  if (b.status !== undefined && b.status !== "pending" && b.status !== "completed") {
    res.status(400).json({ error: "INVALID_STATUS_INPUT", detail: b.status });
    return;
  }

  // Default behavior preserves existing immediate-execute UX. Pass executeImmediately=false
  // (or status="pending") to create a transfer request that does not move stock.
  const requestedStatus: TransferStatus =
    b.status === "pending" || b.executeImmediately === false
      ? "pending"
      : "completed";

  try {
    const t = await db.transaction(async (tx) => {
      // Pre-check stock for every item before any write only for immediate-complete path
      if (requestedStatus === "completed") {
        for (const it of b.items as { productId: string; quantity: number }[]) {
          const stock = await getStockQuantity(b.fromLocationId, "product", it.productId, tx);
          if (stock.quantity < it.quantity) {
            throw new InsufficientStockError(
              b.fromLocationId,
              "product",
              it.productId,
              stock.quantity,
              it.quantity,
            );
          }
        }
      }

      const transferNumber = await nextTransferNumber();
      const now = new Date();
      const created = await tx
        .insert(transfers)
        .values({
          transferNumber,
          fromLocationId: b.fromLocationId,
          toLocationId: b.toLocationId,
          status: requestedStatus,
          notesAr: b.notesAr ?? null,
          createdByUserId: req.appUser?.id ?? null,
          completedByUserId:
            requestedStatus === "completed" ? req.appUser?.id ?? null : null,
          completedAt: requestedStatus === "completed" ? now : null,
        })
        .returning();
      const tRow = created[0]!;

      for (const it of b.items as { productId: string; quantity: number }[]) {
        // Snapshot avg cost at creation time so completion uses request-time pricing
        const stock = await getStockQuantity(b.fromLocationId, "product", it.productId, tx);
        const cost = stock.avgCostMinor;
        await tx.insert(transferItems).values({
          transferId: tRow.id,
          productId: it.productId,
          quantity: it.quantity,
          unitCostMinor: cost,
        });

        if (requestedStatus === "completed") {
          await applyLedgerEntry(
            {
              locationId: b.fromLocationId,
              itemType: "product",
              productId: it.productId,
              quantityDelta: -it.quantity,
              unitCostMinor: cost,
              reason: "transfer_out",
              referenceType: "transfer",
              referenceId: tRow.id,
              createdByUserId: req.appUser?.id ?? null,
            },
            tx,
          );
          await applyLedgerEntry(
            {
              locationId: b.toLocationId,
              itemType: "product",
              productId: it.productId,
              quantityDelta: it.quantity,
              unitCostMinor: cost,
              reason: "transfer_in",
              referenceType: "transfer",
              referenceId: tRow.id,
              createdByUserId: req.appUser?.id ?? null,
            },
            tx,
          );
        }
      }

      return tRow;
    });

    await logActivity({
      kind: requestedStatus === "completed" ? "transfer_done" : "transfer_requested",
      titleAr:
        requestedStatus === "completed"
          ? `تحويل بضاعة ${t.transferNumber}`
          : `طلب تحويل ${t.transferNumber}`,
      referenceType: "transfer",
      referenceId: t.id,
      actor: req.appUser,
    });

    res.status(201).json({
      id: t.id,
      transferNumber: t.transferNumber,
      fromLocationId: t.fromLocationId,
      toLocationId: t.toLocationId,
      status: t.status,
      notesAr: t.notesAr,
      createdAt: t.createdAt.toISOString(),
      approvedAt: t.approvedAt ? t.approvedAt.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      cancelledAt: t.cancelledAt ? t.cancelledAt.toISOString() : null,
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      res.status(409).json({ error: "INSUFFICIENT_STOCK", detail: err.message });
      return;
    }
    req.log.error({ err }, "transfer create failed");
    res.status(500).json({ error: "INTERNAL" });
  }
});

router.post(
  "/transfers/:id/approve",
  requirePermission("transfers", "write"),
  async (req, res) => {
    const id = req.params.id as string;
    // Atomic conditional update: only transition if currently pending. This avoids the
    // read-then-update race where two concurrent approvers could both pass the check.
    const updated = await db
      .update(transfers)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvedByUserId: req.appUser?.id ?? null,
      })
      .where(and(eq(transfers.id, id), eq(transfers.status, "pending")))
      .returning();
    if (updated.length === 0) {
      const exists = await db
        .select({ id: transfers.id, status: transfers.status })
        .from(transfers)
        .where(eq(transfers.id, id));
      if (exists.length === 0) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.status(409).json({ error: "INVALID_STATUS", detail: exists[0]!.status });
      return;
    }
    const row = updated[0]!;
    await logActivity({
      kind: "transfer_approved",
      titleAr: `اعتماد تحويل ${row.transferNumber}`,
      referenceType: "transfer",
      referenceId: row.id,
      actor: req.appUser,
    });
    res.json({ id: row.id, status: row.status });
  },
);

router.post(
  "/transfers/:id/complete",
  requirePermission("transfers", "write"),
  async (req, res) => {
    const id = req.params.id as string;
    try {
      const result = await db.transaction(async (tx) => {
        // Atomic conditional state transition: claim the row by flipping the status
        // FIRST inside the transaction. Concurrent calls will return 0 rows on the
        // second attempt, guaranteeing only one transaction writes ledger entries.
        const claimed = await tx
          .update(transfers)
          .set({
            status: "completed",
            completedAt: new Date(),
            completedByUserId: req.appUser?.id ?? null,
          })
          .where(
            and(
              eq(transfers.id, id),
              inArray(transfers.status, ["pending", "approved"]),
            ),
          )
          .returning();
        if (claimed.length === 0) {
          const exists = await tx
            .select({ id: transfers.id, status: transfers.status })
            .from(transfers)
            .where(eq(transfers.id, id));
          if (exists.length === 0) return { notFound: true as const };
          return { invalid: exists[0]!.status };
        }
        const t = claimed[0]!;

        const items = await tx
          .select()
          .from(transferItems)
          .where(eq(transferItems.transferId, id));

        // Pre-check stock for every item before any write
        for (const it of items) {
          const stock = await getStockQuantity(
            t.fromLocationId,
            "product",
            it.productId,
            tx,
          );
          if (stock.quantity < it.quantity) {
            throw new InsufficientStockError(
              t.fromLocationId,
              "product",
              it.productId,
              stock.quantity,
              it.quantity,
            );
          }
        }

        for (const it of items) {
          // Use snapshotted unit cost from creation time
          const cost = it.unitCostMinor;
          await applyLedgerEntry(
            {
              locationId: t.fromLocationId,
              itemType: "product",
              productId: it.productId,
              quantityDelta: -it.quantity,
              unitCostMinor: cost,
              reason: "transfer_out",
              referenceType: "transfer",
              referenceId: t.id,
              createdByUserId: req.appUser?.id ?? null,
            },
            tx,
          );
          await applyLedgerEntry(
            {
              locationId: t.toLocationId,
              itemType: "product",
              productId: it.productId,
              quantityDelta: it.quantity,
              unitCostMinor: cost,
              reason: "transfer_in",
              referenceType: "transfer",
              referenceId: t.id,
              createdByUserId: req.appUser?.id ?? null,
            },
            tx,
          );
        }

        return { row: t, transferNumber: t.transferNumber };
      });

      if ("notFound" in result) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      if ("invalid" in result) {
        res.status(409).json({ error: "INVALID_STATUS", detail: result.invalid });
        return;
      }
      await logActivity({
        kind: "transfer_done",
        titleAr: `تنفيذ تحويل ${result.transferNumber}`,
        referenceType: "transfer",
        referenceId: result.row.id,
        actor: req.appUser,
      });
      res.json({ id: result.row.id, status: result.row.status });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        res.status(409).json({ error: "INSUFFICIENT_STOCK", detail: err.message });
        return;
      }
      req.log.error({ err }, "transfer complete failed");
      res.status(500).json({ error: "INTERNAL" });
    }
  },
);

router.post(
  "/transfers/:id/cancel",
  requirePermission("transfers", "write"),
  async (req, res) => {
    const id = req.params.id as string;
    // Atomic conditional update: only transition from pending/approved to cancelled.
    // Prevents the read-then-update race where complete + cancel could both succeed.
    const updated = await db
      .update(transfers)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByUserId: req.appUser?.id ?? null,
      })
      .where(
        and(
          eq(transfers.id, id),
          inArray(transfers.status, ["pending", "approved"]),
        ),
      )
      .returning();
    if (updated.length === 0) {
      const exists = await db
        .select({ id: transfers.id, status: transfers.status })
        .from(transfers)
        .where(eq(transfers.id, id));
      if (exists.length === 0) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.status(409).json({ error: "INVALID_STATUS", detail: exists[0]!.status });
      return;
    }
    const row = updated[0]!;
    await logActivity({
      kind: "transfer_cancelled",
      titleAr: `إلغاء تحويل ${row.transferNumber}`,
      referenceType: "transfer",
      referenceId: row.id,
      actor: req.appUser,
    });
    res.json({ id: row.id, status: row.status });
  },
);

export default router;
