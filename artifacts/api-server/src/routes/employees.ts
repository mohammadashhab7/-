import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  employees,
  attendanceRecords,
  salaryRecords,
  financialEntries,
} from "@workspace/db";
import { requireStaff } from "../lib/auth";
import { nextEmployeeNumber } from "../lib/sequences";

const router: IRouter = Router();

function serialize(e: typeof employees.$inferSelect) {
  return {
    id: e.id,
    employeeNumber: e.employeeNumber,
    nameAr: e.nameAr,
    nameEn: e.nameEn,
    positionAr: e.positionAr,
    department: e.department,
    phone: e.phone,
    email: e.email,
    hireDate: e.hireDate,
    monthlySalaryMinor: e.monthlySalaryMinor,
    isActive: e.isActive,
    notesAr: e.notesAr,
  };
}

router.get("/employees", requireStaff(), async (_req, res) => {
  const rows = await db.select().from(employees).orderBy(asc(employees.nameAr));
  res.json(rows.map(serialize));
});

router.post("/employees", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.nameAr || !b.positionAr) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const employeeNumber = b.employeeNumber || (await nextEmployeeNumber());
  const inserted = await db
    .insert(employees)
    .values({
      employeeNumber,
      nameAr: b.nameAr,
      nameEn: b.nameEn ?? null,
      positionAr: b.positionAr,
      department: b.department || "production",
      phone: b.phone ?? null,
      email: b.email ?? null,
      hireDate: b.hireDate || new Date().toISOString().slice(0, 10),
      monthlySalaryMinor:
        typeof b.monthlySalaryMinor === "number" ? b.monthlySalaryMinor : 0,
      isActive: typeof b.isActive === "boolean" ? b.isActive : true,
      notesAr: b.notesAr ?? null,
    })
    .returning();
  res.status(201).json(serialize(inserted[0]!));
});

router.get("/employees/salaries", requireStaff(), async (req, res) => {
  const { employeeId, periodMonth, limit } = req.query;
  const filters = [];
  if (typeof employeeId === "string") filters.push(eq(salaryRecords.employeeId, employeeId));
  if (typeof periodMonth === "string") filters.push(eq(salaryRecords.periodMonth, periodMonth));
  const lim = Math.min(typeof limit === "string" ? parseInt(limit, 10) || 100 : 100, 500);
  const rows = await db
    .select({ s: salaryRecords, e: employees })
    .from(salaryRecords)
    .innerJoin(employees, eq(salaryRecords.employeeId, employees.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(salaryRecords.periodMonth))
    .limit(lim);
  res.json(
    rows.map((r) => ({
      id: r.s.id,
      employeeId: r.s.employeeId,
      employeeNameAr: r.e.nameAr,
      periodMonth: r.s.periodMonth,
      baseAmountMinor: r.s.baseAmountMinor,
      bonusMinor: r.s.bonusMinor,
      deductionsMinor: r.s.deductionsMinor,
      netAmountMinor: r.s.netAmountMinor,
      paidAt: r.s.paidAt?.toISOString() ?? null,
      notesAr: r.s.notesAr,
    })),
  );
});

router.post("/employees/salaries", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.employeeId || !b.periodMonth) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const emp = (
    await db.select().from(employees).where(eq(employees.id, b.employeeId)).limit(1)
  )[0];
  if (!emp) {
    res.status(404).json({ error: "EMPLOYEE_NOT_FOUND" });
    return;
  }
  const base = typeof b.baseAmountMinor === "number" ? b.baseAmountMinor : emp.monthlySalaryMinor;
  const bonus = typeof b.bonusMinor === "number" ? b.bonusMinor : 0;
  const deductions = typeof b.deductionsMinor === "number" ? b.deductionsMinor : 0;
  const net = base + bonus - deductions;
  const inserted = await db
    .insert(salaryRecords)
    .values({
      employeeId: b.employeeId,
      periodMonth: b.periodMonth,
      baseAmountMinor: base,
      bonusMinor: bonus,
      deductionsMinor: deductions,
      netAmountMinor: net,
      paidAt: new Date(),
      notesAr: b.notesAr ?? null,
    })
    .returning();
  await db.insert(financialEntries).values({
    module: emp.department === "store" ? "store" : "production",
    type: "expense",
    category: "رواتب",
    descriptionAr: `راتب ${emp.nameAr} عن ${b.periodMonth}`,
    amountMinor: net,
    referenceType: "salary",
    referenceId: inserted[0]!.id,
    createdByUserId: req.appUser?.id ?? null,
  });
  res.status(201).json({
    id: inserted[0]!.id,
    employeeId: emp.id,
    employeeNameAr: emp.nameAr,
    periodMonth: inserted[0]!.periodMonth,
    baseAmountMinor: inserted[0]!.baseAmountMinor,
    bonusMinor: inserted[0]!.bonusMinor,
    deductionsMinor: inserted[0]!.deductionsMinor,
    netAmountMinor: inserted[0]!.netAmountMinor,
    paidAt: inserted[0]!.paidAt?.toISOString() ?? null,
  });
});

router.get("/employees/:id", requireStaff(), async (req, res) => {
  const rows = await db.select().from(employees).where(eq(employees.id, req.params.id)).limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(rows[0]));
});

router.patch("/employees/:id", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  const updates: Partial<typeof employees.$inferInsert> = { updatedAt: new Date() };
  for (const k of [
    "nameAr",
    "nameEn",
    "positionAr",
    "department",
    "phone",
    "email",
    "hireDate",
    "monthlySalaryMinor",
    "isActive",
    "notesAr",
  ] as const) {
    if (b[k] !== undefined) (updates as Record<string, unknown>)[k] = b[k];
  }
  const updated = await db
    .update(employees)
    .set(updates)
    .where(eq(employees.id, req.params.id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json(serialize(updated[0]));
});

router.get("/employees/:id/attendance", requireStaff(), async (req, res) => {
  const { fromDate, toDate } = req.query;
  const filters = [eq(attendanceRecords.employeeId, req.params.id)];
  if (typeof fromDate === "string") filters.push(gte(attendanceRecords.workDate, fromDate));
  if (typeof toDate === "string") filters.push(lte(attendanceRecords.workDate, toDate));
  const rows = await db
    .select()
    .from(attendanceRecords)
    .where(and(...filters))
    .orderBy(desc(attendanceRecords.workDate));
  res.json(
    rows.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      workDate: a.workDate,
      status: a.status,
      hoursWorked: a.hoursWorked,
      notesAr: a.notesAr,
    })),
  );
});

router.post("/employees/:id/attendance", requireStaff(), async (req, res) => {
  const b = req.body ?? {};
  if (!b.workDate || !b.status) {
    res.status(400).json({ error: "VALIDATION" });
    return;
  }
  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, req.params.id),
        eq(attendanceRecords.workDate, b.workDate),
      ),
    )
    .limit(1);
  let row;
  if (existing[0]) {
    row = (
      await db
        .update(attendanceRecords)
        .set({
          status: b.status,
          hoursWorked: typeof b.hoursWorked === "number" ? b.hoursWorked : 80,
          notesAr: b.notesAr ?? null,
        })
        .where(eq(attendanceRecords.id, existing[0].id))
        .returning()
    )[0]!;
  } else {
    row = (
      await db
        .insert(attendanceRecords)
        .values({
          employeeId: req.params.id,
          workDate: b.workDate,
          status: b.status,
          hoursWorked: typeof b.hoursWorked === "number" ? b.hoursWorked : 80,
          notesAr: b.notesAr ?? null,
        })
        .returning()
    )[0]!;
  }
  res.status(201).json({
    id: row.id,
    employeeId: row.employeeId,
    workDate: row.workDate,
    status: row.status,
    hoursWorked: row.hoursWorked,
    notesAr: row.notesAr,
  });
});

export default router;
