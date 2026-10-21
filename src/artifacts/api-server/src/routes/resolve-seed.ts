import { randomUUID } from "node:crypto";
import { db, reviewsTable, activityTable, tenantsTable, usersTable } from "@workspace/db";
import { ensureOutletDemoReviews } from "./resolve-outlet-demo";

type Role = "Staff" | "Manager" | "Owner";
type Sentiment = "positive" | "neutral" | "negative";
type Severity = "low" | "medium" | "high";
type Status = "New" | "Needs approval" | "Needs owner" | "Resolved" | "Rejected";

type SeedInput = {
  reviewer: string;
  outlet: string;
  rating: number;
  language: string;
  text: string;
  sentiment: Sentiment;
  category: string;
  severity: Severity;
  reason: string;
  confidence: number;
  draftReply: string;
  missingInfo?: boolean;
  fridayIndex?: number;
};

const samples: SeedInput[] = [
  { reviewer: "Aina Rahman", outlet: "Brew & Kin — Bangsar", rating: 2, language: "Manglish", text: "Tunggu 40 minit, staff rude gila.", sentiment: "negative", category: "Slow service", severity: "high", reason: "Long wait and staff conduct complaint.", confidence: 0.98, draftReply: "Hi Aina, we’re truly sorry you waited so long and felt dismissed. This isn’t the welcome we want for you. Our manager is reviewing what happened and we’d appreciate a chance to make it right.", fridayIndex: 0 },
  { reviewer: "Daniel Lim", outlet: "Brew & Kin — Bangsar", rating: 2, language: "English", text: "Waited nearly an hour for two coffees on Friday night. No one updated us.", sentiment: "negative", category: "Slow service", severity: "medium", reason: "Friday evening wait with no progress update.", confidence: 0.97, draftReply: "Hi Daniel, we’re sorry your coffee took so long and that we didn’t keep you updated. We’re reviewing our Friday evening service and hope you’ll give us another chance.", fridayIndex: 0 },
  { reviewer: "Siti Nabila", outlet: "Brew & Kin — Bangsar", rating: 2, language: "Malay", text: "Hari Jumaat memang lambat sangat. Dah order lama baru sampai.", sentiment: "negative", category: "Slow service", severity: "medium", reason: "Reports a long wait on a Friday.", confidence: 0.95, draftReply: "Hai Siti, kami mohon maaf kerana pesanan lambat sampai pada hari Jumaat. Kami sedang menyemak aliran servis waktu sibuk supaya perkara ini tidak berulang.", fridayIndex: 1 },
  { reviewer: "Marcus Tan", outlet: "Brew & Kin — Bangsar", rating: 1, language: "English", text: "Friday dinner service was painfully slow. We had to ask three times where our food was.", sentiment: "negative", category: "Slow service", severity: "medium", reason: "Multiple follow-ups needed during Friday dinner.", confidence: 0.96, draftReply: "Hi Marcus, we’re sorry you had to chase your order and wait so long. We’re looking into our Friday dinner service and will work to make the experience more reliable.", fridayIndex: 1 },
  { reviewer: "Farah Ismail", outlet: "Brew & Kin — Bangsar", rating: 2, language: "Manglish", text: "Friday night crowded okay, but 45 mins for pasta is too much lah.", sentiment: "negative", category: "Slow service", severity: "medium", reason: "Long food wait during Friday night rush.", confidence: 0.93, draftReply: "Hi Farah, sorry about the long wait for your pasta. We know 45 minutes is too long, especially without a clear update. We’re reviewing how we handle the Friday rush.", fridayIndex: 2 },
  { reviewer: "Jason Wong", outlet: "Brew & Kin — Bangsar", rating: 2, language: "English", text: "Another Friday with a 50 minute wait. The food was fine but the service needs attention.", sentiment: "negative", category: "Slow service", severity: "medium", reason: "Repeated Friday service delay.", confidence: 0.96, draftReply: "Hi Jason, we’re sorry about the 50-minute wait. Thank you for letting us know; we’re reviewing staffing and order flow on Friday evenings.", fridayIndex: 2 },
  { reviewer: "Mei Ling", outlet: "Brew & Kin — Bangsar", rating: 5, language: "English", text: "Lovely flat white and such a cosy corner to read in. Will be back.", sentiment: "positive", category: "Coffee", severity: "low", reason: "Positive feedback about coffee and atmosphere.", confidence: 0.99, draftReply: "Hi Mei, thank you for spending part of your day with us. We’re glad you enjoyed the flat white and cosy corner. See you again soon!" },
  { reviewer: "Amir Hakim", outlet: "Brew & Kin — Mont Kiara", rating: 5, language: "Malay", text: "Kopi sedap, staff pun mesra. Memang best lepak sini.", sentiment: "positive", category: "Service", severity: "low", reason: "Praise for coffee and friendly staff.", confidence: 0.98, draftReply: "Hai Amir, terima kasih kerana singgah! Kami gembira Amir suka kopi dan layanan kami. Jumpa lagi!" },
  { reviewer: "Chloe Ng", outlet: "Brew & Kin — Mont Kiara", rating: 4, language: "Manglish", text: "Nice brunch, portion quite generous. Parking a bit susah but overall good.", sentiment: "positive", category: "Food", severity: "low", reason: "Mostly positive brunch feedback with a parking note.", confidence: 0.92, draftReply: "Hi Chloe, thanks for joining us for brunch. We’re glad you enjoyed the food, and appreciate the note about parking. Hope to see you again." },
  { reviewer: "Ravi Kumar", outlet: "Brew & Kin — Bangsar", rating: 1, language: "English", text: "Found a small piece of plastic in my salad. This is a serious food safety issue.", sentiment: "negative", category: "Food safety", severity: "high", reason: "Foreign object reported in food.", confidence: 0.99, draftReply: "Hi Ravi, we’re very sorry and take this seriously. We’ve alerted the café owner to review the food preparation immediately. Please contact us directly so we can understand what happened and follow up with you." },
  { reviewer: "Nurul Aisyah", outlet: "Brew & Kin — Mont Kiara", rating: 1, language: "Malay", text: "Pekerja mengganggu saya dengan komen yang tidak sopan. Saya rasa tidak selamat.", sentiment: "negative", category: "Harassment", severity: "high", reason: "Guest reports inappropriate staff comments and feeling unsafe.", confidence: 0.98, draftReply: "Hai Nurul, kami amat kesal atas pengalaman ini. Keselamatan dan rasa selesa anda penting bagi kami. Pemilik kafe akan menyemak perkara ini dengan segera. Sila hubungi kami secara terus supaya kami boleh membuat susulan dengan penuh perhatian." },
  { reviewer: "Ethan Lee", outlet: "Brew & Kin — Bangsar", rating: 3, language: "English", text: "It was okay, I guess.", sentiment: "neutral", category: "Unclear", severity: "low", reason: "Vague review without details to identify what could improve.", confidence: 0.42, draftReply: "Hi Ethan, thanks for visiting. We’d love to know a little more about your experience and what we could do better next time." , missingInfo: true },
  { reviewer: "Hana Zulkifli", outlet: "Brew & Kin — Mont Kiara", rating: 3, language: "Manglish", text: "Hmm not sure what to say, can improve kot.", sentiment: "neutral", category: "Unclear", severity: "low", reason: "Vague feedback does not identify a specific issue.", confidence: 0.51, draftReply: "Hai Hana, terima kasih atas maklum balas. Boleh kongsikan bahagian yang kami boleh perbaiki? Kami sedia mendengar." },
  { reviewer: "Samantha Goh", outlet: "Brew & Kin — Bangsar", rating: 5, language: "English", text: "The pandan cake is incredible and the team remembered my usual order. Such a thoughtful place.", sentiment: "positive", category: "Food", severity: "low", reason: "Praise for pandan cake and attentive service.", confidence: 0.99, draftReply: "Hi Samantha, thank you for the lovely note. We’re happy the pandan cake and familiar welcome made your visit special." },
  { reviewer: "Fikri Hassan", outlet: "Brew & Kin — Mont Kiara", rating: 4, language: "Malay", text: "Tempat selesa dan bersih. Matcha pun sedap.", sentiment: "positive", category: "Atmosphere", severity: "low", reason: "Positive feedback about cleanliness, comfort, and matcha.", confidence: 0.97, draftReply: "Hai Fikri, terima kasih! Kami gembira Fikri selesa di sini dan suka matcha kami." },
  { reviewer: "Priya Nair", outlet: "Brew & Kin — Bangsar", rating: 2, language: "English", text: "My order came cold and the table was sticky.", sentiment: "negative", category: "Food quality", severity: "medium", reason: "Cold order and cleanliness concern.", confidence: 0.96, draftReply: "Hi Priya, we’re sorry your order wasn’t served warm and your table wasn’t clean. We’ve shared this with the team so we can do better." },
  { reviewer: "Izzat Rosli", outlet: "Brew & Kin — Mont Kiara", rating: 3, language: "Malay", text: "Rasa makanan okay, tapi harga agak mahal.", sentiment: "neutral", category: "Value", severity: "low", reason: "Mixed feedback about food and pricing.", confidence: 0.87, draftReply: "Hai Izzat, terima kasih kerana berkongsi. Kami hargai maklum balas tentang harga dan akan terus berusaha memberi nilai yang baik." },
  { reviewer: "Olivia Chan", outlet: "Brew & Kin — Bangsar", rating: 5, language: "English", text: "Great coffee, friendly barista, and a perfect spot for a quick catch-up.", sentiment: "positive", category: "Coffee", severity: "low", reason: "Praise for coffee, staff, and atmosphere.", confidence: 0.98, draftReply: "Hi Olivia, thanks for the kind words. We’re glad you had a good catch-up over coffee. See you next time!" },
  { reviewer: "Syafiqah Noor", outlet: "Brew & Kin — Mont Kiara", rating: 2, language: "Manglish", text: "Order wrong twice, then waited another 20 minutes. A bit frustrating lah.", sentiment: "negative", category: "Order accuracy", severity: "medium", reason: "Repeated order mistake followed by extra wait.", confidence: 0.96, draftReply: "Hi Syafiqah, we’re sorry your order was wrong twice and took longer to fix. That’s frustrating, and we’re reviewing how we can prevent it happening again." },
  { reviewer: "Benjamin Teoh", outlet: "Brew & Kin — Bangsar", rating: 4, language: "English", text: "Good eggs benedict and fast service today.", sentiment: "positive", category: "Food", severity: "low", reason: "Positive feedback about brunch and service.", confidence: 0.97, draftReply: "Hi Benjamin, thanks for coming by. We’re glad you enjoyed the eggs benedict and quick service!" },
  { reviewer: "Nadia Karim", outlet: "Brew & Kin — Mont Kiara", rating: 1, language: "Malay", text: "Air dalam gelas berbau pelik. Saya tak minum.", sentiment: "negative", category: "Food safety", severity: "high", reason: "Guest reports an unusual smell from drinking water.", confidence: 0.96, draftReply: "Hai Nadia, kami mohon maaf dan akan menyemak perkara ini dengan segera. Keselamatan tetamu amat penting. Pemilik kafe telah dimaklumkan untuk membuat pemeriksaan." },
  { reviewer: "Lucas Pereira", outlet: "Brew & Kin — Bangsar", rating: 3, language: "English", text: "Decent place. Music was a little loud for a meeting.", sentiment: "neutral", category: "Atmosphere", severity: "low", reason: "Neutral visit with a note about music volume.", confidence: 0.91, draftReply: "Hi Lucas, thanks for the feedback. We’re sorry the music made your meeting harder and will keep the volume in mind." },
  { reviewer: "Kavitha Menon", outlet: "Brew & Kin — Mont Kiara", rating: 5, language: "English", text: "The team were so kind with my kids. Excellent service and lovely waffles.", sentiment: "positive", category: "Service", severity: "low", reason: "Praise for family-friendly service and food.", confidence: 0.99, draftReply: "Hi Kavitha, thanks for bringing the family in. We’re so glad you all felt welcome and enjoyed the waffles!" },
  { reviewer: "Hakim Salleh", outlet: "Brew & Kin — Bangsar", rating: 2, language: "Malay", text: "Pesanan lambat dan kopi dah sejuk bila sampai.", sentiment: "negative", category: "Slow service", severity: "medium", reason: "Late order arrived cold.", confidence: 0.94, draftReply: "Hai Hakim, kami mohon maaf kerana pesanan lambat dan kopi sampai dalam keadaan sejuk. Kami akan semak semula cara pesanan disediakan dan dihantar." },
  { reviewer: "Grace Lau", outlet: "Brew & Kin — Mont Kiara", rating: 4, language: "Manglish", text: "Cute café, matcha latte nice. Will come again for sure.", sentiment: "positive", category: "Drinks", severity: "low", reason: "Positive feedback about drinks and café.", confidence: 0.98, draftReply: "Hi Grace, thank you for stopping by. We’re glad you liked the matcha latte and look forward to seeing you again!" },
  { reviewer: "Adam Iskandar", outlet: "Brew & Kin — Bangsar", rating: 2, language: "English", text: "Staff seemed overwhelmed and nobody checked on our table.", sentiment: "negative", category: "Service", severity: "medium", reason: "Guest felt unattended during a busy visit.", confidence: 0.92, draftReply: "Hi Adam, we’re sorry you felt overlooked. Your feedback helps us improve how we look after guests during busy periods." },
  { reviewer: "Yee Min", outlet: "Brew & Kin — Mont Kiara", rating: 3, language: "Malay", text: "Semuanya biasa sahaja. Mungkin datang lagi.", sentiment: "neutral", category: "Overall experience", severity: "low", reason: "Neutral overall experience.", confidence: 0.89, draftReply: "Hai Yee Min, terima kasih kerana singgah. Kami harap lawatan seterusnya lebih istimewa." },
  { reviewer: "Isabel Wong", outlet: "Brew & Kin — Bangsar", rating: 5, language: "English", text: "Best iced latte around Bangsar. The barista was lovely too.", sentiment: "positive", category: "Coffee", severity: "low", reason: "Praise for iced latte and barista.", confidence: 0.99, draftReply: "Hi Isabel, thanks for the lovely review. We’re happy you enjoyed the iced latte and warm service!" },
  { reviewer: "Zul Ariffin", outlet: "Brew & Kin — Mont Kiara", rating: 2, language: "Manglish", text: "The soup was lukewarm and quite bland. Not worth the price.", sentiment: "negative", category: "Food quality", severity: "medium", reason: "Soup temperature, taste, and value concerns.", confidence: 0.95, draftReply: "Hi Zul, we’re sorry the soup didn’t meet expectations. We’ve passed your comments on to our kitchen team." },
  { reviewer: "Maya Devi", outlet: "Brew & Kin — Bangsar", rating: 4, language: "English", text: "Really nice staff and good pastries. A little noisy at lunch but still enjoyable.", sentiment: "positive", category: "Atmosphere", severity: "low", reason: "Mostly positive visit with a noise note.", confidence: 0.93, draftReply: "Hi Maya, thanks for your kind review. We’re glad you enjoyed the pastries and service, and appreciate the note about lunchtime noise." },
];

function fridayDate(index: number): Date {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const fridays: number[] = [];
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    if (date.getUTCMonth() !== now.getUTCMonth()) break;
    if (date.getUTCDay() === 5) fridays.push(day);
  }
  const day = fridays[index % fridays.length] ?? first.getUTCDate();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 19 + (index % 3), 0));
}

function nonFridayDate(index: number): Date {
  const now = new Date();
  const days: number[] = [];
  const monthLength = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  for (let day = 1; day <= monthLength; day += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    if (date.getUTCDay() !== 5) days.push(day);
  }
  const day = days[index % days.length] ?? 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 14, 0));
}

function route(input: SeedInput): { assignedRole: Role; status: Status; ruleFired: string } {
  if (input.confidence < 0.6 || input.missingInfo) {
    return { assignedRole: "Manager", status: "Needs approval", ruleFired: "Low confidence or missing information → Manager (needs human)" };
  }
  if (input.severity === "high") {
    return { assignedRole: "Owner", status: "Needs owner", ruleFired: "High severity → Owner" };
  }
  if (input.sentiment === "negative") {
    return { assignedRole: "Manager", status: "Needs approval", ruleFired: "Negative sentiment → Manager" };
  }
  if ((input.sentiment === "positive" || input.sentiment === "neutral") && input.severity === "low") {
    return { assignedRole: "Staff", status: "New", ruleFired: "Positive/neutral + low severity → Staff" };
  }
  return { assignedRole: "Manager", status: "Needs approval", ruleFired: "Anything else → Manager" };
}

export async function ensureResolveSeeded(): Promise<void> {
  await db.transaction(async (tx) => {
  await tx.insert(tenantsTable).values({ id: "resolve-demo", managerVoucherLimitRm: 20 }).onConflictDoNothing();
  await tx.insert(usersTable).values([
    { id: "demo-staff", role: "Staff", tenantId: "resolve-demo", outletId: "Brew & Kin — Bangsar" },
    { id: "demo-manager", role: "Manager", tenantId: "resolve-demo", outletId: "Brew & Kin — Bangsar" },
    { id: "demo-owner", role: "Owner", tenantId: "resolve-demo", outletId: "Brew & Kin — Bangsar" },
  ]).onConflictDoNothing();
  const current = await tx.select({ id: reviewsTable.id }).from(reviewsTable).limit(1);
  if (current.length > 0) return;

  const records = samples.map((sample, index) => {
    const routing = route(sample);
    const createdAt = sample.fridayIndex === undefined
      ? nonFridayDate(index)
      : fridayDate(sample.fridayIndex);
    return {
      id: `review-${String(index + 1).padStart(3, "0")}`,
      tenantId: "resolve-demo",
      outletId: sample.outlet,
      reviewer: sample.reviewer,
      outlet: sample.outlet,
      rating: sample.rating,
      language: sample.language,
      text: sample.text,
      sentiment: sample.sentiment,
      category: sample.category,
      severity: sample.severity,
      reason: sample.reason,
      confidence: sample.confidence,
      draftReply: sample.draftReply,
      status: routing.status,
      assignedRole: routing.assignedRole,
      createdAt,
      missingInfo: sample.missingInfo ?? false,
      usedFallback: false,
      voucherAmount: null,
      rejectionReason: null,
      ruleFired: routing.ruleFired,
    };
  });

  await tx.insert(reviewsTable).values(records).onConflictDoNothing();
  const activity = records.flatMap((review) => [
    {
      id: randomUUID(),
      reviewId: review.id,
      actor: "Resolve",
      role: "System",
      action: "review_received",
      details: `Review received from ${review.reviewer}`,
      createdAt: review.createdAt,
    },
    {
      id: randomUUID(),
      reviewId: review.id,
      actor: "Resolve",
      role: "System",
      action: "rule_routed",
      details: review.ruleFired ?? "Review routed",
      createdAt: new Date(review.createdAt.getTime() + 1000),
    },
  ]);
  await tx.insert(activityTable).values(activity).onConflictDoNothing();
  });
  // Also runs for existing databases, rather than skipping once reviews exist.
  await ensureOutletDemoReviews();
}
