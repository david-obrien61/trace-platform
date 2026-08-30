# lawns-site-catalog-20260825.csv — provenance

**The live fetch was BLOCKED. This file is NOT a 2026-08-25 capture of the site.**

- `https://lawnstrees.com/wp-json/wc/store/products?per_page=100&page=1` returned
  **HTTP 403** — an nginx edge/host firewall HTML page, not a WooCommerce error.
  The request never reached WordPress. One request was made; no retries, no
  fallback to `/wp-json/wc/v3/` or the category pages (per instruction: on 403,
  stop, do not work around).
- Rows here are re-shaped from `~/Downloads/lawns_tree_catalog.csv`
  (site capture dated **2026-06-21**, 116 products, all `lawnstrees.com/product/` URLs).
- `price`, `size_options`, `stock_status` are **`NOT_FETCHED_403`**, never blank —
  a blank would read as "no price / no size / out of stock", which is a different
  claim than "not retrieved" (A9: absent is not empty).
- ⚠️ Capture holds **26** categories; David's brief says **28**. Two categories are
  unaccounted for — either empty on the site, added since June 21, or the capture
  is incomplete. Not resolvable without a successful fetch.

To complete: get the 403 lifted (allowlist, or Lauren pulls the export from
WP-Admin → WooCommerce → Products → Export), then re-fetch price/size/stock.
