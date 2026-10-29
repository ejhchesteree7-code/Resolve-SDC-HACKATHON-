/**
 * Business-type settings. A new kind of SME is a new entry here, not a rebuild:
 * the approval gate, routing rules and activity log are shared by every type.
 * Each type maps its own words onto Resolve's shared case categories, so the
 * safety rules (high severity → Owner) apply unchanged.
 */
export type BusinessType = "cafe" | "salon" | "retail" | "workshop" | "petcare";
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
  retail: {
    label: "Retail shop",
    description: "an owner-run independent retail shop in Malaysia",
    categoryLabels: {
      ...sharedLabels,
      service_speed: "Slow checkout",
      food_safety: "Product safety",
      order_accuracy: "Wrong item or stock",
      food_quality: "Product quality",
      value: "Pricing",
    },
    keywords: {
      service_speed: /\b(queue|long line|checkout|cashier|counter|only one cashier|beratur|barisan panjang)\b/i,
      food_safety: /\b(expired|expiry|past (its|the) date|tamat tempoh|unsafe|dangerous|injur(ed|y)|cut myself|broken glass|caught fire|recall(ed)?|bahaya)\b/i,
      order_accuracy: /\b(wrong (item|size|colou?r|model)|not what i (ordered|bought)|missing item|out of stock|no stock|habis stok|salah barang|tiada stok)\b/i,
      food_quality: /\b(defective|faulty|broke(n)? after|stopped working|fake|not original|tak original|damaged|torn|cracked|rosak|cacat)\b/i,
    },
    templates: {
      food_safety: {
        English: "Hi, we’re sorry to hear about this at {outlet}. Your safety comes first, and the owner will look into this product promptly.",
        Malay: "Hai, kami kesal mendengar perkara ini di {outlet}. Keselamatan anda paling penting, dan pemilik akan menyemak produk ini dengan segera.",
        Manglish: "Hi, sorry to hear this happened at {outlet}. Your safety comes first, the owner will check this product promptly.",
      },
      food_quality: {
        English: "Hi, we’re sorry the product from {outlet} didn’t hold up. Please bring it back with your receipt and we’ll sort it out.",
        Malay: "Hai, kami mohon maaf kerana produk dari {outlet} bermasalah. Sila bawa semula bersama resit dan kami akan selesaikannya.",
        Manglish: "Hi, sorry the product from {outlet} gave problems. Bring it back with the receipt and we’ll settle it for you.",
      },
      order_accuracy: {
        English: "Hi, we’re sorry you didn’t get what you came for at {outlet}. We’re checking how we label and restock items.",
        Malay: "Hai, kami mohon maaf kerana anda tidak mendapat barang yang dicari di {outlet}. Kami sedang menyemak cara label dan stok diurus.",
        Manglish: "Hi, sorry you didn’t get what you wanted at {outlet}. We’re checking our labels and restocking.",
      },
      service_speed: {
        English: "Hi, we’re sorry about the wait at the counter at {outlet}. We’re looking at how we staff the checkout at busy times.",
        Malay: "Hai, kami mohon maaf atas masa menunggu di kaunter {outlet}. Kami sedang menyemak bilangan juruwang pada waktu sibuk.",
        Manglish: "Hi, sorry you had to queue long at {outlet}. We’re looking at our cashier staffing for busy times.",
      },
    },
    categoryGuide: "For this retail shop: service_speed means long queues or slow checkout; food_safety means product safety (expired or unsafe goods, injury) and is always high severity; order_accuracy means the wrong item, wrong size or out-of-stock items; food_quality means a defective, damaged or fake product; value means pricing.",
    samples: [
      { reviewer: "Daniel Lee", rating: 2, text: "Only one cashier on a Saturday, the queue took 20 minutes." },
      { reviewer: "Farhana", rating: 1, text: "The baby formula I bought was expired. Please check your shelves." },
      { reviewer: "Ken Wong", rating: 2, text: "Charger stopped working after two days, looks fake." },
      { reviewer: "Priya", rating: 5, text: "Friendly staff helped me find the right size. Great shop!" },
      { reviewer: "Hakim", rating: 2, text: "Advertised item was out of stock again." },
    ],
  },
  workshop: {
    label: "Car workshop",
    description: "an owner-run independent car repair workshop in Malaysia",
    categoryLabels: {
      ...sharedLabels,
      service_speed: "Repair delay",
      food_safety: "Vehicle safety",
      order_accuracy: "Unapproved work",
      food_quality: "Repair quality",
      value: "Pricing",
    },
    keywords: {
      service_speed: /\b(still waiting|not ready|ready after|promised|took (\d+|two|three|four|five) (days|weeks)|delay(ed)?|days late|lambat siap|tak siap)\b/i,
      food_safety: /\b(brakes?|brek|steering|unsafe|accident|almost crashed|caught fire|smoke|tyre burst|wheel came loose|bahaya|hampir kemalangan)\b/i,
      order_accuracy: /\b(without (asking|my permission|telling me)|didn'?t ask|wrong part|replaced .* without|tak minta|tanpa kebenaran)\b/i,
      food_quality: /\b(still not fixed|not fixed|came back|problem again|same problem|scratch(ed)?|dent(ed)?|damaged my car|calar|masih rosak|tak baiki)\b/i,
    },
    templates: {
      food_safety: {
        English: "Hi, we’re very sorry to hear this about your car after visiting {outlet}. Your safety comes first: the owner will contact you and check the vehicle as a priority.",
        Malay: "Hai, kami amat kesal mendengar tentang kereta anda selepas ke {outlet}. Keselamatan anda paling penting: pemilik akan menghubungi anda dan memeriksa kenderaan dengan segera.",
        Manglish: "Hi, very sorry to hear this about your car after {outlet}. Safety first: the owner will contact you and check the car straight away.",
      },
      food_quality: {
        English: "Hi, we’re sorry the problem wasn’t properly fixed at {outlet}. Please bring the car back and we’ll recheck the work at no extra charge for the inspection.",
        Malay: "Hai, kami mohon maaf kerana masalah tidak dibaiki dengan baik di {outlet}. Sila bawa kereta semula dan kami akan memeriksa kerja tersebut.",
        Manglish: "Hi, sorry the problem not properly fixed at {outlet}. Bring the car back and we’ll recheck the work for you.",
      },
      order_accuracy: {
        English: "Hi, we’re sorry work was done without your clear go-ahead at {outlet}. We’ll review this with you and make sure every job is confirmed first.",
        Malay: "Hai, kami mohon maaf kerana kerja dibuat tanpa persetujuan jelas anda di {outlet}. Kami akan menyemak perkara ini bersama anda.",
        Manglish: "Hi, sorry the work was done without asking you first at {outlet}. We’ll go through it with you and confirm every job from now.",
      },
      service_speed: {
        English: "Hi, we’re sorry your car took longer than promised at {outlet}. We’re reviewing how we give completion times.",
        Malay: "Hai, kami mohon maaf kerana kereta anda mengambil masa lebih lama daripada dijanjikan di {outlet}. Kami sedang menyemak cara anggaran masa diberi.",
        Manglish: "Hi, sorry your car took longer than promised at {outlet}. We’re reviewing how we give completion times.",
      },
    },
    categoryGuide: "For this car workshop: service_speed means the car took longer than promised; food_safety means vehicle safety after a repair (brakes, steering, fire, near accidents) and is always high severity; order_accuracy means work or parts done without the customer's approval; food_quality means the repair quality (still not fixed, damage to the car); value means pricing; overcharging or double charging is billing.",
    samples: [
      { reviewer: "Ahmad Faiz", rating: 1, text: "Brakes felt soft right after the service, almost crashed on the highway." },
      { reviewer: "Lim Wei", rating: 2, text: "Promised two days, the car was ready after a week." },
      { reviewer: "Suresh", rating: 2, text: "Aircond still not fixed, same problem came back." },
      { reviewer: "Nora", rating: 2, text: "They replaced parts without asking me first." },
      { reviewer: "Jason Ong", rating: 5, text: "Great mechanic, honest and explained everything clearly." },
    ],
  },
  petcare: {
    label: "Pet care",
    description: "an owner-run pet shop, grooming and boarding business in Malaysia",
    categoryLabels: {
      ...sharedLabels,
      service_speed: "Wait time",
      food_safety: "Pet safety",
      order_accuracy: "Wrong service",
      food_quality: "Care quality",
      value: "Pricing",
    },
    keywords: {
      service_speed: /\b(pick ?up|collection|kept waiting|late|lambat|appointment)\b/i,
      food_safety: /\b(injur(ed|y)|bleeding|wound|cut (my|his|her|the) (dog|cat|pet)|nicked|limping|sick after|vomit(ing|ed)?|escaped|ran away|lost (my|our) (dog|cat|pet)|died|luka|berdarah|hilang|sakit)\b/i,
      order_accuracy: /\b(wrong (cut|groom|food|style)|shaved (him|her|my)|not what i asked|asked for|bukan yang saya minta)\b/i,
      food_quality: /\b(still dirty|smell(y|s)?|matted|not fed|dirty cage|unclean|fleas?|ticks?|kotor|busuk)\b/i,
    },
    templates: {
      food_safety: {
        English: "Hi, we’re so sorry to hear about your pet after their stay at {outlet}. Their safety comes first: the owner will contact you right away.",
        Malay: "Hai, kami amat kesal mendengar tentang haiwan kesayangan anda selepas di {outlet}. Keselamatannya paling penting: pemilik akan menghubungi anda segera.",
        Manglish: "Hi, so sorry to hear about your pet after {outlet}. Their safety comes first, the owner will contact you right away.",
      },
      food_quality: {
        English: "Hi, we’re sorry your pet wasn’t cared for to the standard you expect at {outlet}. We’re reviewing this with our team.",
        Malay: "Hai, kami mohon maaf kerana penjagaan haiwan anda di {outlet} tidak memuaskan. Kami sedang menyemak perkara ini bersama pasukan.",
        Manglish: "Hi, sorry the care for your pet at {outlet} wasn’t up to standard. We’re checking this with the team.",
      },
      order_accuracy: {
        English: "Hi, we’re sorry the service at {outlet} wasn’t what you asked for. We’ll confirm every request before we start from now on.",
        Malay: "Hai, kami mohon maaf kerana perkhidmatan di {outlet} bukan seperti yang diminta. Kami akan mengesahkan setiap permintaan sebelum bermula.",
        Manglish: "Hi, sorry the service at {outlet} wasn’t what you asked for. We’ll confirm every request before starting.",
      },
    },
    categoryGuide: "For this pet care business: service_speed means waiting at drop-off or pick-up; food_safety means the pet's safety (injury, illness after a stay, a lost or escaped pet) and is always high severity; order_accuracy means the wrong groom or service; food_quality means the standard of care (still dirty, not fed, unclean cages); value means pricing.",
    samples: [
      { reviewer: "Melissa", rating: 1, text: "My dog came back from grooming with a cut on his ear and bleeding." },
      { reviewer: "Arif", rating: 2, text: "Waited 40 minutes at pick up, nobody told us anything." },
      { reviewer: "Chloe Tan", rating: 2, text: "Asked for a light trim but they shaved her completely." },
      { reviewer: "Rajesh", rating: 2, text: "Cat came back from boarding still dirty and smelly." },
      { reviewer: "Aisyah", rating: 5, text: "Love this place, they treated my cat like family." },
    ],
  },
};

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && value in businessProfiles;
}

export function profileFor(type: string | null | undefined): BusinessProfile {
  return isBusinessType(type) ? businessProfiles[type] : businessProfiles.cafe;
}
