import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "praise-and-pain",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export const events = {
  syncRequested: "pipeline/sync.requested",
  scheduleTick: "pipeline/schedule.tick",
} as const;
