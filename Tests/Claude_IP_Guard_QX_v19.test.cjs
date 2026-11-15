"use strict";
/**
 * Mocked Quantumult X tests for v19 engine candidate.
 * No network calls or real proxy configuration changes.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const SCRIPT = fs.readFileSync(path.join(__dirname, "../Scripts/Claude/v19/Claude_IP_Guard_QX_v19_engine_candidate.js"), "utf8");

function run({tag, answers = {}, prefs = new Map(), saveOk = true}) {
  const requests = [];
  const outputs = [];
  const timers = new Map();
  let timerSeq = 0;
  const ctx = {
    Promise, Date, JSON, Number, String, Array, Math, Object, encodeURIComponent,
    $environment: {params: tag},
    $prefs: {
      valueForKey: key => prefs.has(key) ? prefs.get(key) : null,
      setValueForKey: (value, key) => { if (!saveOk) return false; prefs.set(key, value); return true; }
    },
    $task: {fetch: req => {
      requests.push(req);
      const key = new URL(req.url).hostname;
      const result = answers[key];
      if (!result) return Promise.reject(new Error("mock missing: " + key));
      if (result.reject) return Promise.reject(new Error(result.reject));
      return Promise.resolve({statusCode:result.status || 200, body:result.body});
    }},
    $done: result => outputs.push(result),
    setTimeout: cb => { const id=++timerSeq; timers.set(id,cb); return id; },
    clearTimeout: id => timers.delete(id)
  };
  vm.runInNewContext(SCRIPT,ctx,{timeout:1000});
  return new Promise((resolve,reject)=>{
    let steps=0;
    function flush() {
      if (outputs.length) return resolve({requests,output:outputs[0],prefs});
      if (++steps>30) return reject(new Error("script did not finish"));
      setImmediate(flush);
    }
    flush();
  });
}
function mocks(a="38.113.126.217",b=a,geoIp=a) {
  return {
    "api.ipify.org":{body:JSON.stringify({ip:a})},
    "ipv4.icanhazip.com":{body:b+"\n"},
    "ipwho.is":{body:JSON.stringify({success:true,ip:geoIp,country:"United States",region:"California",city:"Los Angeles",connection:{asn:1234,org:"Example ISP"}})}
  };
}
(async()=>{
  // A missing node parameter must never start a network request.
  let x=await run({tag:"",answers:mocks()});
  assert.equal(x.requests.length,0);
  assert.match(x.output.htmlMessage,/未收到节点标签/);

  // Two matching echo providers save history under selected-node key.
  const prefs=new Map();
  x=await run({tag:"US-LA",answers:mocks(),prefs});
  assert.equal(x.requests.length,3);
  assert.ok(x.requests.every(r=>r.opts.policy==="US-LA"));
  assert.match(x.output.htmlMessage,/38\.113\.126\.217/);
  assert.match(x.output.htmlMessage,/双来源一致/);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.US-LA")).count,1);

  // Switching node must not inherit previous node's IP or history.
  const y=await run({tag:"JP-01",answers:mocks("123.100.137.213"),prefs});
  assert.ok(y.requests.every(r=>r.opts.policy==="JP-01"));
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.JP-01")).count,1);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.US-LA")).count,1);

  // A mismatch is fail-closed: no geo request and no history write.
  x=await run({tag:"MISMATCH",answers:mocks("1.1.1.1","8.8.8.8"),prefs});
  assert.equal(x.requests.length,2);
  assert.match(x.output.htmlMessage,/双来源未确认/);
  assert.equal(prefs.has("ClaudeIPGuard.v19.history.MISMATCH"),false);

  // Invalid IPv4 cannot enter the history.
  x=await run({tag:"INVALID",answers:mocks("999.1.1.1","999.1.1.1"),prefs});
  assert.equal(x.requests.length,2);
  assert.equal(prefs.has("ClaudeIPGuard.v19.history.INVALID"),false);

  // Geo response for another IP is rejected, but exit history remains valid.
  x=await run({tag:"GEO-MISMATCH",answers:mocks("1.1.1.1","1.1.1.1","8.8.8.8"),prefs});
  assert.match(x.output.htmlMessage,/归属查询结果未匹配目标 IP/);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.GEO-MISMATCH")).count,1);

  // HTTP 429 must show an unavailable source, never zero risk.
  const limited=mocks("1.1.1.1");
  limited["ipwho.is"]={status:429,body:"rate limited"};
  x=await run({tag:"RATE-LIMIT",answers:limited,prefs});
  assert.match(x.output.htmlMessage,/HTTP 429/);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.RATE-LIMIT")).count,1);

  // Failed local persistence must not be reported as saved.
  x=await run({tag:"SAVE-FAIL",answers:mocks(),saveOk:false});
  assert.match(x.output.htmlMessage,/本地写入未确认/);

  console.log("PASS: 7 mocked Quantumult X engine scenarios");
})().catch(e=>{console.error(e);process.exitCode=1;});
