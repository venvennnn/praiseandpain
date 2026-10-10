# Connector capability matrix

Verified against SerpApi documentation before implementation. Live calls require `SERPAPI_API_KEY`.

| Source | Discover engine | Feedback engine | Pagination | Chronological | Transcripts | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Google Maps | `google_maps` | `google_maps_reviews` | `next_page_token` | `sort_by=newestFirst` | No | First page ~8 reviews; `num` only with token |
| Apple App Store | `apple_app_store` | `apple_reviews` | `page` | `sort=mostrecent` | No | `product_id` from App Store URL / discovery |
| Google Play | `google_play` | `google_play_product` + `all_reviews=true` | `next_page_token` | `sort_by=2` (newest) | No | `store=apps` |
| YouTube | `youtube` | `youtube_video` comments | `comments_next_page_token` / sorting token via `next_page_token` | Newest sorting token when present | `youtube_video_transcript` when available | Metadata and comment pages are separate; reply pagination only within budget |
| CSV / JSON import | n/a | local upload | n/a | uses mapped dates | n/a | Mapping preview, 2MB / 5000 row limits, provenance, duplicate provider IDs |

Instagram/Facebook profile APIs are **not** treated as complete comment access and are not implemented.
