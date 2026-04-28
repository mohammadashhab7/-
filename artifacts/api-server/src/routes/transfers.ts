import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  transfers,
  transferItems,
  inventoryLocations,
  products,
} from "@workspace/db";
import { requireStaff, requirePermission } from "../lib/auth";
import {
  applyLedgerEntry,
  getStockQuantity,
  InsufficientStockError,
} from "../lib/inventory";
import { nextTransferNumber } from "../lib/sequences";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

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
        notesAr: r.t.notesAr,
        createdAt: r.t.createdAt.toISOString(),
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

  try {
    const t = await db.transaction(async (tx) => {
      // Pre-check stock for every item before any write
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

      const transferNumber = await nextTransferNumber();
      const created = await tx
        .insert(transfers)
        .values({
          transferNumber,
          fromLocationId: b.fromLocationId,
          toLocationId: b.toLocationId,
          notesAr: b.notesAr ?? null,
          createdByUserId: req.appUser?.id ?? null,
        })
        .returning();
      const tRow = created[0]!;

      for (const it of b.items as { productId: string; quantity: number }[]) {
        const stock = await getStockQuantity(b.fromLocationId, "product", it.productId, tx);
        const cost = stock.avgCostMinor;
        await tx.insert(transferItems).values({
          transferId: tRow.id,
          productId: it.productId,
          quantity: it.quantity,
          unitCostMinor: cost,
        });
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

      return tRow;
    });

    await logActivity({
      kind: "transfer_done",
      titleAr: `تحويل بضاعة ${t.transferNumber}`,
      referenceType: "transfer",
      referenceId: t.id,
      actor: req.appUser,
    });

    res.status(201).json({
      id: t.id,
      transferNumber: t.transferNumber,
      fromLocationId: t.fromLocationId,
      toLocationId: t.toLocationId,
      notesAr: t.notesAr,
      createdAt: t.createdAt.toISOString(),
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

export default router;
