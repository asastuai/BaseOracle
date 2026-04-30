/**
 * Smoke tests for BaseOracle endpoints.
 * Boots the express app in-process and hits free endpoints.
 *
 * Run with: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// Set env BEFORE any dynamic import that triggers config.js validation.
process.env.PRIVATE_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
process.env.PAY_TO_ADDRESS = "0x0000000000000000000000000000000000000001";
process.env.X402_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402";
process.env.USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
process.env.PORT = "0";
process.env.POC_SIGNING_KEY =
  "2222222222222222222222222222222222222222222222222222222222222222";
process.env.POC_SOURCE_ID = "baseoracle:smoketest";

// Dynamic imports to ensure env is set first (ESM hoists static imports above).
const { default: express } = await import("express");
const { default: apiRoutes } = await import("../src/routes/api.js");

const app = express();
app.use(express.json());
app.use(apiRoutes);

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(() => {
  if (server) server.close();
});

test("GET /api/v1/info returns service metadata", async () => {
  const res = await fetch(`${baseUrl}/api/v1/info`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, "BaseOracle");
  assert.ok(Array.isArray(body.endpoints), "endpoints array present");
  assert.ok(body.endpoints.length > 0, "endpoints listed");
});

test("GET /api/v1/health returns ok status", async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.ok(body.timestamp, "timestamp present");
});

test("GET /api/v1/metrics returns metrics object", async () => {
  const res = await fetch(`${baseUrl}/api/v1/metrics`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.cache !== undefined, "cache stats present");
});

test("GET /api/v1/poc/public-key returns operator public key", async () => {
  const res = await fetch(`${baseUrl}/api/v1/poc/public-key`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.public_key, "public key present");
  assert.equal(body.public_key.length, 64, "public key is 32 bytes hex");
  assert.equal(body.source_id, "baseoracle:smoketest");
  assert.equal(body.primitive, "Proof-of-Context (Aletheia)");
  assert.deepEqual(body.freshness_types_emitted, ["f_i"]);
});

test("GET /api/v1/agents returns agent list (free)", async () => {
  const res = await fetch(`${baseUrl}/api/v1/agents`);
  assert.equal(res.status, 200);
});
