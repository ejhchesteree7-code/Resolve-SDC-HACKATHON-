import { and, asc, eq } from "drizzle-orm";
import { db, reviewsTable } from "@workspace/db";
import { auditWriter, type Store } from "../lib/resolve-cases";
import { getCategoryLabel, routeNewReview, type ReviewClassification } from "../lib/resolve-ai";

const bangsar = "Brew & Kin — Bangsar";
const montKiara = "Brew & Kin — Mont Kiara";
type DemoReview = Pick<ReviewClassification, "language" | "category" | "severity"> & {
  reviewer: string; rating: number; text: string;
};

const montKiaraReviews: DemoReview[] = [
  { reviewer: "Alya Noor", rating: 5, text: "The iced latte was excellent and our table was ready right away.", language: "English", category: "praise", severity: "low" },
  { reviewer: "Ben Chong", rating: 4, text: "Good eggs on toast and a relaxed place to catch up with friends.", language: "English", category: "food_quality", severity: "low" },
  { reviewer: "Citra Aziz", rating: 2, text: "Tunggu setengah jam untuk dua minuman. Harap servis boleh lebih cepat.", language: "Malay", category: "service_speed", severity: "medium" },
  { reviewer: "Dev Menon", rating: 3, text: "Coffee was decent, but the music was a little loud for a conversation.", language: "English", category: "atmosphere", severity: "low" },
  { reviewer: "Elisa Wong", rating: 5, text: "Staff explained the coffee options patiently. Loved the oat flat white.", language: "English", category: "praise", severity: "low" },
  { reviewer: "Faiz Jamal", rating: 4, text: "Kek pandan lembut dan kopi sedap. Tempat pun bersih.", language: "Malay", category: "food_quality", severity: "low" },
  { reviewer: "Grace Teo", rating: 2, text: "Ordered an iced latte but received a hot mocha, then had to wait for a replacement.", language: "English", category: "order_accuracy", severity: "medium" },
  { reviewer: "Haziq Roslan", rating: 5, text: "Nice spot lah, kopi kaw and staff very welcoming.", language: "Manglish", category: "praise", severity: "low" },
  { reviewer: "Irene Low", rating: 3, text: "Portions were fine, although the brunch set felt a little expensive.", language: "English", category: "value", severity: "low" },
  { reviewer: "Johan Idris", rating: 1, text: "There was a piece of packaging inside my sandwich. Please check the kitchen preparation.", language: "English", category: "food_safety", severity: "high" },
  { reviewer: "Kelly Yap", rating: 4, text: "Matcha not too sweet, just nice. Would come back for the cake.", language: "Manglish", category: "food_quality", severity: "low" },
  { reviewer: "Luqman Arif", rating: 2, text: "Staff jawab dengan kasar bila saya tanya tentang pesanan yang lambat.", language: "Malay", category: "staff_attitude", severity: "medium" },
  { reviewer: "Maya Suresh", rating: 5, text: "A lovely quiet breakfast and freshly brewed coffee. Thank you for the warm welcome.", language: "English", category: "praise", severity: "low" },
  { reviewer: "Nicholas Ho", rating: 2, text: "My pasta arrived cold and the replacement took another twenty minutes.", language: "English", category: "food_quality", severity: "medium" },
  { reviewer: "Orked Hana", rating: 4, text: "Suasana selesa untuk membaca dan pilihan teh pun menarik.", language: "Malay", category: "atmosphere", severity: "low" },
  { reviewer: "Priya Das", rating: 1, text: "A staff member kept making personal comments after I asked them to stop. I felt harassed.", language: "English", category: "harassment", severity: "high" },
  { reviewer: "Qistina Omar", rating: 3, text: "Food okay but waited 25 minutes lah. An update from the team would help.", language: "Manglish", category: "service_speed", severity: "medium" },
  { reviewer: "Ryan Foo", rating: 5, text: "The barista remembered our order and the croissants were fresh.", language: "English", category: "praise", severity: "low" },
  { reviewer: "Suraya Latif", rating: 2, text: "Harga pada bil tidak sama dengan menu. Kami terpaksa minta semakan dua kali.", language: "Malay", category: "value", severity: "medium" },
  { reviewer: "Tessa Ong", rating: 5, text: "Great weekend brunch with friendly service. The mushroom toast was a favourite.", language: "English", category: "praise", severity: "low" },
];

// Demo data maintenance only, not schema migration. All writes are transactional,
// tenant-scoped and idempotent; original review content and audit rows are retained.
export async function ensureOutletDemoReviews(store: Store = db, tenantId = "resolve-demo") {
  return store.transaction(async tx => {
    // Older published rows inherited Bangsar's column default even when their
    // existing outlet name was Mont Kiara. Repair only those simulated rows.
    const misplaced = await tx.select({ id: reviewsTable.id }).from(reviewsTable).where(and(
      eq(reviewsTable.tenantId, tenantId), eq(reviewsTable.source, "simulated"),
      eq(reviewsTable.outlet, montKiara), eq(reviewsTable.outletId, bangsar),
    )).orderBy(asc(reviewsTable.id)).for("update");
    for (const review of misplaced) {
      await tx.update(reviewsTable).set({ outletId: montKiara }).where(eq(reviewsTable.id, review.id));
      await auditWriter(tx, review.id, "Resolve", "System")(
        "outlet_corrected", "Corrected legacy demo outlet identifier to Brew & Kin — Mont Kiara; review content retained.",
      );
    }

    const now = Date.now();
    const records = montKiaraReviews.map((sample, index) => {
      const classification: ReviewClassification = {
        ...sample, sentiment: sample.rating <= 2 ? "negative" : sample.rating === 3 ? "neutral" : "positive",
        confidence: 0.96, suggestedVoucherRm: 0, usedFallback: false,
        reason: "Pre-classified synthetic demo review; no live AI call.",
        draftReply: sample.rating >= 4
          ? "Thank you for visiting our Mont Kiara café. We are glad you enjoyed your visit and hope to welcome you again."
          : sample.severity === "high"
            ? "We are very sorry and take your feedback seriously. Our owner will review this urgently. Please contact us directly so we can follow up."
            : "Thank you for your feedback. We are sorry your visit did not fully meet expectations. Our team will review what happened and work to improve.",
      };
      const routing = routeNewReview(classification);
      return {
        id: `${tenantId}-mont-kiara-demo-${String(index + 1).padStart(3, "0")}`,
        tenantId, outletId: montKiara, outlet: montKiara, source: "simulated",
        reviewer: sample.reviewer, rating: sample.rating, text: sample.text,
        language: sample.language, sentiment: classification.sentiment,
        category: getCategoryLabel(sample.category), severity: sample.severity,
        reason: classification.reason, confidence: classification.confidence,
        draftReply: classification.draftReply, usedFallback: false,
        status: routing.status === "Needs owner" ? "pending_owner" : routing.status,
        assignedRole: routing.assignedRole, ruleFired: routing.ruleFired,
        createdAt: new Date(now - index * 6 * 60 * 60 * 1000),
      };
    });
    const inserted = await tx.insert(reviewsTable).values(records).onConflictDoNothing().returning({
      id: reviewsTable.id, reviewer: reviewsTable.reviewer, ruleFired: reviewsTable.ruleFired,
    });
    for (const review of inserted) {
      const log = auditWriter(tx, review.id, "Resolve", "System");
      await log("review_received", `Synthetic Mont Kiara demo review received from ${review.reviewer}`);
      await log("demo_classified", "Pre-classified synthetic demo review; no live AI call.");
      await log("routed", review.ruleFired!);
    }
    return { corrected: misplaced.length, inserted: inserted.length };
  });
}
