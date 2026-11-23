"use strict";
/**
 * Mocked Quantumult X tests for v19 engine candidate.
 * No network calls or real proxy configuration changes.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const SCRIPT = fs.readFileSync(path.join(__dirname, "../Scripts/Claude/Claude_IP_Guard_QX_v19.js"), "utf8");

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
    "checkip.amazonaws.com":{body:a+"\n"},
    "my.ippure.com":{body:JSON.stringify({ip:a,fraudScore:5})},
    "api.ipapi.is":{body:JSON.stringify({ip:a,company:{abuser_score:"3% (low)"}})},
    "www.ip2location.io":{body:a+' Usage Type</label><p>ISP Fraud Score</label><p>0'},
    "scamalytics.com":{body:a+' Fraud Score: 0'},
    "ipapi.co":{body:JSON.stringify({ip:geoIp,country_name:"United States",region:"California",city:"Los Angeles",asn:"AS1234",org:"Backup ISP"})},
    "ipwho.is":{body:JSON.stringify({success:true,ip:geoIp,country:"United States",region:"California",city:"Los Angeles",connection:{asn:1234,org:"Example ISP"}})}
  };
}
(async()=>{
  // A missing node parameter must never start a network request.
  let x=await run({tag:"",answers:mocks()});
  assert.equal(x.requests.length,0);
  assert.match(x.output.message,/请长按具体节点启动/);

  // Two matching echo providers save history under selected-node key.
  const prefs=new Map();
  x=await run({tag:"US-LA",answers:mocks(),prefs});
  assert.equal(x.requests.length,7);
  assert.ok(x.requests.every(r=>r.opts.policy==="US-LA"));
  assert.match(x.output.message,/38\.113\.126\.217/);
  assert.match(x.output.message,/双源：一致/);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.US-LA")).count,1);

  // Switching node must not inherit previous node's IP or history.
  const y=await run({tag:"JP-01",answers:mocks("123.100.137.213"),prefs});
  assert.ok(y.requests.every(r=>r.opts.policy==="JP-01"));
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.JP-01")).count,1);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.US-LA")).count,1);

  // A mismatch is fail-closed: no geo request and no history write.
  x=await run({tag:"MISMATCH",answers:mocks("1.1.1.1","8.8.8.8"),prefs});
  assert.equal(x.requests.length,3);
  assert.ok(x.requests.some(r=>new URL(r.url).hostname==="checkip.amazonaws.com"));
  assert.match(x.output.message,/双源：不一致或检测失败/);
  assert.match(x.output.message,/第三源：1\.1\.1\.1/);
  assert.equal(prefs.has("ClaudeIPGuard.v19.history.MISMATCH"),false);

  // Invalid IPv4 cannot enter the history.
  x=await run({tag:"INVALID",answers:mocks("999.1.1.1","999.1.1.1"),prefs});
  assert.equal(x.requests.length,3);
  assert.equal(prefs.has("ClaudeIPGuard.v19.history.INVALID"),false);

  // Geo response for another IP is rejected, but exit history remains valid.
  x=await run({tag:"GEO-MISMATCH",answers:mocks("1.1.1.1","1.1.1.1","8.8.8.8"),prefs});
  assert.match(x.output.message,/归属：未知/);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.GEO-MISMATCH")).count,1);

  // HTTP 429 must show an unavailable source, never zero risk.
  const limited=mocks("1.1.1.1");
  limited["ipwho.is"]={status:429,body:"rate limited"};
  x=await run({tag:"RATE-LIMIT",answers:limited,prefs});
  assert.match(x.output.message,/信誉数据：/);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.RATE-LIMIT")).count,1);

  // Primary geo HTTP 429 triggers a backup query through the SAME node.
  const backup=mocks("1.1.1.1");
  backup["ipwho.is"]={status:429,body:"rate limited"};
  x=await run({tag:"GEO-BACKUP",answers:backup,prefs});
  assert.equal(x.requests.length,4); // Reputation data for this IP was cached by earlier cases.
  assert.ok(x.requests.every(r=>r.opts.policy==="GEO-BACKUP"));
  assert.match(x.output.message,/备用来源/);
  assert.match(x.output.message,/信誉数据：/);

  // Backup's IP mismatch is rejected; no fabricated geo.
  const invalidBackup=mocks("1.1.1.1");
  invalidBackup["ipwho.is"]={status:403,body:"forbidden"};
  invalidBackup["ipapi.co"]={body:JSON.stringify({ip:"8.8.8.8",country_name:"US"})};
  x=await run({tag:"GEO-BAD-BACKUP",answers:invalidBackup,prefs});
  assert.match(x.output.message,/归属：未知/);
  assert.equal(JSON.parse(prefs.get("ClaudeIPGuard.v19.history.GEO-BAD-BACKUP")).count,1);

  // Per-provider success caches persist independently of a failing provider.
  const cachePrefs=new Map();
  const first=mocks("1.1.1.1");
  first["api.ipapi.is"]={status:429,body:"rate limited"};
  x=await run({tag:"CACHE",answers:first,prefs:cachePrefs});
  assert.equal(x.requests.length,7);
  assert.match(x.output.message,/信誉数据：/);
  assert.equal(JSON.parse(cachePrefs.get("ClaudeIPGuard.v19.rep.1.1.1.1.ippure")).item.status,"ok");
  assert.equal(JSON.parse(cachePrefs.get("ClaudeIPGuard.v19.rep.1.1.1.1.ipapi")).item.status,"unavailable");
  const second=await run({tag:"CACHE",answers:first,prefs:cachePrefs});
  assert.equal(second.requests.length,3);
  assert.match(second.output.message,/信誉数据：/);

  // Missing provider IP must not be treated as a valid score.
  const missingIp=mocks("1.1.1.1");
  missingIp["my.ippure.com"]={body:JSON.stringify({fraudScore:0})};
  x=await run({tag:"BAD-PROVIDER",answers:missingIp});
  assert.match(x.output.message,/信誉数据：/);

  // Import legacy v17/v18 history without altering its original key.
  const legacyPrefs=new Map();
  const oldKey="ClaudeIPGuard.v17.history.LEGACY";
  const oldValue=JSON.stringify({version:1,count:5,changes:2,
    last:{ip:"1.1.1.1",at:"2026-11-01T00:00:00.000Z"},
    records:[{ip:"1.1.1.1",at:"2026-11-01T00:00:00.000Z"}]});
  legacyPrefs.set(oldKey,oldValue);
  x=await run({tag:"LEGACY",answers:mocks("1.1.1.1"),prefs:legacyPrefs});
  assert.equal(JSON.parse(legacyPrefs.get("ClaudeIPGuard.v19.history.LEGACY")).count,6);
  assert.equal(legacyPrefs.get(oldKey),oldValue);
  assert.match(x.output.message,/历史：已保存/);

  // Existing v19 state always wins over older history.
  x=await run({tag:"LEGACY",answers:mocks("1.1.1.1"),prefs:legacyPrefs});
  assert.equal(JSON.parse(legacyPrefs.get("ClaudeIPGuard.v19.history.LEGACY")).count,7);
  assert.equal(legacyPrefs.get(oldKey),oldValue);

  // A malformed legacy entry is never silently used as a valid exit IP.
  const malformedPrefs=new Map([["ClaudeIPGuard.v17.history.BAD",JSON.stringify({
    version:1,count:10,changes:3,last:{ip:"999.1.1.1",at:"bad"},records:[]
  })]]);
  x=await run({tag:"BAD",answers:mocks("1.1.1.1"),prefs:malformedPrefs});
  assert.equal(JSON.parse(malformedPrefs.get("ClaudeIPGuard.v19.history.BAD")).count,1);
  assert.match(x.output.message,/历史：已保存/);

  // Reputation coverage must not be represented as a Claude ban-risk score.
  x=await run({tag:"RISK-LABEL",answers:mocks("1.1.1.1")});
  assert.match(x.output.message,/信誉数据：4\/4 家可用/);
  assert.match(x.output.message,/信誉数据≠Claude封号风险/);
  assert.doesNotMatch(x.output.message,/安全评分|封号概率/);

  // Native dialog must not contain HTML or unbounded report sections.
  x=await run({tag:"COMPACT",answers:mocks("1.1.1.1")});
  assert.ok(x.output.message.length < 500);
  assert.equal(x.output.htmlMessage,undefined);
  assert.doesNotMatch(x.output.message,/最近采样|检测说明|<html>/);

  // Untrusted node labels and network errors must not create a huge native dialog.
  const hugeTag="US-LA-"+("X".repeat(1200));
  x=await run({tag:hugeTag,answers:mocks("1.1.1.1")});
  assert.ok(x.output.message.length<400);
  assert.match(x.output.message,/节点：US-LA-/);

  const failedEcho=mocks("1.1.1.1");
  failedEcho["api.ipify.org"]={reject:"network "+("E".repeat(1500))};
  failedEcho["ipv4.icanhazip.com"]={reject:"network "+("F".repeat(1500))};
  x=await run({tag:"ERROR-LENGTH",answers:failedEcho});
  assert.ok(x.output.message.length<450);
  assert.match(x.output.message,/双源：不一致或检测失败/);

  // Failed local persistence must not be reported as saved.
  x=await run({tag:"SAVE-FAIL",answers:mocks(),saveOk:false});
  assert.match(x.output.message,/历史：保存失败/);

  console.log("PASS: compact native QX regression scenarios");
})().catch(e=>{console.error(e);process.exitCode=1;});
