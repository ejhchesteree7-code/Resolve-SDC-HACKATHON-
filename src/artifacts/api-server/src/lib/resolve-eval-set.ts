import type { AiCategory } from "./resolve-ai";

/**
 * Labelled synthetic test set for the routing KPI (Phase 1 target: at least 90%
 * correct routing). Labels were written by the team as a person would judge each
 * review, before checking what Resolve outputs. `urgent` marks cases that must
 * reach the Owner (food safety / hygiene, harassment, money disputes).
 */
export type EvalCase = {
  businessType: "cafe" | "salon";
  rating: number;
  text: string;
  category: AiCategory;
  urgent: boolean;
};

export const evalSet: EvalCase[] = [
  // Café: complaints
  { businessType: "cafe", rating: 2, text: "Waited 35 minutes for two coffees.", category: "service_speed", urgent: false },
  { businessType: "cafe", rating: 1, text: "Tunggu lama sangat, hampir sejam baru dapat makanan.", category: "service_speed", urgent: false },
  { businessType: "cafe", rating: 2, text: "Service very slow lah, waited forever for the bill.", category: "service_speed", urgent: false },
  { businessType: "cafe", rating: 1, text: "The cashier was rude when I asked about my order.", category: "staff_attitude", urgent: false },
  { businessType: "cafe", rating: 2, text: "Staff kasar dan tak senyum langsung.", category: "staff_attitude", urgent: false },
  { businessType: "cafe", rating: 2, text: "Ordered oat milk latte but got normal milk.", category: "order_accuracy", urgent: false },
  { businessType: "cafe", rating: 2, text: "Wrong order again, I asked for iced not hot.", category: "order_accuracy", urgent: false },
  { businessType: "cafe", rating: 2, text: "Pasta was cold and bland.", category: "food_quality", urgent: false },
  { businessType: "cafe", rating: 2, text: "Nasi lemak tak sedap, sambal tawar.", category: "food_quality", urgent: false },
  { businessType: "cafe", rating: 3, text: "Too noisy to work, the music is very loud.", category: "atmosphere", urgent: false },
  { businessType: "cafe", rating: 3, text: "Quite expensive for the portion size.", category: "value", urgent: false },
  { businessType: "cafe", rating: 3, text: "Harga mahal sikit untuk kopi biasa.", category: "value", urgent: false },
  // Café: urgent
  { businessType: "cafe", rating: 1, text: "Found a cockroach near my table.", category: "food_safety", urgent: true },
  { businessType: "cafe", rating: 1, text: "Got food poisoning after eating the chicken rice.", category: "food_safety", urgent: true },
  { businessType: "cafe", rating: 1, text: "Ada rambut dalam makanan saya.", category: "food_safety", urgent: true },
  { businessType: "cafe", rating: 1, text: "I was charged twice for the same meal, please refund.", category: "billing", urgent: true },
  { businessType: "cafe", rating: 1, text: "Bil salah, dicaj dua kali.", category: "billing", urgent: true },
  { businessType: "cafe", rating: 1, text: "A staff member kept making unwanted comments, I felt unsafe.", category: "harassment", urgent: true },
  // Café: praise and vague
  { businessType: "cafe", rating: 5, text: "Lovely coffee and friendly service.", category: "praise", urgent: false },
  { businessType: "cafe", rating: 5, text: "Kopi sedap, staff mesra. Terbaik!", category: "praise", urgent: false },
  { businessType: "cafe", rating: 5, text: "Best croissant in town, thank you!", category: "praise", urgent: false },
  { businessType: "cafe", rating: 4, text: "Nice place, great cake.", category: "praise", urgent: false },
  { businessType: "cafe", rating: 3, text: "Okay lah, biasa.", category: "unclear", urgent: false },
  { businessType: "cafe", rating: 3, text: "Hmm, not sure, can improve.", category: "unclear", urgent: false },
  // Salon: complaints
  { businessType: "salon", rating: 2, text: "Waited 40 minutes past my appointment time.", category: "service_speed", urgent: false },
  { businessType: "salon", rating: 2, text: "Booking at 3pm but only started at 4pm.", category: "service_speed", urgent: false },
  { businessType: "salon", rating: 2, text: "Asked for a trim but it's way too short now.", category: "order_accuracy", urgent: false },
  { businessType: "salon", rating: 2, text: "Wrong colour, I asked for ash brown not red.", category: "order_accuracy", urgent: false },
  { businessType: "salon", rating: 2, text: "Uneven cut and patchy colour.", category: "food_quality", urgent: false },
  { businessType: "salon", rating: 2, text: "The stylist was rude and rushed me.", category: "staff_attitude", urgent: false },
  { businessType: "salon", rating: 3, text: "Price was higher than the price list said, too expensive.", category: "value", urgent: false },
  // Salon: urgent
  { businessType: "salon", rating: 1, text: "Scissors were not cleaned between customers.", category: "food_safety", urgent: true },
  { businessType: "salon", rating: 1, text: "The bleach burned my scalp.", category: "food_safety", urgent: true },
  { businessType: "salon", rating: 1, text: "Allergic reaction and rash after the hair dye.", category: "food_safety", urgent: true },
  { businessType: "salon", rating: 1, text: "Charged twice for one haircut, need a refund.", category: "billing", urgent: true },
  // Salon: praise and vague
  { businessType: "salon", rating: 5, text: "Best fade I've had, friendly stylist.", category: "praise", urgent: false },
  { businessType: "salon", rating: 5, text: "Love my new colour, thank you!", category: "praise", urgent: false },
  { businessType: "salon", rating: 4, text: "Tempat bersih dan staff mesra.", category: "praise", urgent: false },
  { businessType: "salon", rating: 3, text: "Fine, nothing special.", category: "unclear", urgent: false },
  { businessType: "salon", rating: 3, text: "Okay lah.", category: "unclear", urgent: false },
];
