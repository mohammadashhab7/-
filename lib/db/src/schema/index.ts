import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  uuid,
  varchar,
  date,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "manager",
  "production_lead",
  "store_clerk",
  "cashier",
  "accountant",
  "customer",
]);

export const inventoryLocationKindEnum = pgEnum("inventory_location_kind", [
  "production_raw",
  "production_finished",
  "store",
  "warehouse",
]);

export const ledgerItemTypeEnum = pgEnum("ledger_item_type", [
  "raw_material",
  "product",
]);

export const ledgerReasonEnum = pgEnum("ledger_reason", [
  "purchase",
  "production_consume",
  "production_output",
  "transfer_out",
  "transfer_in",
  "sale",
  "adjustment",
  "waste",
  "return",
  "opening",
]);

export const productionOrderStatusEnum = pgEnum("production_order_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
]);

export const channelEnum = pgEnum("sales_channel", ["pos", "online"]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "cod",
  "bank_transfer",
  "stripe",
  "paypal",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "succeeded",
  "failed",
  "refunded",
  "cancelled",
  "not_required",
]);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "cash",
  "cod",
  "stripe",
  "paypal",
  "bank_transfer",
  "card_terminal",
]);

export const financialModuleEnum = pgEnum("financial_module", [
  "production",
  "store",
]);

export const financialTypeEnum = pgEnum("financial_type", ["income", "expense"]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "leave",
  "half_day",
]);

export const mediaKindEnum = pgEnum("media_kind", ["image", "video", "document"]);

export const activityKindEnum = pgEnum("activity_kind", [
  "order_placed",
  "order_status_changed",
  "production_started",
  "production_completed",
  "transfer_done",
  "low_stock",
  "financial_entry",
  "user_action",
]);

const createdAt = timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull();

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").unique(),
    email: text("email"),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    phone: text("phone"),
    role: userRoleEnum("role").notNull().default("customer"),
    permissions: jsonb("permissions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    avatarUrl: text("avatar_url"),
    createdAt,
    updatedAt,
  },
  (t) => [index("users_role_idx").on(t.role)],
);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  descriptionAr: text("description_ar"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    sku: varchar("sku", { length: 64 }).notNull().unique(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    descriptionAr: text("description_ar"),
    descriptionEn: text("description_en"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    priceMinor: bigint("price_minor", { mode: "number" }).notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("SYP"),
    unit: varchar("unit", { length: 16 }).notNull().default("piece"),
    weightGrams: integer("weight_grams"),
    imageUrl: text("image_url"),
    galleryUrls: jsonb("gallery_urls").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    reorderThreshold: integer("reorder_threshold").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_active_idx").on(t.isActive),
  ],
);

export const rawMaterials = pgTable("raw_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: varchar("sku", { length: 64 }).notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  unit: varchar("unit", { length: 16 }).notNull().default("kg"),
  unitCostMinor: bigint("unit_cost_minor", { mode: "number" })
    .notNull()
    .default(0),
  currency: varchar("currency", { length: 8 }).notNull().default("SYP"),
  reorderThreshold: integer("reorder_threshold").notNull().default(0),
  supplierAr: text("supplier_ar"),
  notesAr: text("notes_ar"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
});

export const recipes = pgTable("recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  yieldQuantity: integer("yield_quantity").notNull().default(1),
  unitCostMinor: bigint("unit_cost_minor", { mode: "number" })
    .notNull()
    .default(0),
  notesAr: text("notes_ar"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
});

export const recipeItems = pgTable(
  "recipe_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => rawMaterials.id, { onDelete: "restrict" }),
    quantity: integer("quantity_thousandths").notNull(),
    unit: varchar("unit", { length: 16 }).notNull().default("kg"),
  },
  (t) => [index("recipe_items_recipe_idx").on(t.recipeId)],
);

export const inventoryLocations = pgTable("inventory_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  nameAr: text("name_ar").notNull(),
  kind: inventoryLocationKindEnum("kind").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
});

export const stockLevels = pgTable(
  "stock_levels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    itemType: ledgerItemTypeEnum("item_type").notNull(),
    materialId: uuid("material_id").references(() => rawMaterials.id, {
      onDelete: "cascade",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    quantity: integer("quantity_thousandths").notNull().default(0),
    avgCostMinor: bigint("avg_cost_minor", { mode: "number" })
      .notNull()
      .default(0),
    updatedAt,
  },
  (t) => [
    uniqueIndex("stock_levels_unique_idx").on(
      t.locationId,
      t.itemType,
      t.materialId,
      t.productId,
    ),
    index("stock_levels_loc_idx").on(t.locationId),
  ],
);

export const inventoryLedger = pgTable(
  "inventory_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocations.id),
    itemType: ledgerItemTypeEnum("item_type").notNull(),
    materialId: uuid("material_id").references(() => rawMaterials.id),
    productId: uuid("product_id").references(() => products.id),
    quantityDelta: integer("quantity_delta_thousandths").notNull(),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" })
      .notNull()
      .default(0),
    reason: ledgerReasonEnum("reason").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    notesAr: text("notes_ar"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt,
  },
  (t) => [
    index("ledger_loc_idx").on(t.locationId),
    index("ledger_ref_idx").on(t.referenceType, t.referenceId),
    index("ledger_created_idx").on(t.createdAt),
  ],
);

export const productionOrders = pgTable("production_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: varchar("order_number", { length: 32 }).notNull().unique(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "restrict" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  batchCount: integer("batch_count").notNull().default(1),
  unitsProduced: integer("units_produced").notNull().default(0),
  totalCostMinor: bigint("total_cost_minor", { mode: "number" })
    .notNull()
    .default(0),
  unitCostMinor: bigint("unit_cost_minor", { mode: "number" })
    .notNull()
    .default(0),
  status: productionOrderStatusEnum("status").notNull().default("planned"),
  notesAr: text("notes_ar"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt,
  updatedAt,
});

export const productionOrderItems = pgTable("production_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  productionOrderId: uuid("production_order_id")
    .notNull()
    .references(() => productionOrders.id, { onDelete: "cascade" }),
  materialId: uuid("material_id")
    .notNull()
    .references(() => rawMaterials.id),
  quantityConsumed: integer("quantity_consumed_thousandths").notNull(),
  unitCostMinor: bigint("unit_cost_minor", { mode: "number" })
    .notNull()
    .default(0),
  totalCostMinor: bigint("total_cost_minor", { mode: "number" })
    .notNull()
    .default(0),
});

export const transfers = pgTable("transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  transferNumber: varchar("transfer_number", { length: 32 }).notNull().unique(),
  fromLocationId: uuid("from_location_id")
    .notNull()
    .references(() => inventoryLocations.id),
  toLocationId: uuid("to_location_id")
    .notNull()
    .references(() => inventoryLocations.id),
  notesAr: text("notes_ar"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt,
});

export const transferItems = pgTable("transfer_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  transferId: uuid("transfer_id")
    .notNull()
    .references(() => transfers.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitCostMinor: bigint("unit_cost_minor", { mode: "number" })
    .notNull()
    .default(0),
});

export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("session_token").unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" })
      .notNull()
      .default(0),
    createdAt,
  },
  (t) => [uniqueIndex("cart_items_unique_idx").on(t.cartId, t.productId)],
);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: varchar("order_number", { length: 32 }).notNull().unique(),
    channel: channelEnum("channel").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    customerUserId: uuid("customer_user_id").references(() => users.id),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerEmail: text("customer_email"),
    deliveryAddress: text("delivery_address"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    paymentReference: text("payment_reference"),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" })
      .notNull()
      .default(0),
    discountMinor: bigint("discount_minor", { mode: "number" })
      .notNull()
      .default(0),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
    deliveryFeeMinor: bigint("delivery_fee_minor", { mode: "number" })
      .notNull()
      .default(0),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    costMinor: bigint("cost_minor", { mode: "number" }).notNull().default(0),
    notesAr: text("notes_ar"),
    cashReceivedMinor: bigint("cash_received_minor", { mode: "number" }),
    changeMinor: bigint("change_minor", { mode: "number" }),
    cashierUserId: uuid("cashier_user_id").references(() => users.id),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("sales_orders_channel_idx").on(t.channel),
    index("sales_orders_status_idx").on(t.status),
    index("sales_orders_placed_idx").on(t.placedAt),
    index("sales_orders_customer_idx").on(t.customerUserId),
  ],
);

export const salesOrderItems = pgTable("sales_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => salesOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  productNameAr: text("product_name_ar").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number" })
    .notNull()
    .default(0),
  unitCostMinor: bigint("unit_cost_minor", { mode: "number" })
    .notNull()
    .default(0),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
});

export const dailyClosings = pgTable("daily_closings", {
  id: uuid("id").defaultRandom().primaryKey(),
  closingDate: date("closing_date").notNull().unique(),
  totalSalesMinor: bigint("total_sales_minor", { mode: "number" })
    .notNull()
    .default(0),
  cashSalesMinor: bigint("cash_sales_minor", { mode: "number" })
    .notNull()
    .default(0),
  cardSalesMinor: bigint("card_sales_minor", { mode: "number" })
    .notNull()
    .default(0),
  expectedCashMinor: bigint("expected_cash_minor", { mode: "number" })
    .notNull()
    .default(0),
  countedCashMinor: bigint("counted_cash_minor", { mode: "number" })
    .notNull()
    .default(0),
  varianceMinor: bigint("variance_minor", { mode: "number" })
    .notNull()
    .default(0),
  notesAr: text("notes_ar"),
  closedByUserId: uuid("closed_by_user_id").references(() => users.id),
  closedAt: timestamp("closed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("SYP"),
    providerIntentId: text("provider_intent_id"),
    providerClientSecret: text("provider_client_secret"),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>(),
    failureReasonAr: text("failure_reason_ar"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_status_idx").on(t.status),
  ],
);

export const financialEntries = pgTable(
  "financial_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    module: financialModuleEnum("module").notNull(),
    type: financialTypeEnum("type").notNull(),
    category: text("category").notNull(),
    descriptionAr: text("description_ar").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("SYP"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt,
  },
  (t) => [
    index("fin_module_idx").on(t.module),
    index("fin_type_idx").on(t.type),
    index("fin_occurred_idx").on(t.occurredAt),
  ],
);

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeNumber: varchar("employee_number", { length: 32 }).notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  positionAr: text("position_ar").notNull(),
  department: varchar("department", { length: 32 }).notNull().default("production"),
  phone: text("phone"),
  email: text("email"),
  nationalId: text("national_id"),
  hireDate: date("hire_date").notNull(),
  monthlySalaryMinor: bigint("monthly_salary_minor", { mode: "number" })
    .notNull()
    .default(0),
  isActive: boolean("is_active").notNull().default(true),
  notesAr: text("notes_ar"),
  createdAt,
  updatedAt,
});

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    hoursWorked: integer("hours_worked_tenths").notNull().default(80),
    notesAr: text("notes_ar"),
    createdAt,
  },
  (t) => [
    uniqueIndex("attendance_unique_idx").on(t.employeeId, t.workDate),
  ],
);

export const salaryRecords = pgTable(
  "salary_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    periodMonth: varchar("period_month", { length: 7 }).notNull(),
    baseAmountMinor: bigint("base_amount_minor", { mode: "number" })
      .notNull()
      .default(0),
    bonusMinor: bigint("bonus_minor", { mode: "number" }).notNull().default(0),
    deductionsMinor: bigint("deductions_minor", { mode: "number" })
      .notNull()
      .default(0),
    netAmountMinor: bigint("net_amount_minor", { mode: "number" })
      .notNull()
      .default(0),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notesAr: text("notes_ar"),
    createdAt,
  },
  (t) => [
    uniqueIndex("salary_unique_idx").on(t.employeeId, t.periodMonth),
  ],
);

export const contentBlocks = pgTable("content_blocks", {
  key: varchar("key", { length: 120 }).primaryKey(),
  page: varchar("page", { length: 64 }).notNull(),
  titleAr: text("title_ar"),
  bodyAr: text("body_ar"),
  imageUrl: text("image_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  updatedAt,
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: mediaKindEnum("kind").notNull().default("image"),
  url: text("url").notNull(),
  titleAr: text("title_ar"),
  alt: text("alt"),
  sizeBytes: integer("size_bytes"),
  mimeType: text("mime_type"),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
  createdAt,
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  storeNameAr: text("store_name_ar").notNull().default("الدمشقي"),
  storeNameEn: text("store_name_en"),
  taglineAr: text("tagline_ar"),
  addressAr: text("address_ar"),
  phone: text("phone"),
  email: text("email"),
  currencySymbol: varchar("currency_symbol", { length: 8 }).notNull().default("ل.س"),
  taxPercent: integer("tax_percent_basis").notNull().default(0),
  deliveryFeeMinor: bigint("delivery_fee_minor", { mode: "number" })
    .notNull()
    .default(0),
  freeDeliveryThresholdMinor: bigint("free_delivery_threshold_minor", {
    mode: "number",
  })
    .notNull()
    .default(0),
  socialFacebook: text("social_facebook"),
  socialInstagram: text("social_instagram"),
  socialWhatsapp: text("social_whatsapp"),
  workingHoursAr: text("working_hours_ar"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  updatedAt,
});

export const idCounters = pgTable("id_counters", {
  prefix: varchar("prefix", { length: 64 }).primaryKey(),
  value: integer("value").notNull().default(0),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: activityKindEnum("kind").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionAr: text("description_ar"),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorNameAr: text("actor_name_ar"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt,
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);
