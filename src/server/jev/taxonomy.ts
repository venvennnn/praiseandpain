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
    key: "food_quality",
    name: "Food quality",
    definition: "Taste, freshness, temperature, and preparation of food items.",
    examples: ["The pasta was cold and soggy", "Best burger in town"],
    counterExamples: [
      "cold beer (beverage temperature, not food)",
      "dry rub (intended seasoning style, not dried-out food)",
    ],
  },
  {
    key: "service",
    name: "Service",
    definition: "Staff attentiveness, friendliness, accuracy of orders.",
    examples: ["Waiter never checked on us", "Staff were welcoming"],
    counterExamples: ["long wait but worth it (wait is pace; praise may outweigh)"],
  },
  {
    key: "wait_time",
    name: "Wait time",
    definition: "Queue, seating, or order fulfillment delays.",
    examples: ["Waited 40 minutes for a table"],
    counterExamples: ["long wait but worth it (mixed; wait is negative aspect with overall praise)"],
  },
  {
    key: "cleanliness",
    name: "Cleanliness",
    definition: "Hygiene of premises, restrooms, tables, utensils.",
    examples: ["Sticky tables", "Spotless restrooms"],
    counterExamples: [],
  },
  {
    key: "value",
    name: "Value / price",
    definition: "Perceived worth relative to price paid.",
    examples: ["Overpriced for the portion", "Great bang for the buck"],
    counterExamples: [],
  },
  {
    key: "atmosphere",
    name: "Atmosphere",
    definition: "Ambience, noise, seating comfort, décor.",
    examples: ["Too loud to talk", "Cozy vibe"],
    counterExamples: [],
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

export const CLASSIFICATION_SCHEMA_VERSION = "feedback_aspects.v1";

export function buildClassificationQuestions(kind: WorkspaceKind) {
  const aspects = aspectsForKind(kind);
  const aspectCriteria: Record<string, string> = {
    none: "Does not clearly mention any defined aspect",
    uncertain: "Mentions something ambiguous that does not clearly match definitions",
  };
  for (const a of aspects) {
    aspectCriteria[a.key] = `${a.definition} Examples: ${a.examples.join("; ")}. Counter-examples: ${a.counterExamples.join("; ") || "n/a"}`;
  }

  return {
    is_praise: {
      type: "noul",
      instructions:
        "Does this feedback express clear praise or positive sentiment about the subject? Negation and sarcasm count as not praise.",
      criteria: {
        true: "Explicit positive evaluation",
        false: "No clear praise",
      },
    },
    is_complaint: {
      type: "noul",
      instructions:
        "Does this feedback express a clear complaint or negative evaluation? Mixed feedback can still contain a complaint.",
      criteria: {
        true: "Explicit complaint or pain point",
        false: "No clear complaint",
      },
    },
    is_request: {
      type: "noul",
      instructions: "Does the author request a change, feature, or action?",
    },
    is_question: {
      type: "noul",
      instructions: "Is the primary speech act a question seeking information?",
    },
    is_irrelevant: {
      type: "noul",
      instructions:
        "Is this spam, off-topic, or unrelated to the product/place/creator experience?",
    },
    primary_aspect: {
      type: "choice",
      instructions: {
        question:
          "Which single aspect definition best matches what the feedback is mainly about? Use none or uncertain when appropriate. Respect boundary cases like cold beer vs cold food, dry rub as style, and long wait but worth it as mixed.",
        aspect_definitions: aspects.map((a) => ({
          key: a.key,
          definition: a.definition,
          examples: a.examples,
          counterExamples: a.counterExamples,
        })),
      },
      criteria: aspectCriteria,
    },
    aspect_sentiment: {
      type: "choice",
      instructions:
        "For the primary aspect, is the sentiment positive, negative, mixed, or not_applicable?",
      criteria: {
        positive: "Aspect is praised",
        negative: "Aspect is criticised",
        mixed: "Both positive and negative about the aspect",
        not_applicable: "No aspect membership",
      },
    },
    severity: {
      type: "score",
      instructions:
        "If there is a complaint, how severe is the described problem for the customer experience?",
      criteria: ["No issue", "Minor annoyance", "Moderate problem", "Severe / deal-breaker"],
    },
    switching_intent: {
      type: "noul",
      instructions:
        "Does the author explicitly state intent to switch away, not return, or recommend competitors instead?",
    },
    evidence_sentence_id: {
      type: "choice",
      instructions: {
        question:
          "Which provided sentence id best supports the primary aspect judgment? Pick none if no sentence clearly supports it.",
        note: "Do not invent quotations; only choose among supplied sentence ids.",
      },
      criteria: {
        none: "No supporting sentence",
        // sentence ids injected per call
      },
    },
  };
}
