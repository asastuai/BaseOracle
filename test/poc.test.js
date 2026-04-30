/**
 * Tests for the Proof-of-Context attestation primitive.
 * Run with: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// Set test signing key BEFORE importing poc.js so the module-level config picks it up.
process.env.POC_SIGNING_KEY =
  "1111111111111111111111111111111111111111111111111111111111111111";
process.env.POC_SOURCE_ID = "baseoracle:test";

const { attest, verify, getPublicKey } = await import("../src/utils/poc.js");

test("attest wraps payload with _poc block", async () => {
  const payload = { token: "ETH", price_usd: 2500.0 };
  const result = await attest(payload, {
    endpoint: "/api/v1/prices",
    freshnessHorizonSeconds: 30,
  });

  assert.equal(result.token, "ETH", "original payload field preserved");
  assert.ok(result._poc, "_poc block present");
  assert.equal(result._poc.freshness_type, "f_i");
  assert.equal(result._poc.endpoint, "/api/v1/prices");
  assert.equal(result._poc.freshness_horizon_seconds, 30);
  assert.equal(result._poc.source_id, "baseoracle:test");
  assert.ok(result._poc.signature, "signature present");
  assert.ok(result._poc.public_key, "public key present");
  assert.ok(result._poc.payload_hash, "payload hash present");
  assert.equal(result._poc.version, "0.1");
});

test("verify accepts a fresh, well-signed attestation", async () => {
  const payload = { token: "BTC", price_usd: 67000 };
  const attested = await attest(payload, {
    endpoint: "/api/v1/prices",
    freshnessHorizonSeconds: 60,
  });

  const result = await verify(attested);
  assert.equal(result.valid, true, `should be valid, got: ${result.reason}`);
  assert.equal(result.reason, "ok");
});

test("verify rejects when payload is mutated", async () => {
  const payload = { token: "ETH", price_usd: 2500 };
  const attested = await attest(payload, {
    endpoint: "/api/v1/prices",
    freshnessHorizonSeconds: 60,
  });

  // Tamper.
  attested.price_usd = 9999;

  const result = await verify(attested);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "payload_hash_mismatch");
});

test("verify rejects when attestation is past horizon", async () => {
  const payload = { token: "ETH" };
  const attested = await attest(payload, {
    endpoint: "/api/v1/prices",
    freshnessHorizonSeconds: 1, // 1 second horizon
  });

  // Wait long enough to exceed horizon.
  await new Promise((r) => setTimeout(r, 1500));

  const result = await verify(attested);
  assert.equal(result.valid, false);
  assert.match(result.reason, /^stale:/);
});

test("verify rejects when signature is missing", async () => {
  const fake = {
    token: "ETH",
    _poc: {
      freshness_type: "f_i",
      payload_hash: "deadbeef",
      timestamp: new Date().toISOString(),
      freshness_horizon_seconds: 60,
      signature: null,
    },
  };
  const result = await verify(fake);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "no_signature");
});

test("verify rejects when _poc block is missing", async () => {
  const result = await verify({ token: "ETH" });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_poc_block");
});

test("getPublicKey returns hex when signing key is configured", async () => {
  const pk = await getPublicKey();
  assert.ok(pk, "public key returned");
  assert.equal(pk.length, 64, "public key is 32 bytes hex");
  assert.match(pk, /^[0-9a-f]{64}$/);
});

test("attest emits scope_disclaimer for honest framing", async () => {
  const attested = await attest({ x: 1 }, { endpoint: "/test", freshnessHorizonSeconds: 10 });
  assert.ok(
    attested._poc.scope_disclaimer,
    "scope_disclaimer present"
  );
  assert.match(attested._poc.scope_disclaimer, /Operator vouches/);
});
