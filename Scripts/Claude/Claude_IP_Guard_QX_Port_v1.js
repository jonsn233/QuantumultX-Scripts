/**
 * Claude IP Guard for Quantumult X - community logic port (experimental).
 * Source: https://github.com/cso1z/claude-ip-guard (MIT)
 * Adaptation: manual event-interaction, read-only, no login or credentials.
 * The ipify/ipinfo request route MAY differ from Claude's route: do not
 * mistake the detected IP for Claude's confirmed server-side observed IP.
 */
var TIMEOUT=10000;
function fetchQ(url,method,headers,body){
 return new Promise(function(resolve){
  var finished=false;
  var timer=setTimeout(function(){done({ok:false,error:"TIMEOUT"});},TIMEOUT);
  function done(v){if(finished)return;finished=true;clearTimeout(timer);resolve(v);}
  try {
   var p=$task.fetch({url:url,method:method||"GET",headers:headers||{"Accept":"application/json"},body:body,opts:{"redirection":false,"skip-cert-verify":false,"auto-cookie":false}});
   Promise.resolve(p).then(function(r){done({ok:true,status:Number(r.statusCode),body:String(r.body||"")});},function(){done({ok:false,error:"NETWORK_ERROR"});});
  }catch(e){done({ok:false,error:"REQUEST_ERROR"});}
 });
}
function parse(s){try{return JSON.parse(s.replace(/^\uFEFF/,""));}catch(e){return null;}}
function validIP(s){return typeof s==="string"&&(/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(s)||(/^[0-9a-fA-F:]+$/.test(s)&&s.indexOf(":")>=0));}
function status(r){return r.ok?"HTTP "+r.status:"Failed ("+r.error+")";}
function resultLine(v){return v===undefined||v===null||v===""?"Unknown":String(v);}
var API="https://api.anthropic.com/v1/messages";
var PROBE_BODY=JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1,messages:[{role:"user",content:"ping"}]});
Promise.all([
 fetchQ(API,"POST",{"content-type":"application/json","anthropic-version":"2023-06-01","x-api-key":"invalid-diagnostic-key"},PROBE_BODY),
 fetchQ("https://claude.ai/","GET",{"Accept":"text/html"}),
 fetchQ("https://api.ipify.org?format=json"),
 fetchQ("https://ipinfo.io/json")
]).then(function(a){
 var api=a[0],web=a[1],ipres=a[2],geo=a[3],d=parse(geo.body||""),p=parse(ipres.body||"");
 var ip=(p&&p.ip)||((ipres.body||"").trim());
 var out=["========== Claude IP Guard | QX ==========","Manual diagnostic | based on cso1z/claude-ip-guard",""];
 out.push("[Claude endpoint connectivity]");
 out.push("api.anthropic.com: "+status(api));
 out.push("claude.ai: "+status(web));
 if(api.ok&&api.status===401)out.push("API returned 401: endpoint responded; dummy key rejected as expected.");
 else if(api.ok&&api.status===403)out.push("API returned 403: request denied; cause cannot be identified from status alone.");
 else if(api.ok)out.push("API HTTP response received; login and actual Claude usage NOT verified.");
 else out.push("API request failed; cannot determine Claude availability.");
 out.push("");
 out.push("[Observed public IP - not necessarily Claude exit]");
 out.push("ipify: "+(ipres.ok?resultLine(ip):status(ipres)));
 out.push("ipinfo: "+status(geo));
 if(d&&d.ip){out.push("IP: "+d.ip);out.push("Country: "+resultLine(d.country));out.push("Region / City: "+resultLine(d.region)+" / "+resultLine(d.city));out.push("ASN / Organization: "+resultLine(d.org));}
 else out.push("Geo/ASN: unavailable");
 if(validIP(ip)&&d&&d.ip)out.push("IP services agree: "+(ip===d.ip?"Yes":"No (check routing)"));
 out.push("");
 out.push("[Interpretation]");
 out.push("These requests follow existing Quantumult X rules. IP lookup services may use a different proxy policy than Claude.");
 out.push("No DNS/WebRTC leak test, account login test, or ban-risk guarantee.");
 out.push("No credentials collected; no settings changed.");
 console.log(out.join("\n"));
 $done();
}).catch(function(){console.log("Claude IP Guard QX: unexpected runtime error");$done();});
