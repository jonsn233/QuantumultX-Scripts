const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '../Scripts/Claude/Claude_IP_Audit_v1.2.js'),'utf8');
const secret = 'PRIVATE_TOKEN_COOKIE_AUTHORIZATION_SENTINEL';
const response = (body, statusCode=200, headers={'Content-Type':'application/json'}) => ({body,statusCode,headers});
async function run(name, factory, expected, fastTimeout=false) {
  const logs=[], requests=[];
  let doneCount=0, finish;
  const completed = new Promise(r=>finish=r);
  const context = {
    console:{log:x=>logs.push(String(x))},
    setTimeout:(f,ms)=>setTimeout(f,fastTimeout?5:ms), clearTimeout,
    $task:{fetch: req=>{requests.push(req); return factory(req);}},
    $done:()=>{doneCount++;finish();}
  };
  vm.createContext(context);
  vm.runInContext(source,context);
  let guard;
  await Promise.race([completed,new Promise((_,reject)=>{guard=setTimeout(()=>reject(Error(name+' hung')),1000);})]);
  clearTimeout(guard);
  assert.equal(doneCount,1,name);
  const text=logs.join('\n');
  for (const item of expected) assert.ok(text.includes(item),name+': missing '+item+'\n'+text);
  assert.ok(!text.includes(secret),name+': leaked secret');
  for (const req of requests) {
    assert.equal(req.method,'GET');
    assert.deepEqual(Object.keys(req.headers),['Accept']);
    assert.equal(req.opts['auto-cookie'],false);
    assert.equal(req.opts['skip-cert-verify'],false);
    assert.equal(req.opts.policy,undefined);
    assert.equal(req.body,undefined);
  }
  console.log('PASS '+name);
  return {context,requests,text};
}
(async()=>{
const success=await run('dual stack + BOM + enrichment',req=>Promise.resolve(req.url.includes('ipwho.is')?response(JSON.stringify({success:true,ip:req.url.split('/').pop(),connection:{asn:64500}})):response('\uFEFF '+JSON.stringify({ip:req.url.includes('api6.')?'2001:db8::1':'192.0.2.1'}))),['Address: 192.0.2.1','Address: 2001:db8::1','HTTP=200','contentType=application/json','bodyType=string','[Cross-family comparison]']);
assert.equal(success.requests.length,4);
for (const ip of ['::','::1','2001:db8::1','1:2:3:4:5:6:7:8','::ffff:192.0.2.1']) assert.ok(success.context.isIPv6(ip),ip);
for (const ip of [':','1:2:3:4:5:6:7:8::','1::2::3','2001:db8:::1','1:2:3','192.0.2.1','::ffff:999.0.0.1']) assert.ok(!success.context.isIPv6(ip),ip);
await run('HTTP error takes priority over body',()=>Promise.resolve(response(secret,403,{'content-type':'text/html','Set-Cookie':secret})),['HTTP_ERROR: status 403','contentType=text/html']);
for (const body of ['', ' \n\t','\uFEFF ',undefined,null]) await run('empty '+String(body),()=>Promise.resolve(response(body)),['EMPTY_RESPONSE']);
await run('HTML not JSON',()=>Promise.resolve(response('<html>'+secret+'</html>',200,{'Content-Type':'text/html'})),['JSON_ERROR: invalid JSON and not a whole IP literal','syntax invalid']);
await run('malformed JSON',()=>Promise.resolve(response('{"token":"'+secret+'",}')),['JSON_ERROR']);
await run('non-text body',()=>Promise.resolve(response({token:secret})),['RESPONSE_TYPE_ERROR','bodyType=object']);
await run('missing HTTP status',()=>Promise.resolve({body:'{}'}),['RESPONSE_ERROR','HTTP=unknown']);
await run('missing ip field',()=>Promise.resolve(response('{}')),['JSON_SCHEMA_ERROR']);
await run('wrong address family',()=>Promise.resolve(response('{"ip":"2001:db8::1"}')),['IP_FAMILY_ERROR']);
await run('network rejection redacted',()=>Promise.reject({error:secret,Authorization:secret}),['NETWORK_ERROR']);
await run('synchronous fetch failure redacted',()=>{throw Error(secret)},['NETWORK_ERROR']);
await run('deadline',()=>new Promise(()=>{}),['NETWORK_TIMEOUT'],true);
await run('lookup provider error redacted',req=>Promise.resolve(response(req.url.includes('ipwho.is')?JSON.stringify({success:false,message:secret}):JSON.stringify({ip:req.url.includes('api6.')?'::1':'192.0.2.1'}))),['LOOKUP_ERROR']);
// Reproduce the observed response shape, not the user's actual address.
const partial=await run('15-char text IPv4 + IPv6 network failure + lookup',req=>{
  if (req.url.includes('api6.')) return Promise.reject({error:secret});
  if (req.url.includes('ipwho.is')) return Promise.resolve(response(JSON.stringify({success:true,connection:{asn:64500}})));
  return Promise.resolve(response('192.168.100.100',200,{'Content-Type':'text/plain','Set-Cookie':secret}));
},['bodyLength(chars)=15','contentType=text/plain','[IPv4] IP format=text validated','Address: 192.168.100.100','NETWORK_ERROR','ASN: 64500']);
assert.equal(partial.requests.length,3);
assert.ok(partial.requests.some(r=>r.url==='https://ipwho.is/192.168.100.100'));
assert.ok(!partial.text.includes('JSON_ERROR'));
const plain=await run('both families plain text with whitespace and BOM',req=>Promise.resolve(req.url.includes('ipwho.is')?response('{"success":true}'):response(req.url.includes('api6.')?' \uFEFF2001:db8::1\r\n':'\uFEFF 192.0.2.1\n',200,{'Content-Type':'text/plain'})),['[IPv4] IP format=text validated','[IPv6] IP format=text validated','[Cross-family comparison]']);
assert.equal(plain.requests.length,4);
assert.ok(!plain.text.includes('JSON_ERROR'));
await run('JSON accepted despite text MIME',req=>Promise.resolve(response(req.url.includes('ipwho.is')?'{"success":true}':JSON.stringify({ip:req.url.includes('api6.')?'::1':'192.0.2.1'}),200,{'Content-Type':'text/plain'})),['[IPv4] IP format=json validated','[IPv6] IP format=json validated']);
const http=await run('HTTP 500 IP-looking body must not succeed',()=>Promise.resolve(response('192.0.2.1',500)),['HTTP_ERROR: status 500']);
assert.equal(http.requests.length,2);
assert.ok(!http.text.includes('IP format='));
await run('JSON HTTP error envelope',()=>Promise.resolve(response('{"error":"'+secret+'"}',429)),['HTTP_ERROR: status 429']);
// Test parsing directly, using Node's independent IP implementation as oracle.
const net=require('node:net');
const valid4=['0.0.0.0','192.0.2.1','255.255.255.255'];
const valid6=['::','::1','2001:db8::1','1:2:3:4:5:6:7:8','::ffff:192.0.2.1','1:2:3:4:5:6:192.0.2.1'];
for(const [family,ips] of [['IPv4',valid4],['IPv6',valid6]]) {
  for(const ip of ips) {
    assert.equal(net.isIP(ip),family==='IPv4'?4:6);
    for(const body of [ip,'\uFEFF '+ip+'\r\n',JSON.stringify({ip})]) assert.equal(success.context.parsePublicIP(body,family),ip);
    assert.throws(()=>success.context.parsePublicIP(ip,family==='IPv4'?'IPv6':'IPv4'),/IP_FAMILY_ERROR/);
  }
}
const invalid=['256.0.0.1','01.2.3.4','1.2.3','1.2.3.4.5','1\n.2.3.4','1.2.3.4:80','0xc0000201','3221225985','1e3','192.0.2.1/24','[::1]','fe80::1%en0','1::2::3','1:2:3:4:5:6:7:8::','::ffff:999.0.0.1','2001:db8:::1','::ffff:192.0.2.1:1'];
for(const ip of invalid) {
  // Node permits scoped IPv6; endpoint responses must be unscoped literals.
  if (!ip.includes('%')) assert.equal(net.isIP(ip),0,ip);
  for(const family of ['IPv4','IPv6']) assert.throws(()=>success.context.parsePublicIP(ip,family),/JSON_ERROR|JSON_SCHEMA_ERROR|IP_FAMILY_ERROR/,ip);
}
for(const body of ['<html>192.0.2.1</html>','Error: 192.0.2.1','192.0.2.1 '+secret,'192.0.2.1\n192.0.2.2','{"ip":"192.0.2.1",}','{"error":"192.0.2.1"}','"192.0.2.1"','["192.0.2.1"]','null','true','{}']) {
  for(const family of ['IPv4','IPv6']) assert.throws(()=>success.context.parsePublicIP(body,family),/JSON_ERROR|JSON_SCHEMA_ERROR/);
}
// Lookup must remain JSON-only; text fallback applies to IP detection only.
await run('lookup text IP rejected',req=>Promise.resolve(response(req.url.includes('ipwho.is')?'192.0.2.1':JSON.stringify({ip:req.url.includes('api6.')?'::1':'192.0.2.1'}))),['Lookup failed: Error: JSON_ERROR']);
console.log('PASS strict parser tables / JSON priority / whole-body-only fallback / family checks');
assert.ok(!/\$notify|\$prefs|\$configuration|cron/i.test(source));
console.log('PASS manual-only / no notification, storage, routing or config mutation API');
})().catch(e=>{console.error(e);process.exitCode=1});
