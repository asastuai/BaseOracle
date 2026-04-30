/**
 * Tests for the triple-anchor real-fetch module.
 *
 * Without POC_ENABLE_TRIPLE_ANCHOR, anchors.block_height and anchors.drand_round
 * MUST be null (the honest fallback). With it set, the module attempts the
 * fetches and caches the results.
 *
 * The "fetch succeeded" path is exercised in a live integration test
 * (skipped by default) at the bottom; CI runs the default-disabled path
 * which is fast and deterministic.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

test("buildAnchors returns nulls when POC_ENABLE_TRIPLE_ANCHOR is unset", async () => {
  // Ensure unset.
  delete process.env.POC_ENABLE_TRIPLE_ANCHOR;
  const { buildAnchors, _internals } = await import(
    "../src/utils/poc-anchors.js?nocache=" + Date.now()
  );
  _internals.resetCaches();

  const anchors = await buildAnchors();
  assert.equal(anchors.block_height, null);
  assert.equal(anchors.drand_round, null);
  assert.ok(anchors.server_timestamp, "server_timestamp present");
  assert.equal(_internals.isEnabled(), false);
});

// Live test, opt-in. To run:
//   POC_ENABLE_TRIPLE_ANCHOR=1 node --test test/anchors.test.js
test("buildAnchors fetches real anchors when enabled (live, opt-in)", { skip: process.env.POC_ENABLE_TRIPLE_ANCHOR !== "1" }, async () => {
  const { buildAnchors, _internals } = await import(
    "../src/utils/poc-anchors.js?nocache=" + Date.now()
  );
  _internals.resetCaches();

  const anchors = await buildAnchors();
  assert.ok(anchors.server_timestamp);
  assert.ok(
    typeof anchors.drand_round === "number" && anchors.drand_round > 5_000_000,
    `drand round implausible: ${anchors.drand_round}`
  );
  assert.ok(
    typeof anchors.block_height === "number" && anchors.block_height > 10_000_000,
    `block height implausible: ${anchors.block_height}`
  );
});
