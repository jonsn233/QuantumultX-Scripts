/** Claude IP Guard v8A | Quantumult X event-interaction
 * Read-only. Explicit AI-Claude policy on every request.
 * No MitM, keys, account access, or risk-score claims.
 */
(function(){
"use strict";
var POLICY="AI-Claude",TIMEOUT=10000,started=Date.now();
function req(url,method,headers,body){
 return new Promise(function(resolve){
  var finished=false,t0=Date.now(),timer=setTimeout(function(){end({error:"超时"});},TIMEOUT);
  function end(x){if(finished)return;finished=true;clearTimeout(timer);x.ms=Date.now()-t0;resolve(x);}
  try{
   var options={url:url,method:method||"GET",headers:headers||{"Accept":"application/json"},opts:{"policy":POLICY,"redirection":false,"skip-cert-verify":false,"auto-cookie":false}};
   if(body!==undefined)options.body=body;
   Promise.resolve($task.fetch(options)).then(function(r){end({status:Number(r.statusCode),body:typeof r.body==="string"?r.body:""});},function(){end({error:"网络请求失败"});});
  }catch(e){end({error:"请求异常"});}
 });
}
function parse(s){try{return JSON.parse(s.replace(/^\uFEFF/,""));}catch(e){return null;}}
function ipv4(s){if(typeof s!=="string")return false;var a=s.trim().split(".");return a.length===4&&a.every(function(v){return /^(0|[1-9][0-9]{0,2})$/.test(v)&&Number(v)<256;});}
function val(x){return x===undefined||x===null||x===""?"未知":String(x);}
function result(r){return r.error?r.error:"HTTP "+val(r.status);}
function geo(ip){
 var sources=[
  {name:"ipapi.co",url:"https://ipapi.co/"+encodeURIComponent(ip)+"/json/",read:function(d){if(!d||d.error||!d.country_code)return null;return {ip:d.ip,country:d.country_name,code:d.country_code,region:d.region,city:d.city,asn:d.asn,org:d.org,timezone:d.timezone};}},
  {name:"ipwho.is",url:"https://ipwho.is/"+encodeURIComponent(ip),read:function(d){if(!d||d.success!==true)return null;return {ip:d.ip,country:d.country,code:d.country_code,region:d.region,city:d.city,asn:d.connection&&d.connection.asn,org:d.connection&&d.connection.org,timezone:d.timezone&&d.timezone.id};}}
 ];
 function attempt(i){if(i>=sources.length)return Promise.resolve({ok:false});
  return req(sources[i].url).then(function(r){var d=r.status===200?sources[i].read(parse(r.body)):null;return d?{ok:true,data:d,source:sources[i].name,ms:r.ms}:attempt(i+1);});
 }
 return attempt(0);
}
function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function show(rows){
 var html='<div style="font-family:-apple-system,sans-serif;font-size:14px;line-height:1.45;text-align:left">';
 rows.forEach(function(r){
  if(r===null){html+='<hr style="border:0;border-top:1px solid #bbb;margin:9px 0">';}
  else if(r.heading){html+='<div style="font-weight:bold;color:#375b8d;padding:6px 0">'+escapeHtml(r.heading)+'</div>';}
  else if(r.ip){html+='<div style="text-align:center;border:1px solid #b5c6d9;border-radius:10px;padding:12px 5px;margin:6px 0"><div style="font-size:12px">Claude 策略出口 IPv4</div><div style="font-size:23px;font-weight:bold">'+escapeHtml(r.ip)+'</div></div>';}
  else html+='<div style="padding:3px 0">'+escapeHtml(r)+'</div>';
 });
 html+='</div>';
 console.log(rows.map(function(x){return x===null?"---":x.heading||x.ip||x;}).join("\\n"));
 $done({title:"🛡 Claude IP Guard · A",htmlMessage:html});
}

var probe=JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1,messages:[{role:"user",content:"ping"}]});
Promise.all([
 req("https://api.anthropic.com/v1/messages","POST",{"content-type":"application/json","anthropic-version":"2023-06-01","x-api-key":"invalid-diagnostic-key"},probe),
 req("https://claude.ai/","GET",{"Accept":"text/html"}),
 req("https://api.ipify.org?format=json"),
 req("https://ipv4.icanhazip.com/")
]).then(function(r){
 var p=parse(r[2].body||""),ip=p&&p.ip;
 if(!ipv4(ip))ip=ipv4((r[2].body||"").trim())?(r[2].body||"").trim():null;
 var second=(r[3].body||"").trim(),agree=ip&&ipv4(second)?(ip===second?"一致":"不一致"):"无法比较";
 return (ip?geo(ip):Promise.resolve({ok:false})).then(function(g){
  var rows=[{ip:val(ip)},{heading:"① Claude 服务状态"},
   "API："+result(r[0])+" · "+r[0].ms+"ms",
   "网页："+result(r[1])+" · "+r[1].ms+"ms",
   "401 是无效诊断密钥的预期响应",
   null,{heading:"② 出口与身份"},
   "策略："+POLICY,
   "双来源出口："+agree,
   "国家 / 城市："+(g.ok?val(g.data.country)+" / "+val(g.data.city):"待查询"),
   "ASN："+(g.ok?val(g.data.asn):"待查询"),
   "运营商："+(g.ok?val(g.data.org):"待查询"),
   null,{heading:"③ 第三方风险数据"},
   "Scamalytics：未接入",
   "IP2Proxy：未接入",
   "AbuseIPDB：未接入",
   "IPQualityScore：未接入",
   null,{heading:"④ 检测结论"},
   "API 与网页："+((r[0].status===401&&(r[1].status===200||r[1].status===302))?"端点可达":"需要检查"),
   "IP 双来源："+agree,
   "检测总耗时："+(Date.now()-started)+"ms",
   "IP 稳定性 / DNS 泄漏：未检测",
   "仅为网络环境诊断，非 Claude 封号风险评级"];
  show(rows);
 });
}).catch(function(e){show([{heading:"检测异常"},"错误："+val(e&&e.message),"未修改任何代理配置"]);});
})();