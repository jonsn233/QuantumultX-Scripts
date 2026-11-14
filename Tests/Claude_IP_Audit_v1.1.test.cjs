const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '../Scripts/Claude/Claude_IP_Audit_v1.1.js'),'utf8');
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
await run('HTML not JSON',()=>Promise.resolve(response('<html>'+secret+'</html>',200,{'Content-Type':'text/html'})),['JSON_ERROR: invalid JSON syntax','syntax invalid']);
await run('malformed JSON',()=>Promise.resolve(response('{"token":"'+secret+'",}')),['JSON_ERROR']);
await run('non-text body',()=>Promise.resolve(response({token:secret})),['RESPONSE_TYPE_ERROR','bodyType=object']);
await run('missing HTTP status',()=>Promise.resolve({body:'{}'}),['RESPONSE_ERROR','HTTP=unknown']);
await run('missing ip field',()=>Promise.resolve(response('{}')),['JSON_SCHEMA_ERROR']);
await run('wrong address family',()=>Promise.resolve(response('{"ip":"2001:db8::1"}')),['IP_FAMILY_ERROR']);
await run('network rejection redacted',()=>Promise.reject({error:secret,Authorization:secret}),['NETWORK_ERROR']);
await run('synchronous fetch failure redacted',()=>{throw Error(secret)},['NETWORK_ERROR']);
await run('deadline',()=>new Promise(()=>{}),['NETWORK_TIMEOUT'],true);
await run('lookup provider error redacted',req=>Promise.resolve(response(req.url.includes('ipwho.is')?JSON.stringify({success:false,message:secret}):JSON.stringify({ip:req.url.includes('api6.')?'::1':'192.0.2.1'}))),['LOOKUP_ERROR']);
assert.ok(!/\$notify|\$prefs|\$configuration|cron/i.test(source));
console.log('PASS manual-only / no notification, storage, routing or config mutation API');
})().catch(e=>{console.error(e);process.exitCode=1});
