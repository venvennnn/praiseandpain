import { z } from "zod";

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";

export class JevConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevConfigError";
  }
}

export function jevConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export function requireJevKey(): string {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) {
    throw new JevConfigError(
      "TYPESAFE_API_KEY is not configured. Classification is paused until a TypeSafe/Jev key is provided.",
    );
  }
  return key;
}

const ChoiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.number()),
  confidence: z.number().optional(),
});

const NoulAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: z.number(),
});

const ScoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z.number(),
  legend: z.record(z.string()),
  probabilities: z.record(z.number()),
  confidence: z.number().optional(),
});

export const JevResponseSchema = z.object({
  model: z.string(),
  answers: z.record(z.union([ChoiceAnswerSchema, NoulAnswerSchema, ScoreAnswerSchema])),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
    })
    .optional(),
});

export type JevResponse = z.infer<typeof JevResponseSchema>;

export async function jevDecide(params: {
  state: unknown;
  questions: Record<string, unknown>;
  model?: string;
}): Promise<JevResponse> {
  const key = requireJevKey();
  const model = params.model ?? process.env.TYPESAFE_MODEL ?? "jev-latest";

  const res = await fetch(TYPESAFE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      state: params.state,
      questions: params.questions,
    }),
  });

  if (res.status === 401) {
    throw new JevConfigError("TypeSafe API key is invalid.");
  }
  if (res.status === 429 || res.status === 529) {
    throw new Error(`TypeSafe rate limited (${res.status})`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TypeSafe error ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = await res.json();
  return JevResponseSchema.parse(json);
}
