/**
 * Seed script for الدمشقي.
 * Idempotent: safe to run multiple times.
 *
 * Run with: pnpm --filter @workspace/api-server exec tsx src/seed.ts
 */
import { eq, sql } from "drizzle-orm";
import {
  db,
  inventoryLocations,
  categories,
  products,
  rawMaterials,
  recipes,
  recipeItems,
  employees,
  contentBlocks,
  settings,
  salesOrders,
  salesOrderItems,
  financialEntries,
  attendanceRecords,
  salaryRecords,
  productionOrders,
  productionOrderItems,
  stockLevels,
  inventoryLedger,
  activityLog,
  cartItems,
  carts,
  transferItems,
  transfers,
  dailyClosings,
  mediaAssets,
  users,
} from "@workspace/db";
import { CURRENCY_CODE, CURRENCY_SYMBOL, COUNTRY_CODE } from "./lib/region.js";

const log = (...args: unknown[]) => console.log("[seed]", ...args);

async function clearAll() {
  log("clearing existing data...");
  await db.delete(salesOrderItems);
  await db.delete(salesOrders);
  await db.delete(financialEntries);
  await db.delete(attendanceRecords);
  await db.delete(salaryRecords);
  await db.delete(productionOrderItems);
  await db.delete(productionOrders);
  await db.delete(transferItems);
  await db.delete(transfers);
  await db.delete(dailyClosings);
  await db.delete(inventoryLedger);
  await db.delete(stockLevels);
  await db.delete(cartItems);
  await db.delete(carts);
  await db.delete(activityLog);
  await db.delete(recipeItems);
  await db.delete(recipes);
  await db.delete(rawMaterials);
  await db.delete(products);
  await db.delete(categories);
  await db.delete(employees);
  await db.delete(contentBlocks);
  await db.delete(mediaAssets);
  await db.delete(inventoryLocations);
  await db.delete(settings);
}

async function seedSettings() {
  log("settings...");
  await db.insert(settings).values({
    id: 1,
    storeNameAr: "الدمشقي",
    storeNameEn: "Damascene",
    taglineAr: "حلويات شامية أصيلة منذ ١٩٧٢",
    addressAr: "شارع ركب، رام الله، فلسطين",
    phone: "+970 2 295 1972",
    email: "info@damascene.ps",
    countryCode: COUNTRY_CODE,
    currencySymbol: CURRENCY_SYMBOL,
    taxPercent: 0,
    deliveryFeeMinor: 15000,
    freeDeliveryThresholdMinor: 200000,
    socialFacebook: "https://facebook.com/damascene",
    socialInstagram: "https://instagram.com/damascene",
    socialWhatsapp: "+970592202232",
    workingHoursAr: "السبت - الخميس: ٨ صباحاً - ١١ مساءً • الجمعة: ٢ ظهراً - ١١ مساءً",
    metadata: {},
  });
}

async function seedLocations() {
  log("locations...");
  const rows = await db
    .insert(inventoryLocations)
    .values([
      { code: "PROD-RAW", nameAr: "مخزن المواد الخام - المعمل", kind: "production_raw" },
      { code: "PROD-FIN", nameAr: "مخزن الإنتاج النهائي - المعمل", kind: "production_finished" },
      { code: "STORE", nameAr: "مخزن المعرض - الميدان", kind: "store" },
    ])
    .returning();
  return {
    raw: rows.find((r) => r.code === "PROD-RAW")!,
    fin: rows.find((r) => r.code === "PROD-FIN")!,
    store: rows.find((r) => r.code === "STORE")!,
  };
}

async function seedCategories() {
  log("categories...");
  const data = [
    { slug: "baklava", nameAr: "بقلاوة", nameEn: "Baklava", descriptionAr: "أصناف البقلاوة بالفستق الحلبي والقشطة", sortOrder: 10 },
    { slug: "maamoul", nameAr: "معمول", nameEn: "Maamoul", descriptionAr: "معمول التمر، الفستق، والجوز بالسمن البلدي", sortOrder: 20 },
    { slug: "kunafa", nameAr: "كنافة", nameEn: "Kunafa", descriptionAr: "كنافة نابلسية بالجبن والقشطة", sortOrder: 30 },
    { slug: "halawat-el-jebn", nameAr: "حلاوة الجبن", nameEn: "Halawat el Jebn", descriptionAr: "حلاوة الجبن الشامية بالقشطة والفستق", sortOrder: 40 },
    { slug: "ghraybeh", nameAr: "غريبة", nameEn: "Ghraybeh", descriptionAr: "غريبة بالسمنة العربية", sortOrder: 50 },
    { slug: "mabrouma", nameAr: "مبرومة", nameEn: "Mabrouma", descriptionAr: "مبرومة بالفستق الحلبي", sortOrder: 60 },
    { slug: "harissa", nameAr: "هريسة وبسبوسة", nameEn: "Harissa", descriptionAr: "هريسة بالقشطة والسميد", sortOrder: 70 },
    { slug: "muhalabieh", nameAr: "حلويات بيتية", nameEn: "Pudding & Cold", descriptionAr: "مهلبية، ليالي لبنان، مغلي", sortOrder: 80 },
  ];
  return await db.insert(categories).values(data).returning();
}

async function seedRawMaterials() {
  log("raw materials...");
  const data = [
    { sku: "RM-FLOUR", nameAr: "طحين أبيض", unit: "kg", unitCostMinor: 8000 },
    { sku: "RM-SEMOLINA", nameAr: "سميد ناعم", unit: "kg", unitCostMinor: 9500 },
    { sku: "RM-SUGAR", nameAr: "سكر أبيض", unit: "kg", unitCostMinor: 12000 },
    { sku: "RM-BUTTER", nameAr: "زبدة بلدية", unit: "kg", unitCostMinor: 95000 },
    { sku: "RM-GHEE", nameAr: "سمن عربي", unit: "kg", unitCostMinor: 110000 },
    { sku: "RM-PISTACHIO", nameAr: "فستق حلبي خام", unit: "kg", unitCostMinor: 850000, reorderThreshold: 5000 },
    { sku: "RM-WALNUT", nameAr: "جوز مقشر", unit: "kg", unitCostMinor: 280000 },
    { sku: "RM-DATES", nameAr: "تمر معجون", unit: "kg", unitCostMinor: 60000 },
    { sku: "RM-CHEESE", nameAr: "جبنة عكاوي", unit: "kg", unitCostMinor: 85000 },
    { sku: "RM-MILK", nameAr: "حليب طازج", unit: "L", unitCostMinor: 15000 },
    { sku: "RM-CREAM", nameAr: "قشطة طازجة", unit: "kg", unitCostMinor: 75000 },
    { sku: "RM-ROSEWATER", nameAr: "ماء ورد دمشقي", unit: "L", unitCostMinor: 45000 },
    { sku: "RM-BLOSSOM", nameAr: "ماء زهر", unit: "L", unitCostMinor: 50000 },
    { sku: "RM-PHYLLO", nameAr: "عجينة فيلو", unit: "kg", unitCostMinor: 35000 },
    { sku: "RM-KATAIFI", nameAr: "شعيرية كنافة", unit: "kg", unitCostMinor: 22000 },
    { sku: "RM-SESAME", nameAr: "سمسم محمص", unit: "kg", unitCostMinor: 65000 },
    { sku: "RM-CARDAMOM", nameAr: "هيل مطحون", unit: "kg", unitCostMinor: 480000 },
    { sku: "RM-MAHLEB", nameAr: "محلب", unit: "kg", unitCostMinor: 220000 },
    { sku: "RM-EGG", nameAr: "بيض", unit: "piece", unitCostMinor: 1800 },
    { sku: "RM-YEAST", nameAr: "خميرة فورية", unit: "kg", unitCostMinor: 25000 },
  ];
  const rows = await db
    .insert(rawMaterials)
    .values(
      data.map((d) => ({
        ...d,
        currency: CURRENCY_CODE,
        reorderThreshold: d.reorderThreshold ?? 0,
      })),
    )
    .returning();
  const map: Record<string, (typeof rows)[number]> = {};
  rows.forEach((r) => (map[r.sku] = r));
  return map;
}

async function seedProducts(cats: Awaited<ReturnType<typeof seedCategories>>) {
  log("products...");
  const byslug = (s: string) => cats.find((c) => c.slug === s)!;
  const data = [
    { sku: "P-BAK-MIX", slug: "baklava-mix-1kg", nameAr: "بقلاوة مشكلة كيلو", categorySlug: "baklava", priceMinor: 320000, weightGrams: 1000, isFeatured: true, descriptionAr: "تشكيلة من خمسة أصناف بقلاوة بالفستق الحلبي والقشطة، صناعة يومية." },
    { sku: "P-BAK-PIST", slug: "baklava-pistachio-1kg", nameAr: "بقلاوة بالفستق كيلو", categorySlug: "baklava", priceMinor: 380000, weightGrams: 1000, isFeatured: true, descriptionAr: "بقلاوة كلاسيكية محشوة بالفستق الحلبي الفاخر." },
    { sku: "P-BAK-CRM", slug: "baklava-cream-500g", nameAr: "بقلاوة بالقشطة نصف كيلو", categorySlug: "baklava", priceMinor: 195000, weightGrams: 500, descriptionAr: "بقلاوة طازجة بالقشطة البلدية." },
    { sku: "P-MAA-DATE", slug: "maamoul-dates-1kg", nameAr: "معمول تمر كيلو", categorySlug: "maamoul", priceMinor: 180000, weightGrams: 1000, isFeatured: true, descriptionAr: "معمول بالتمر المعجون والسمن العربي." },
    { sku: "P-MAA-PIST", slug: "maamoul-pistachio-1kg", nameAr: "معمول فستق كيلو", categorySlug: "maamoul", priceMinor: 320000, weightGrams: 1000, descriptionAr: "معمول بالفستق الحلبي." },
    { sku: "P-MAA-WAL", slug: "maamoul-walnut-1kg", nameAr: "معمول جوز كيلو", categorySlug: "maamoul", priceMinor: 240000, weightGrams: 1000, descriptionAr: "معمول بالجوز المفروم." },
    { sku: "P-KUN-CHE", slug: "kunafa-cheese-tray", nameAr: "كنافة جبنة - صينية", categorySlug: "kunafa", priceMinor: 280000, weightGrams: 1500, isFeatured: true, descriptionAr: "كنافة نابلسية بجبنة العكاوي تكفي ٦ أشخاص." },
    { sku: "P-KUN-CRM", slug: "kunafa-cream-tray", nameAr: "كنافة قشطة - صينية", categorySlug: "kunafa", priceMinor: 320000, weightGrams: 1500, descriptionAr: "كنافة بالقشطة البلدية والقطر." },
    { sku: "P-HAL-CRM", slug: "halawat-jebn-roll", nameAr: "حلاوة الجبن بالقشطة", categorySlug: "halawat-el-jebn", priceMinor: 220000, weightGrams: 700, isFeatured: true, descriptionAr: "حلاوة الجبن الشامية بالقشطة والفستق." },
    { sku: "P-GHR-MIX", slug: "ghraybeh-500g", nameAr: "غريبة بالسمن نصف كيلو", categorySlug: "ghraybeh", priceMinor: 95000, weightGrams: 500, descriptionAr: "غريبة سادة بالسمن العربي." },
    { sku: "P-MAB-PIST", slug: "mabrouma-pistachio-1kg", nameAr: "مبرومة فستق كيلو", categorySlug: "mabrouma", priceMinor: 420000, weightGrams: 1000, isFeatured: true, descriptionAr: "مبرومة محشوة بالفستق الحلبي بالكامل." },
    { sku: "P-HAR-CRM", slug: "harissa-cream-tray", nameAr: "هريسة بالقشطة - صينية", categorySlug: "harissa", priceMinor: 180000, weightGrams: 1200, descriptionAr: "هريسة سميد بالقشطة والقطر." },
    { sku: "P-MUH-CUP", slug: "muhalabieh-cup", nameAr: "مهلبية بالفستق - كأس", categorySlug: "muhalabieh", priceMinor: 25000, weightGrams: 200, descriptionAr: "مهلبية حليب بماء الزهر والفستق." },
    { sku: "P-LIA-CUP", slug: "layali-lebnan-cup", nameAr: "ليالي لبنان - كأس", categorySlug: "muhalabieh", priceMinor: 28000, weightGrams: 220, descriptionAr: "ليالي لبنان بالقشطة والمكسرات." },
  ];
  const rows = await db
    .insert(products)
    .values(
      data.map((d, i) => ({
        sku: d.sku,
        slug: d.slug,
        nameAr: d.nameAr,
        descriptionAr: d.descriptionAr,
        categoryId: byslug(d.categorySlug).id,
        priceMinor: d.priceMinor,
        currency: CURRENCY_CODE,
        unit: "piece",
        weightGrams: d.weightGrams,
        imageUrl: null,
        galleryUrls: [],
        isActive: true,
        isFeatured: d.isFeatured ?? false,
        reorderThreshold: 5000,
        sortOrder: i,
      })),
    )
    .returning();
  const map: Record<string, (typeof rows)[number]> = {};
  rows.forEach((p) => (map[p.sku] = p));
  return map;
}

async function seedRecipes(
  prods: Record<string, { id: string }>,
  mats: Record<string, { id: string; unitCostMinor: number }>,
) {
  log("recipes...");
  type RecipeDef = {
    productSku: string;
    yieldQuantity: number;
    items: { matSku: string; qty: number; unit?: string }[];
    notesAr: string;
  };
  const defs: RecipeDef[] = [
    {
      productSku: "P-BAK-MIX",
      yieldQuantity: 10,
      items: [
        { matSku: "RM-PHYLLO", qty: 4500 },
        { matSku: "RM-PISTACHIO", qty: 2200 },
        { matSku: "RM-BUTTER", qty: 1800 },
        { matSku: "RM-SUGAR", qty: 2500 },
        { matSku: "RM-ROSEWATER", qty: 200 },
      ],
      notesAr: "وصفة البقلاوة المشكلة - دفعة ١٠ كيلو",
    },
    {
      productSku: "P-BAK-PIST",
      yieldQuantity: 10,
      items: [
        { matSku: "RM-PHYLLO", qty: 4500 },
        { matSku: "RM-PISTACHIO", qty: 3500 },
        { matSku: "RM-BUTTER", qty: 1800 },
        { matSku: "RM-SUGAR", qty: 2500 },
        { matSku: "RM-ROSEWATER", qty: 200 },
      ],
      notesAr: "بقلاوة فستق - حشوة كاملة",
    },
    {
      productSku: "P-BAK-CRM",
      yieldQuantity: 20,
      items: [
        { matSku: "RM-PHYLLO", qty: 5000 },
        { matSku: "RM-CREAM", qty: 4000 },
        { matSku: "RM-PISTACHIO", qty: 800 },
        { matSku: "RM-BUTTER", qty: 1500 },
        { matSku: "RM-SUGAR", qty: 2200 },
      ],
      notesAr: "بقلاوة قشطة - دفعة ١٠ كيلو يعطي ٢٠ علبة",
    },
    {
      productSku: "P-MAA-DATE",
      yieldQuantity: 12,
      items: [
        { matSku: "RM-SEMOLINA", qty: 5000 },
        { matSku: "RM-DATES", qty: 4000 },
        { matSku: "RM-GHEE", qty: 1800 },
        { matSku: "RM-MAHLEB", qty: 50 },
        { matSku: "RM-BLOSSOM", qty: 150 },
      ],
      notesAr: "معمول تمر",
    },
    {
      productSku: "P-MAA-PIST",
      yieldQuantity: 10,
      items: [
        { matSku: "RM-SEMOLINA", qty: 4500 },
        { matSku: "RM-PISTACHIO", qty: 3000 },
        { matSku: "RM-GHEE", qty: 1800 },
        { matSku: "RM-SUGAR", qty: 1500 },
        { matSku: "RM-BLOSSOM", qty: 150 },
      ],
      notesAr: "معمول فستق",
    },
    {
      productSku: "P-MAA-WAL",
      yieldQuantity: 12,
      items: [
        { matSku: "RM-SEMOLINA", qty: 5000 },
        { matSku: "RM-WALNUT", qty: 3500 },
        { matSku: "RM-GHEE", qty: 1800 },
        { matSku: "RM-SUGAR", qty: 1500 },
        { matSku: "RM-BLOSSOM", qty: 150 },
      ],
      notesAr: "معمول جوز",
    },
    {
      productSku: "P-KUN-CHE",
      yieldQuantity: 5,
      items: [
        { matSku: "RM-KATAIFI", qty: 3000 },
        { matSku: "RM-CHEESE", qty: 3500 },
        { matSku: "RM-BUTTER", qty: 1500 },
        { matSku: "RM-SUGAR", qty: 2000 },
        { matSku: "RM-PISTACHIO", qty: 300 },
      ],
      notesAr: "كنافة جبنة - دفعة ٥ صواني",
    },
    {
      productSku: "P-KUN-CRM",
      yieldQuantity: 5,
      items: [
        { matSku: "RM-KATAIFI", qty: 3000 },
        { matSku: "RM-CREAM", qty: 3500 },
        { matSku: "RM-BUTTER", qty: 1500 },
        { matSku: "RM-SUGAR", qty: 2000 },
        { matSku: "RM-PISTACHIO", qty: 300 },
      ],
      notesAr: "كنافة قشطة",
    },
    {
      productSku: "P-HAL-CRM",
      yieldQuantity: 8,
      items: [
        { matSku: "RM-CHEESE", qty: 4000 },
        { matSku: "RM-CREAM", qty: 2500 },
        { matSku: "RM-SUGAR", qty: 1500 },
        { matSku: "RM-PISTACHIO", qty: 400 },
        { matSku: "RM-BLOSSOM", qty: 100 },
      ],
      notesAr: "حلاوة جبن قشطة",
    },
    {
      productSku: "P-GHR-MIX",
      yieldQuantity: 20,
      items: [
        { matSku: "RM-FLOUR", qty: 4000 },
        { matSku: "RM-GHEE", qty: 2500 },
        { matSku: "RM-SUGAR", qty: 2000 },
      ],
      notesAr: "غريبة سادة",
    },
    {
      productSku: "P-MAB-PIST",
      yieldQuantity: 10,
      items: [
        { matSku: "RM-PHYLLO", qty: 4000 },
        { matSku: "RM-PISTACHIO", qty: 4500 },
        { matSku: "RM-BUTTER", qty: 1800 },
        { matSku: "RM-SUGAR", qty: 2500 },
      ],
      notesAr: "مبرومة فستق - حشوة فاخرة",
    },
    {
      productSku: "P-HAR-CRM",
      yieldQuantity: 8,
      items: [
        { matSku: "RM-SEMOLINA", qty: 4000 },
        { matSku: "RM-CREAM", qty: 2000 },
        { matSku: "RM-SUGAR", qty: 2000 },
        { matSku: "RM-MILK", qty: 1500 },
      ],
      notesAr: "هريسة قشطة",
    },
    {
      productSku: "P-MUH-CUP",
      yieldQuantity: 50,
      items: [
        { matSku: "RM-MILK", qty: 8000 },
        { matSku: "RM-SUGAR", qty: 1500 },
        { matSku: "RM-BLOSSOM", qty: 100 },
        { matSku: "RM-PISTACHIO", qty: 250 },
      ],
      notesAr: "مهلبية ٥٠ كأس",
    },
    {
      productSku: "P-LIA-CUP",
      yieldQuantity: 50,
      items: [
        { matSku: "RM-MILK", qty: 8000 },
        { matSku: "RM-SEMOLINA", qty: 800 },
        { matSku: "RM-CREAM", qty: 1500 },
        { matSku: "RM-SUGAR", qty: 1500 },
        { matSku: "RM-PISTACHIO", qty: 200 },
      ],
      notesAr: "ليالي لبنان ٥٠ كأس",
    },
  ];

  for (const def of defs) {
    const product = prods[def.productSku]!;
    const recipeRow = (
      await db
        .insert(recipes)
        .values({
          productId: product.id,
          yieldQuantity: def.yieldQuantity,
          notesAr: def.notesAr,
          isActive: true,
        })
        .returning()
    )[0]!;
    let total = 0;
    for (const it of def.items) {
      const mat = mats[it.matSku]!;
      total += Math.round((it.qty * mat.unitCostMinor) / 1000);
      await db.insert(recipeItems).values({
        recipeId: recipeRow.id,
        materialId: mat.id,
        quantity: it.qty,
        unit: "g",
      });
    }
    const unitCost = Math.round(total / def.yieldQuantity);
    await db
      .update(recipes)
      .set({ unitCostMinor: unitCost })
      .where(eq(recipes.id, recipeRow.id));
  }
}

async function seedEmployees() {
  log("employees...");
  const data = [
    { num: "EMP-0001", nameAr: "أبو سامر الدمشقي", positionAr: "رئيس المعمل", department: "production", salary: 4500000, hire: "2018-03-15" },
    { num: "EMP-0002", nameAr: "محمد العبد الله", positionAr: "معلم بقلاوة", department: "production", salary: 3200000, hire: "2019-07-20" },
    { num: "EMP-0003", nameAr: "أحمد الخوري", positionAr: "معلم معمول", department: "production", salary: 2800000, hire: "2020-02-10" },
    { num: "EMP-0004", nameAr: "خالد رمضان", positionAr: "معلم كنافة", department: "production", salary: 2900000, hire: "2020-09-05" },
    { num: "EMP-0005", nameAr: "ياسر الحلبي", positionAr: "مساعد إنتاج", department: "production", salary: 1800000, hire: "2022-01-12" },
    { num: "EMP-0006", nameAr: "سامر السعدي", positionAr: "مدير المعرض", department: "store", salary: 3500000, hire: "2017-06-01" },
    { num: "EMP-0007", nameAr: "ليلى مرعي", positionAr: "كاشير", department: "store", salary: 2200000, hire: "2021-04-18" },
    { num: "EMP-0008", nameAr: "نور الحاج", positionAr: "كاشير", department: "store", salary: 2200000, hire: "2022-08-11" },
    { num: "EMP-0009", nameAr: "عمر السمان", positionAr: "بائع وتغليف", department: "store", salary: 1700000, hire: "2023-03-20" },
    { num: "EMP-0010", nameAr: "فادي الزين", positionAr: "سائق توصيل", department: "delivery", salary: 1800000, hire: "2022-11-02" },
    { num: "EMP-0011", nameAr: "ليليان أبو طوق", positionAr: "محاسبة", department: "admin", salary: 2800000, hire: "2019-01-15" },
  ];
  await db.insert(employees).values(
    data.map((d) => ({
      employeeNumber: d.num,
      nameAr: d.nameAr,
      positionAr: d.positionAr,
      department: d.department as "production" | "store" | "delivery" | "admin",
      hireDate: d.hire,
      monthlySalaryMinor: d.salary,
      isActive: true,
    })),
  );
}

async function seedContent() {
  log("content blocks...");
  const blocks = [
    {
      key: "home_hero",
      page: "home",
      titleAr: "حلويات شامية أصيلة منذ ١٩٧٢",
      bodyAr: "أكثر من نصف قرن من التراث الدمشقي. مكونات منتقاة، صناعة يومية بأيدي المعلمين، ومذاق لا يُنسى.",
      imageUrl: null,
      metadata: { ctaLabel: "تسوق الآن", ctaHref: "/shop", ctaSecondary: "قصتنا", ctaSecondaryHref: "/about" },
    },
    {
      key: "home_story_excerpt",
      page: "home",
      titleAr: "تراث ثلاثة أجيال",
      bodyAr: "في قلب دمشق القديمة، بدأت الحكاية بفرن صغير في حي الميدان. اليوم، يواصل أبناء الجيل الثالث صناعة الحلويات بنفس الوصفات الأصلية ونفس الشغف.",
      metadata: { ctaLabel: "اقرأ القصة كاملة", ctaHref: "/about" },
    },
    {
      key: "home_quality_strip",
      page: "home",
      titleAr: "ضمان الجودة",
      bodyAr: "صناعة يومية • مكونات طبيعية ١٠٠٪ • بدون مواد حافظة • فستق حلبي أصلي • سمن بلدي",
      metadata: {},
    },
    {
      key: "home_categories_section",
      page: "home",
      titleAr: "تشكيلتنا الفاخرة",
      bodyAr: null,
      metadata: {},
    },
    {
      key: "home_featured_section",
      page: "home",
      titleAr: "الأكثر طلباً",
      bodyAr: null,
      metadata: { ctaLabel: "عرض الكل", ctaHref: "/shop" },
    },
    {
      key: "story_hero",
      page: "story",
      titleAr: "قصة الدمشقي",
      bodyAr: "إرث دمشقي يتوارث منذ أكثر من نصف قرن.",
      imageUrl: null,
      metadata: {
        videoUrl: "",
        posterUrl: "",
      },
    },
    {
      key: "story_main",
      page: "story",
      titleAr: "قصتنا",
      bodyAr: "في عام ١٩٧٢، فتح الحاج عبد القادر الدمشقي أبواب أول محل للحلويات في حي الميدان بدمشق. كانت رؤيته بسيطة: تقديم حلويات شامية أصيلة بأعلى جودة وأنقى المكونات.\n\nمع مرور السنوات، توسع المحل وانتقل إلى مكانه الحالي في شارع المتنبي. اليوم، يدير المحل أبناء وأحفاد الحاج عبد القادر، مع الحفاظ على نفس الوصفات الأصلية ونفس مستوى الجودة الذي اشتهر به الدمشقي منذ نصف قرن.\n\nنحن لا نصنع الحلويات فقط، بل نحفظ تراثاً عمره مئات السنين. كل قطعة بقلاوة، كل حبة معمول، وكل صينية كنافة تحمل بصمة الدمشقي وتروي قصة من قصص دمشق القديمة.",
      metadata: {},
    },
    {
      key: "contact_hero",
      page: "contact",
      titleAr: "تواصل معنا",
      bodyAr: "نسعد دائماً بخدمتكم. زورونا في معرضنا أو اتصلوا بنا لطلباتكم الخاصة والمناسبات.",
      metadata: {
        hoursAr: "السبت — الخميس: ٩ صباحًا — ١١ مساءً\nالجمعة: ٢ ظهرًا — ١١ مساءً",
      },
    },
    {
      key: "contact_visit",
      page: "contact",
      titleAr: "زورونا في المتجر",
      bodyAr: "يسعدنا استقبالكم في فروعنا للاستمتاع بتجربة طازجة من حلويات الدمشقي، المُحضّرة يوميًا بأيدي حرفيين مهرة وفق وصفات عائلية متوارثة.",
      metadata: {
        mapEmbedUrl: "",
        mapImageUrl: "",
      },
    },
  ];
  await db.insert(contentBlocks).values(blocks);
}

async function seedOpeningStock(
  locs: { raw: { id: string }; fin: { id: string }; store: { id: string } },
  mats: Record<string, { id: string; unitCostMinor: number; sku: string }>,
  prods: Record<string, { id: string; priceMinor: number; sku: string }>,
) {
  log("opening stock...");
  // Raw materials at PROD-RAW
  for (const m of Object.values(mats)) {
    const qty = 50000; // ~50 kg in thousandths
    await db.insert(stockLevels).values({
      locationId: locs.raw.id,
      itemType: "raw_material",
      materialId: m.id,
      quantity: qty,
      avgCostMinor: m.unitCostMinor,
    });
    await db.insert(inventoryLedger).values({
      locationId: locs.raw.id,
      itemType: "raw_material",
      materialId: m.id,
      quantityDelta: qty,
      unitCostMinor: m.unitCostMinor,
      reason: "opening",
      notesAr: "رصيد افتتاحي",
    });
  }
  // Finished products at PROD-FIN and STORE
  for (const p of Object.values(prods)) {
    const finQty = 30000;
    const storeQty = 20000;
    const cost = Math.round(p.priceMinor * 0.4); // assumed cost ~40%
    await db.insert(stockLevels).values({
      locationId: locs.fin.id,
      itemType: "product",
      productId: p.id,
      quantity: finQty,
      avgCostMinor: cost,
    });
    await db.insert(inventoryLedger).values({
      locationId: locs.fin.id,
      itemType: "product",
      productId: p.id,
      quantityDelta: finQty,
      unitCostMinor: cost,
      reason: "opening",
      notesAr: "رصيد افتتاحي",
    });
    await db.insert(stockLevels).values({
      locationId: locs.store.id,
      itemType: "product",
      productId: p.id,
      quantity: storeQty,
      avgCostMinor: cost,
    });
    await db.insert(inventoryLedger).values({
      locationId: locs.store.id,
      itemType: "product",
      productId: p.id,
      quantityDelta: storeQty,
      unitCostMinor: cost,
      reason: "opening",
      notesAr: "رصيد افتتاحي",
    });
  }
}

async function seedSampleSales(
  prods: Record<string, { id: string; nameAr: string; priceMinor: number; sku: string }>,
) {
  log("sample sales orders...");
  const productList = Object.values(prods);
  const now = new Date();
  let orderCounter = 1;
  let posSeq = 0;
  let onlineSeq = 0;

  for (let dayOffset = 14; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    // 5-12 POS orders/day, 1-4 online orders/day
    const posCount = 5 + Math.floor(Math.random() * 8);
    const onlineCount = 1 + Math.floor(Math.random() * 4);

    for (let i = 0; i < posCount; i++) {
      posSeq++;
      const orderNumber = `POS-${day.getFullYear()}-${String(posSeq).padStart(5, "0")}`;
      const items = pickRandomItems(productList, 1 + Math.floor(Math.random() * 3));
      const subtotal = items.reduce((s, it) => s + it.unitPriceMinor * it.quantity, 0);
      const discount = Math.random() < 0.2 ? Math.round(subtotal * 0.05) : 0;
      const total = subtotal - discount;
      const placedAt = new Date(day);
      placedAt.setHours(9 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      const paymentMethod = Math.random() < 0.7 ? "cash" : "card";
      const order = (
        await db
          .insert(salesOrders)
          .values({
            orderNumber,
            channel: "pos",
            status: "completed",
            paymentMethod: paymentMethod as "cash" | "card",
            subtotalMinor: subtotal,
            discountMinor: discount,
            totalMinor: total,
            costMinor: Math.round(total * 0.45),
            placedAt,
            completedAt: placedAt,
          })
          .returning()
      )[0]!;
      for (const it of items) {
        await db.insert(salesOrderItems).values({
          orderId: order.id,
          productId: it.productId,
          productNameAr: it.productNameAr,
          quantity: it.quantity,
          unitPriceMinor: it.unitPriceMinor,
          unitCostMinor: Math.round(it.unitPriceMinor * 0.4),
          totalMinor: it.unitPriceMinor * it.quantity,
        });
      }
      await db.insert(financialEntries).values({
        module: "store",
        type: "income",
        category: "مبيعات نقطة البيع",
        descriptionAr: `طلب ${orderNumber}`,
        amountMinor: total,
        occurredAt: placedAt,
        referenceType: "sales_order",
        referenceId: order.id,
      });
      orderCounter++;
    }

    for (let i = 0; i < onlineCount; i++) {
      onlineSeq++;
      const orderNumber = `ONL-${day.getFullYear()}-${String(onlineSeq).padStart(5, "0")}`;
      const items = pickRandomItems(productList, 1 + Math.floor(Math.random() * 4));
      const subtotal = items.reduce((s, it) => s + it.unitPriceMinor * it.quantity, 0);
      const delivery = subtotal >= 200000 ? 0 : 15000;
      const total = subtotal + delivery;
      const placedAt = new Date(day);
      placedAt.setHours(10 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      const status =
        dayOffset > 1
          ? "completed"
          : Math.random() < 0.5
            ? "preparing"
            : "out_for_delivery";
      const customers = ["رنا الحاج", "كرم العلي", "سلمى المصري", "زياد العبدالله", "هدى نصار", "محمد الشامي"];
      const order = (
        await db
          .insert(salesOrders)
          .values({
            orderNumber,
            channel: "online",
            status: status as typeof salesOrders.$inferSelect.status,
            paymentMethod: "cod",
            customerName: customers[Math.floor(Math.random() * customers.length)]!,
            customerPhone: `+9705${Math.floor(10000000 + Math.random() * 89999999)}`,
            deliveryAddress: "رام الله، شارع الإرسال، عمارة الزيتونة",
            subtotalMinor: subtotal,
            deliveryFeeMinor: delivery,
            totalMinor: total,
            costMinor: Math.round(total * 0.45),
            placedAt,
            completedAt: status === "completed" ? placedAt : null,
          })
          .returning()
      )[0]!;
      for (const it of items) {
        await db.insert(salesOrderItems).values({
          orderId: order.id,
          productId: it.productId,
          productNameAr: it.productNameAr,
          quantity: it.quantity,
          unitPriceMinor: it.unitPriceMinor,
          unitCostMinor: Math.round(it.unitPriceMinor * 0.4),
          totalMinor: it.unitPriceMinor * it.quantity,
        });
      }
      if (status === "completed") {
        await db.insert(financialEntries).values({
          module: "store",
          type: "income",
          category: "مبيعات الموقع",
          descriptionAr: `طلب ${orderNumber}`,
          amountMinor: total,
          occurredAt: placedAt,
          referenceType: "sales_order",
          referenceId: order.id,
        });
      }
      orderCounter++;
    }
  }
  log(`  inserted ~${orderCounter} sample orders`);
}

function pickRandomItems(
  productList: { id: string; nameAr: string; priceMinor: number; sku: string }[],
  count: number,
) {
  const shuffled = [...productList].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((p) => ({
    productId: p.id,
    productNameAr: p.nameAr,
    quantity: 1 + Math.floor(Math.random() * 2),
    unitPriceMinor: p.priceMinor,
  }));
}

async function seedExpenses() {
  log("financial expenses (rent, utilities)...");
  const months = 3;
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 5);
    await db.insert(financialEntries).values([
      {
        module: "store",
        type: "expense",
        category: "إيجار",
        descriptionAr: `إيجار المعرض - ${d.toISOString().slice(0, 7)}`,
        amountMinor: 2500000,
        occurredAt: d,
      },
      {
        module: "production",
        type: "expense",
        category: "إيجار",
        descriptionAr: `إيجار المعمل - ${d.toISOString().slice(0, 7)}`,
        amountMinor: 4000000,
        occurredAt: d,
      },
      {
        module: "production",
        type: "expense",
        category: "كهرباء وغاز",
        descriptionAr: `فواتير الطاقة - ${d.toISOString().slice(0, 7)}`,
        amountMinor: 850000,
        occurredAt: d,
      },
      {
        module: "store",
        type: "expense",
        category: "كهرباء وماء",
        descriptionAr: `فواتير المعرض - ${d.toISOString().slice(0, 7)}`,
        amountMinor: 350000,
        occurredAt: d,
      },
    ]);
  }
}

async function seedActivity() {
  log("activity log...");
  await db.insert(activityLog).values([
    {
      kind: "production_completed",
      titleAr: "إنتاج بقلاوة فستق",
      descriptionAr: "أنتج المعمل ٤٠ كيلو من البقلاوة بالفستق",
      actorNameAr: "محمد العبد الله",
    },
    {
      kind: "transfer_done",
      titleAr: "تحويل إلى المعرض",
      descriptionAr: "تحويل ٢٠ كيلو معمول من المعمل إلى المعرض",
      actorNameAr: "أبو سامر الدمشقي",
    },
    {
      kind: "low_stock",
      titleAr: "تنبيه: مخزون منخفض",
      descriptionAr: "فستق حلبي خام أقل من حد إعادة الطلب",
    },
  ]);
}

async function main() {
  await clearAll();
  await seedSettings();
  const locs = await seedLocations();
  const cats = await seedCategories();
  const mats = await seedRawMaterials();
  const prods = await seedProducts(cats);
  await seedRecipes(prods, mats);
  await seedEmployees();
  await seedContent();
  await seedOpeningStock(locs, mats, prods);
  await seedSampleSales(prods);
  await seedExpenses();
  await seedActivity();
  log("done!");
  log("------------------------------------------------------------");
  log("Bootstrap: this app uses Clerk for authentication.");
  log("The FIRST user to sign up via /sign-in becomes the Super Admin");
  log("(role: owner) automatically — full access to /admin.");
  log("Subsequent sign-ups default to the customer role; promote them");
  log("from /admin/users.");
  log("------------------------------------------------------------");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
