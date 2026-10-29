/**
 * Business-type settings. A new kind of SME is a new entry here, not a rebuild:
 * the approval gate, routing rules and activity log are shared by every type.
 * Each type maps its own words onto Resolve's shared case categories, so the
 * safety rules (high severity → Owner) apply unchanged.
 */
export type BusinessType = "cafe" | "salon";
export type SharedCategory =
  | "service_speed" | "food_safety" | "staff_attitude" | "harassment" | "order_accuracy"
  | "food_quality" | "atmosphere" | "value" | "billing" | "praise" | "unclear" | "other";
type Language = "English" | "Malay" | "Manglish";

export type BusinessProfile = {
  label: string;
  /** Used in the AI prompt: who the reviews are for. */
  description: string;
  categoryLabels: Record<SharedCategory, string>;
  /** Extra keywords per category for Basic (keyword) mode. */
  keywords: Partial<Record<SharedCategory, RegExp>>;
  /** Reply templates that differ from the café wording. */
  templates: Partial<Record<SharedCategory, Record<Language, string>>>;
  /** Guidance for the AI prompt about what each shared category means here. */
  categoryGuide: string;
  /** Simulated reviews for "Bring in a review". */
  samples: { reviewer: string; rating: number; text: string }[];
};

const sharedLabels: Record<SharedCategory, string> = {
  service_speed: "Slow service", food_safety: "Food safety", staff_attitude: "Staff attitude",
  harassment: "Harassment", order_accuracy: "Order accuracy", food_quality: "Food quality",
  atmosphere: "Atmosphere", value: "Value", billing: "Billing", praise: "Praise",
  unclear: "Unclear", other: "Other",
};

export const businessProfiles: Record<BusinessType, BusinessProfile> = {
  cafe: {
    label: "Café",
    description: "an owner-run independent café in Malaysia",
    categoryLabels: sharedLabels,
    keywords: {},
    templates: {},
    categoryGuide: "",
    samples: [
      { reviewer: "Sofia Tan", rating: 5, text: "A lovely little café. The team made my morning." },
      { reviewer: "Rizal Ahmad", rating: 2, text: "Waited quite long for my order, can improve the service." },
      { reviewer: "Emma Lim", rating: 4, text: "Kopi sedap, suasana pun selesa." },
      { reviewer: "Nurin Ahmad", rating: 1, text: "Ada benda asing dalam makanan saya. Tolong periksa segera." },
      { reviewer: "Aina Rahman", rating: 2, text: "Tunggu 40 minit, staff rude gila." },
    ],
  },
  salon: {
    label: "Hair salon",
    description: "an owner-run independent hair salon in Malaysia",
    categoryLabels: {
      ...sharedLabels,
      service_speed: "Wait time",
      food_safety: "Hygiene & safety",
      order_accuracy: "Wrong service",
      food_quality: "Service quality",
      value: "Pricing",
    },
    keywords: {
      service_speed: /\b(booking|appointment|late|kept waiting|over ?time|janji temu|lewat)\b/i,
      food_safety: /\b(not cleaned|unclean|dirty (scissors|comb|tools?|towel|brush)|reused towel|burn(t|ed)? (my )?scalp|scalp burn|burn(t|ed)|allerg(y|ic)|rash|itchy scalp|infection|bleeding|cut my (ear|skin|neck)|kulit terbakar|gatal|alahan|tak bersih|kotor)\b/i,
      order_accuracy: /\b(not what i asked|wrong (colou?r|cut|style|shade)|too short|asked for|didn'?t listen|bukan yang saya minta|salah warna|terlalu pendek)\b/i,
      food_quality: /\b(uneven|patchy|bad cut|botched|frizzy|damaged hair|hair fall|brassy|tak kemas|rosak)\b/i,
    },
    templates: {
      food_safety: {
        English: "Hi, we’re sorry to hear about your concern at {outlet}. Hygiene and your safety come first, and the owner will review this promptly.",
        Malay: "Hai, kami kesal mendengar kebimbangan anda di {outlet}. Kebersihan dan keselamatan anda amat penting, dan pemilik akan menyemak perkara ini dengan segera.",
        Manglish: "Hi, sorry to hear this happened at {outlet}. Hygiene and your safety come first, the owner will review this promptly.",
      },
      food_quality: {
        English: "Hi, we’re sorry the result at {outlet} didn’t meet your expectations. We’ve shared your feedback with our stylists.",
        Malay: "Hai, kami mohon maaf kerana hasil di {outlet} tidak menepati jangkaan anda. Maklum balas anda telah dikongsi dengan pendandan kami.",
        Manglish: "Hi, sorry the result at {outlet} wasn’t up to standard. We’ve shared your feedback with our stylists.",
      },
      order_accuracy: {
        English: "Hi, we’re sorry the service at {outlet} wasn’t what you asked for. We’ll review how our stylists confirm each request.",
        Malay: "Hai, kami mohon maaf kerana perkhidmatan di {outlet} bukan seperti yang diminta. Kami akan menyemak cara pendandan mengesahkan permintaan.",
        Manglish: "Hi, sorry the service at {outlet} wasn’t what you asked for. We’ll review how our stylists confirm each request.",
      },
      service_speed: {
        English: "Hi, we’re sorry you were kept waiting at {outlet}. We’re reviewing how we schedule appointments. Thank you for letting us know.",
        Malay: "Hai, kami mohon maaf kerana anda perlu menunggu di {outlet}. Kami sedang menyemak cara janji temu dijadualkan. Terima kasih.",
        Manglish: "Hi, sorry you had to tunggu at {outlet}. We’re reviewing how we schedule appointments. Thanks for letting us know.",
      },
    },
    categoryGuide: "For this salon: service_speed means waiting past the booking time; food_safety means hygiene or physical safety (unclean tools, burns, allergic reactions, cuts) and is always high severity; order_accuracy means the service was not what the customer asked for; food_quality means the quality of the cut, colour or treatment; value means pricing.",
    samples: [
      { reviewer: "Mei Ling", rating: 2, text: "Waited 45 minutes past my booking time. Please manage appointments better." },
      { reviewer: "Kavitha", rating: 1, text: "Scissors were not cleaned between customers. Very worrying." },
      { reviewer: "Jason Tan", rating: 5, text: "Best fade I've had, the stylist was friendly and patient." },
      { reviewer: "Nadia Yusof", rating: 2, text: "Asked for a light trim but it's too short now. Didn't listen to me." },
      { reviewer: "Amir Hakim", rating: 4, text: "Tempat bersih dan staff mesra. Harga pun berpatutan." },
    ],
  },
};

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && value in businessProfiles;
}

export function profileFor(type: string | null | undefined): BusinessProfile {
  return isBusinessType(type) ? businessProfiles[type] : businessProfiles.cafe;
}
