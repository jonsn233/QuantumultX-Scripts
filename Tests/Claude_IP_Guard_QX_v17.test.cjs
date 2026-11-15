const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "../Scripts/Claude/Claude_IP_Guard_QX_v17.js"), "utf8");

async function runCase(name, params, responder) {
  const requests = [];
  const logs = [];
  const store = Object.create(null);
  let doneResult;
  let doneCount = 0;
  let finish;
  const completed = new Promise(resolve => { finish = resolve; });

  const context = {
    console: { log: value => logs.push(String(value)) },
    setTimeout,
    clearTimeout,
    Date,
    Promise,
    JSON,
    encodeURIComponent,
    $environment: params === undefined ? {} : { params },
    $task: {
      fetch: request => {
        requests.push(request);
        return responder(request);
      }
    },
    $prefs: {
      valueForKey: key => store[key] || null,
      setValueForKey: (value, key) => { store[key] = value; return true; }
    },
    $done: result => {
      doneCount += 1;
      doneResult = result;
      finish();
    }
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: "Claude_IP_Guard_QX_v17.js" });
  await Promise.race([
    completed,
    new Promise((_, reject) => setTimeout(() => reject(new Error(name + " timed out")), 2000))
  ]);

  assert.equal(doneCount, 1, name + ": $done must be called exactly once");
  for (const request of requests) {
    assert.equal(request.method, "GET");
    assert.equal(request.opts.policy, params, name + ": every request must use selected node");
    assert.equal(request.opts["skip-cert-verify"], false);
    assert.equal(request.opts["auto-cookie"], false);
    assert.deepEqual(Object.keys(request.headers), ["Accept"]);
    assert.equal(request.body, undefined);
  }
  return { requests, logs, store, result: doneResult };
}

(async () => {
  const success = await runCase("two sources agree", "Node-JP-01", request => {
    if (request.url.includes("api.ipify.org")) {
      return Promise.resolve({ statusCode: 200, body: '{"ip":"203.0.113.10"}' });
    }
    if (request.url.includes("icanhazip.com")) {
      return Promise.resolve({ statusCode: 200, body: "203.0.113.10\n" });
    }
    if (request.url.includes("ipwho.is")) {
      return Promise.resolve({
        statusCode: 200,
        body: JSON.stringify({
          success: true, ip: "203.0.113.10", country: "Example", country_code: "EX",
          region: "Region", city: "City", type: "hosting",
          connection: { asn: 64500, org: "Example Org", isp: "Example ISP" }
        })
      });
    }
    throw new Error("Unexpected URL: " + request.url);
  });
  assert.equal(success.requests.length, 3);
  assert.ok(success.result.htmlMessage.includes("Node-JP-01"));
  assert.ok(success.result.htmlMessage.includes("203.0.113.10"));
  assert.ok(success.result.htmlMessage.includes("双源一致"));
  assert.equal(Object.keys(success.store).length, 1);
  console.log("PASS two sources agree; all three requests use selected node");

  const mismatch = await runCase("sources disagree", "Node-US-02", request => {
    if (request.url.includes("api.ipify.org")) {
      return Promise.resolve({ statusCode: 200, body: '{"ip":"203.0.113.11"}' });
    }
    if (request.url.includes("icanhazip.com")) {
      return Promise.resolve({ statusCode: 200, body: "203.0.113.12" });
    }
    throw new Error("Enrichment must not run on mismatch");
  });
  assert.equal(mismatch.requests.length, 2);
  assert.equal(Object.keys(mismatch.store).length, 0);
  assert.ok(mismatch.result.htmlMessage.includes("无法确认"));
  console.log("PASS mismatch; no enrichment and no history write");

  const missing = await runCase("missing params", undefined, () => {
    throw new Error("No network request should be made");
  });
  assert.equal(missing.requests.length, 0);
  assert.ok(String(missing.result.message).includes("没有收到有效的节点标签"));
  console.log("PASS missing UIAction params; fail closed without network");

  assert.ok(!source.includes('var POLICY="AI-Claude"'));
  assert.ok(!source.includes('policy: "AI-Claude"'));
  assert.ok(!/\$notify|\$configuration/.test(source));
  console.log("PASS no hard-coded AI-Claude route, notification or config mutation API");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
