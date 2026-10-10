import type { SourceType } from "@/shared/schemas/domain";
import type { ConnectorAdapter } from "./types";
import { googleMapsConnector } from "./google-maps";
import { appleAppStoreConnector } from "./apple-app-store";
import { googlePlayConnector } from "./google-play";
import { youtubeConnector } from "./youtube";
import { serpApiConfigured } from "./serpapi";

const adapters: Partial<Record<SourceType, ConnectorAdapter>> = {
  google_maps: googleMapsConnector,
  apple_app_store: appleAppStoreConnector,
  google_play: googlePlayConnector,
  youtube: youtubeConnector,
};

export function getConnector(source: SourceType): ConnectorAdapter {
  const adapter = adapters[source];
  if (!adapter) {
    throw new Error(`No live connector for source ${source}. Use CSV/JSON import.`);
  }
  return adapter;
}

export function connectorCapabilityMatrix() {
  return Object.values(adapters).map((a) => ({
    source: a!.source,
    ...a!.capabilities,
    liveEnabled: serpApiConfigured(),
  }));
}

export { serpApiConfigured } from "./serpapi";
export type { ConnectorAdapter, DiscoveredEntity, FetchPageResult } from "./types";
