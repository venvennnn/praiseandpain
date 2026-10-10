import { serve } from "inngest/next";
import { inngest } from "@/server/jobs/inngest";
import { inngestFunctions } from "@/server/jobs/pipeline";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
