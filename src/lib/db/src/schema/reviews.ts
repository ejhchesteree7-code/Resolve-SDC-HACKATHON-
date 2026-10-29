import { sql } from "drizzle-orm";
import { pgTable, pgSequence, text, integer, real, boolean, timestamp, bigint } from "drizzle-orm/pg-core";

export const tenantsTable = pgTable("tenants", {
  id: text("id").primaryKey(),
  managerVoucherLimitRm: real("manager_voucher_limit_rm").notNull().default(20),
  name: text("name"),
});

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  outletId: text("outlet_id").notNull(),
  // Login fields. Accounts without an email or password hash cannot log in.
  name: text("name"),
  email: text("email"),
  passwordHash: text("password_hash"),
});

export const reviewsTable = pgTable("resolve_reviews", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("resolve-demo"),
  outletId: text("outlet_id").notNull().default("Brew & Kin — Bangsar"),
  reviewer: text("reviewer").notNull(),
  outlet: text("outlet").notNull(),
  rating: integer("rating").notNull(),
  language: text("language").notNull(),
  text: text("text").notNull(),
  sentiment: text("sentiment").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  reason: text("reason").notNull(),
  confidence: real("confidence").notNull(),
  draftReply: text("draft_reply").notNull(),
  status: text("status").notNull(),
  assignedRole: text("assigned_role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  missingInfo: boolean("missing_info").notNull().default(false),
  usedFallback: boolean("used_fallback").notNull().default(false),
  voucherAmount: real("voucher_amount"),
  rejectionReason: text("rejection_reason"),
  ruleFired: text("rule_fired"),
  source: text("source").notNull().default("simulated"),
  finalReply: text("final_reply"),
});

// Keep the existing production table name so Publish preserves its audit history.
// An explicit sequence/default lets the publish diff safely backfill existing rows.
export const activitySequence = pgSequence("resolve_activity_sequence_seq");
export const activityTable = pgTable("resolve_activity", {
  id: text("id").primaryKey(),
  sequence: bigint("sequence", { mode: "number" }).notNull()
    .default(sql`nextval('resolve_activity_sequence_seq'::regclass)`),
  reviewId: text("review_id").notNull(),
  actor: text("actor").notNull(),
  role: text("role").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export type ReviewRecord = typeof reviewsTable.$inferSelect;
