import type { WorkspaceKind } from "@/shared/schemas/domain";

export type AspectDef = {
  key: string;
  name: string;
  definition: string;
  examples: string[];
  counterExamples: string[];
};

const BUSINESS_ASPECTS: AspectDef[] = [
  {
    key: "staff",
    name: "Staff & hospitality",
    definition:
      "How people were treated by staff: warmth, professionalism, attentiveness, rudeness, or helpfulness.",
    examples: ["The coordinator was kind and on top of everything", "Staff ignored us"],
    counterExamples: ["long wait but worth it — wait is speed, not staff attitude"],
  },
  {
    key: "speed",
    name: "Speed & waiting",
    definition: "Queues, late starts, slow service, or impressively quick turnaround.",
    examples: ["Waited 40 minutes", "Seated immediately"],
    counterExamples: ["long wait but worth it can still be a speed complaint plus overall praise"],
  },
  {
    key: "food",
    name: "Food",
    definition: "Taste, freshness, temperature, portions, or presentation of food. Drinks are separate.",
    examples: ["Cold food", "Best nasi lemak", "Portion was tiny"],
    counterExamples: ["Great cocktails belong in drinks", "dry rub is a style, not dried-out food"],
  },
  {
    key: "drinks",
    name: "Drinks",
    definition: "Coffee, tea, cocktails, soft drinks, or the bar. Not the meal itself.",
    examples: ["Flat white was perfect", "Watered-down cocktails"],
    counterExamples: ["Cold food is food, not drinks"],
  },
  {
    key: "cleanliness",
    name: "Cleanliness",
    definition: "Hygiene of halls, rooms, toilets, tables, or kitchens.",
    examples: ["Toilets were filthy", "Spotless ballroom"],
    counterExamples: [],
  },
  {
    key: "price",
    name: "Price & value",
    definition: "Whether the cost felt fair, expensive, hidden, or worth it.",
    examples: ["Overpriced packages", "Worth every ringgit"],
    counterExamples: [],
  },
  {
    key: "ambience",
    name: "Atmosphere",
    definition: "Vibe, noise, lighting, décor, and comfort of the space.",
    examples: ["Too loud to talk", "Beautiful lighting for photos"],
    counterExamples: [],
  },
  {
    key: "place",
    name: "Location & facilities",
    definition:
      "Getting there and the building itself: parking, location, rooms, stage, sound, capacity, accessibility. Not the mood of the room.",
    examples: ["Parking was a nightmare", "Stage and sound were excellent", "Hard to find"],
    counterExamples: ["Too loud to talk is atmosphere, not the building"],
  },
  {
    key: "booking",
    name: "Booking & coordination",
    definition: "Reservations, packages, communication before the visit, and how organised the event was.",
    examples: ["They changed the package last minute", "Booking was smooth"],
    counterExamples: [],
  },
  {
    key: "event",
    name: "Event experience",
    definition:
      "Weddings, shows, functions, or hosted events: flow, hosting, and whether the occasion itself worked.",
    examples: ["Perfect wedding venue", "The show started late and felt rushed"],
    counterExamples: ["A normal dinner complaint about food belongs in food, not event"],
  },
];

const APP_ASPECTS: AspectDef[] = [
  {
    key: "reliability",
    name: "Reliability / crashes",
    definition: "Stability, crashes, freezes, failed loads.",
    examples: ["App crashes on launch", "Never freezes"],
    counterExamples: [],
  },
  {
    key: "performance",
    name: "Performance",
    definition: "Speed, lag, battery drain unrelated to crashes.",
    examples: ["Very laggy scroll", "Snappy response"],
    counterExamples: [],
  },
  {
    key: "ux",
    name: "Usability / UX",
    definition: "Navigation clarity, layout, ease of completing tasks.",
    examples: ["Confusing menus", "Intuitive design"],
    counterExamples: [],
  },
  {
    key: "features",
    name: "Features",
    definition: "Presence, usefulness, or absence of product capabilities.",
    examples: ["Missing dark mode", "Love the widgets"],
    counterExamples: [],
  },
  {
    key: "pricing",
    name: "Pricing / subscriptions",
    definition: "Cost, paywalls, billing clarity.",
    examples: ["Hidden subscription", "Fair pricing"],
    counterExamples: [],
  },
  {
    key: "support",
    name: "Customer support",
    definition: "Help desk responsiveness and resolution quality.",
    examples: ["Support never replied", "Resolved in one day"],
    counterExamples: [],
  },
];

const CREATOR_ASPECTS: AspectDef[] = [
  {
    key: "content_quality",
    name: "Content quality",
    definition: "Production quality, usefulness, accuracy of the video/post.",
    examples: ["Super helpful tutorial", "Audio is terrible"],
    counterExamples: [],
  },
  {
    key: "topic_fit",
    name: "Topic / relevance",
    definition: "Whether the topic matches audience expectations.",
    examples: ["Not what the title promised", "Exactly what I needed"],
    counterExamples: [],
  },
  {
    key: "pacing",
    name: "Pacing / length",
    definition: "Pace, length, filler, or editing rhythm.",
    examples: ["Too much fluff", "Perfect length"],
    counterExamples: [],
  },
  {
    key: "hook",
    name: "Hook / intro",
    definition: "Opening engagement and clarity of the premise.",
    examples: ["Hooked me in 5 seconds", "Took forever to get to the point"],
    counterExamples: [],
  },
  {
    key: "cta_clarity",
    name: "CTA clarity",
    definition: "Clarity of calls to action without inventing demand.",
    examples: ["Clear next step", "CTA was confusing"],
    counterExamples: [],
  },
  {
    key: "community",
    name: "Community interaction",
    definition: "Creator responses and community tone in comments.",
    examples: ["Creator replies thoughtfully", "Toxic comment section"],
    counterExamples: [],
  },
];

export function aspectsForKind(kind: WorkspaceKind): AspectDef[] {
  switch (kind) {
    case "business":
      return BUSINESS_ASPECTS;
    case "app":
      return APP_ASPECTS;
    case "creator":
      return CREATOR_ASPECTS;
  }
}

export const CLASSIFICATION_SCHEMA_VERSION = "feedback_aspects.v3";

export function aspectLabel(key: string): string {
  const all = [...BUSINESS_ASPECTS, ...APP_ASPECTS, ...CREATOR_ASPECTS];
  return all.find((a) => a.key === key)?.name ?? key.replaceAll("_", " ");
}

const THEME_CRITERIA = {
  positive: "Clearly praised",
  negative: "Clearly criticised",
  mixed: "Both praised and criticised in this theme",
  not_mentioned: "This theme is not discussed",
} as const;

export function buildClassificationQuestions(kind: WorkspaceKind) {
  const aspects = aspectsForKind(kind);
  const primaryCriteria: Record<string, string> = {
    none: "No single theme explains the review",
  };
  for (const aspect of aspects) {
    primaryCriteria[aspect.key] = aspect.definition;
  }

  const questions: Record<string, unknown> = {
    verdict: {
      type: "choice",
      instructions: {
        question:
          "What is the overall verdict? Sarcasm and negation are not praise. A review is mixed only when it clearly contains both praise and a complaint. If you cannot tell, choose unclear.",
        praise: "Mainly positive",
        pain: "Mainly a complaint or disappointment",
        mixed: "Clear praise and a clear complaint",
        unclear: "Too short, off-topic, emoji-only, or no evaluable opinion",
      },
      criteria: {
        praise: "Mainly positive",
        pain: "Mainly negative",
        mixed: "Both praise and complaint",
        unclear: "Cannot tell",
      },
    },
    primary_theme: {
      type: "choice",
      instructions:
        "Pick the single theme that most explains the verdict. Choose none when the verdict is unclear or the review is only a vague 'great place' / 'never again' with no topic.",
      criteria: primaryCriteria,
    },
    is_irrelevant: {
      type: "noul",
      instructions: "Is this spam, emoji-only, or unrelated to the place, app, or creator?",
    },
    severity: {
      type: "score",
      instructions: "If there is a complaint, how severe is it for the customer? Use the low end when there is no complaint.",
      criteria: ["No issue", "Minor annoyance", "Moderate problem", "Severe / deal-breaker"],
    },
    switching_intent: {
      type: "noul",
      instructions: "Does the author explicitly say they will not return, will switch, or will not recommend?",
    },
    evidence_sentence_id: {
      type: "choice",
      instructions: {
        question: "Which sentence id best supports the strongest judgment? Pick none if unclear.",
        note: "Only choose a supplied sentence id. Do not invent quotations.",
      },
      criteria: { none: "No supporting sentence" },
    },
  };

  for (const aspect of aspects) {
    questions[`sent_${aspect.key}`] = {
      type: "choice",
      instructions: {
        question: `If the review discusses "${aspect.name}", what is the sentiment? Otherwise not_mentioned.`,
        definition: aspect.definition,
        examples: aspect.examples,
        counterExamples: aspect.counterExamples,
        rule: "Do not mark a theme just because the review is generally positive or negative.",
      },
      criteria: THEME_CRITERIA,
    };
  }

  return questions;
}
