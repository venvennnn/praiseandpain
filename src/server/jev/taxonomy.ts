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

export const CLASSIFICATION_SCHEMA_VERSION = "feedback_aspects.v4";

export type SpecificIssue = {
  key: string;
  name: string;
  parent: string;
  polarity: "positive" | "negative";
};

const SPECIFIC_ISSUES: SpecificIssue[] = [
  { key: "warm_welcome", name: "Warm welcome", parent: "staff", polarity: "positive" },
  { key: "staff_ignored", name: "Staff ignored guests", parent: "staff", polarity: "negative" },
  { key: "staff_rude", name: "Rude staff", parent: "staff", polarity: "negative" },
  { key: "seated_quickly", name: "Seated quickly", parent: "speed", polarity: "positive" },
  { key: "long_wait", name: "Long wait to be served", parent: "speed", polarity: "negative" },
  { key: "late_start", name: "Event started late", parent: "speed", polarity: "negative" },
  { key: "food_excellent", name: "Food worth praising", parent: "food", polarity: "positive" },
  { key: "food_cold", name: "Food arrived cold", parent: "food", polarity: "negative" },
  { key: "portions_small", name: "Portions too small", parent: "food", polarity: "negative" },
  { key: "drinks_good", name: "Drinks done well", parent: "drinks", polarity: "positive" },
  { key: "drinks_poor", name: "Drinks were poor", parent: "drinks", polarity: "negative" },
  { key: "place_spotless", name: "Place was spotless", parent: "cleanliness", polarity: "positive" },
  { key: "toilets_dirty", name: "Toilets were dirty", parent: "cleanliness", polarity: "negative" },
  { key: "good_value", name: "Felt worth the price", parent: "price", polarity: "positive" },
  { key: "overpriced", name: "Felt overpriced", parent: "price", polarity: "negative" },
  { key: "hidden_fees", name: "Hidden or surprise fees", parent: "price", polarity: "negative" },
  { key: "lovely_room", name: "Room, light, and vibe", parent: "ambience", polarity: "positive" },
  { key: "too_noisy", name: "Too noisy to enjoy", parent: "ambience", polarity: "negative" },
  { key: "easy_to_reach", name: "Easy to reach", parent: "place", polarity: "positive" },
  { key: "parking_hard", name: "Parking was hard", parent: "place", polarity: "negative" },
  { key: "hard_to_find", name: "Hard to find", parent: "place", polarity: "negative" },
  { key: "booking_smooth", name: "Booking was smooth", parent: "booking", polarity: "positive" },
  { key: "booking_fell_apart", name: "Booking fell apart", parent: "booking", polarity: "negative" },
  { key: "occasion_worked", name: "The occasion worked", parent: "event", polarity: "positive" },
  { key: "occasion_rushed", name: "The occasion felt rushed", parent: "event", polarity: "negative" },
  { key: "easy_to_start", name: "Easy to get started", parent: "ux", polarity: "positive" },
  { key: "confusing_flow", name: "Confusing to use", parent: "ux", polarity: "negative" },
  { key: "never_crashes", name: "Stays stable", parent: "reliability", polarity: "positive" },
  { key: "crashes_on_launch", name: "Crashes on launch", parent: "reliability", polarity: "negative" },
  { key: "crashes_mid_task", name: "Crashes during a task", parent: "reliability", polarity: "negative" },
  { key: "snappy", name: "Feels fast", parent: "performance", polarity: "positive" },
  { key: "laggy", name: "Feels laggy", parent: "performance", polarity: "negative" },
  { key: "loved_feature", name: "A feature people love", parent: "features", polarity: "positive" },
  { key: "missing_feature", name: "A missing feature", parent: "features", polarity: "negative" },
  { key: "fair_price", name: "Pricing feels fair", parent: "pricing", polarity: "positive" },
  { key: "paywall", name: "Paywall or surprise charge", parent: "pricing", polarity: "negative" },
  { key: "support_fast", name: "Support replied and fixed it", parent: "support", polarity: "positive" },
  { key: "support_silent", name: "Support never replied", parent: "support", polarity: "negative" },
  { key: "helpful_content", name: "Genuinely useful", parent: "content_quality", polarity: "positive" },
  { key: "poor_production", name: "Audio or picture quality", parent: "content_quality", polarity: "negative" },
  { key: "exact_topic", name: "Delivered the promised topic", parent: "topic_fit", polarity: "positive" },
  { key: "misleading_title", name: "Title did not match", parent: "topic_fit", polarity: "negative" },
  { key: "tight_edit", name: "Tight, well paced", parent: "pacing", polarity: "positive" },
  { key: "too_much_filler", name: "Too long or too much filler", parent: "pacing", polarity: "negative" },
  { key: "strong_hook", name: "Hooked quickly", parent: "hook", polarity: "positive" },
  { key: "slow_intro", name: "Took too long to start", parent: "hook", polarity: "negative" },
  { key: "clear_next_step", name: "Clear next step", parent: "cta_clarity", polarity: "positive" },
  { key: "unclear_ask", name: "Ask was confusing", parent: "cta_clarity", polarity: "negative" },
  { key: "creator_replies", name: "Creator replies", parent: "community", polarity: "positive" },
  { key: "hostile_comments", name: "Hostile comments", parent: "community", polarity: "negative" },
];

const specificByKey = new Map(SPECIFIC_ISSUES.map((issue) => [issue.key, issue]));

export function specificIssuesForKind(kind: WorkspaceKind): SpecificIssue[] {
  const parents = new Set(aspectsForKind(kind).map((aspect) => aspect.key));
  return SPECIFIC_ISSUES.filter((issue) => parents.has(issue.parent));
}

export function specificIssue(key: string): SpecificIssue | undefined {
  return specificByKey.get(key);
}

export function isSpecificIssue(key: string): boolean {
  return specificByKey.has(key);
}

export function aspectLabel(key: string): string {
  const specific = specificByKey.get(key);
  if (specific) return specific.name;
  const all = [...BUSINESS_ASPECTS, ...APP_ASPECTS, ...CREATOR_ASPECTS];
  return all.find((aspect) => aspect.key === key)?.name ?? key.replaceAll("_", " ");
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
        "Pick the single broad theme that most explains the verdict. Choose none when the verdict is unclear or the review is only a vague 'great place' / 'never again' with no topic.",
      criteria: primaryCriteria,
    },
    specific_issue: {
      type: "choice",
      instructions:
        "Pick the single most specific issue or strength actually written in the review. Choose none if the text is only vague praise or a vague complaint. Do not guess a finer issue than the words support.",
      criteria: {
        none: "No specific issue is stated",
        ...Object.fromEntries(
          specificIssuesForKind(kind).map((issue) => [issue.key, issue.name]),
        ),
      },
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
