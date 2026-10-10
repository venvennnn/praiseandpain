import { z } from "zod";
import { OnboardingSchema } from "./domain";

export const OnboardingInputSchema = OnboardingSchema;
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;
