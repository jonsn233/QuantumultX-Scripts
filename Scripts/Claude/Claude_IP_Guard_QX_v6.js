/** Claude IP Guard v6 | Quantumult X event-interaction
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
 var html='<div style="font-family:-apple-system,sans-serif;text-align:left;font-size:14px;line-height:1.55">';
 rows.forEach(function(r){if(r===null)html+='<hr style="border:0;border-top:1px solid #aaa;opacity:.5">';else if(r.heading)html+='<div style="font-weight:700;margin:9px 0 4px">'+escapeHtml(r.heading)+'</div>';else html+='<div>'+escapeHtml(r)+'</div>';});
 html+='</div>';
 console.log(rows.map(function(r){return r===null?"---":r.heading||r;}).join("\n"));
 $done({title:"🛡 Claude IP Guard v6",htmlMessage:html});
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
  var rows=[{heading:"① Claude 服务连通性"},
   "API："+result(r[0])+" · "+r[0].ms+"ms",
   "网页："+result(r[1])+" · "+r[1].ms+"ms",
   "API 401：测试密钥被拒绝属预期",
   "网页登录状态：本脚本不检测",
   null,{heading:"② 专用代理出口"},
   "指定策略："+POLICY,
   "出口 IPv4："+val(ip),
   "第二来源："+(ipv4(second)?second:result(r[3])),
   "双来源一致性："+agree,
   "IP 查询耗时："+r[2].ms+"ms / "+r[3].ms+"ms"];
  if(g.ok){var d=g.data;rows.push("国家："+val(d.country)+" ("+val(d.code)+")","地区："+val(d.region),"城市："+val(d.city),"ASN："+val(d.asn),"运营商："+val(d.org),"时区："+val(d.timezone),"归属数据："+g.source+" · "+g.ms+"ms");if(d.ip&&d.ip!==ip)rows.push("警告：归属数据 IP 与查询不一致");}
  else rows.push("归属数据：暂不可用");
  rows.push(null,{heading:"③ IP 属性与风险"},"住宅/机房：未检测","VPN/代理风险：未检测","黑名单/风险评分：未检测",null,{heading:"④ 检测质量与说明"},
   "总耗时："+(Date.now()-started)+"ms",
   "检测时间："+new Date().toLocaleString(),
   "DNS/IPv6 泄漏：未检测",
   "长期 IP 稳定性：未检测",
   "本次请求均指定 AI-Claude",
   "非 Claude 服务端实际 IP 证明",
   "账号安全与封禁风险：无法据此判断");
  if(agree==="不一致")rows.push("⚠ 两个 IP 来源不一致，请查看请求记录");
  show(rows);
 });
}).catch(function(e){show([{heading:"检测异常"},"错误："+val(e&&e.message),"未修改任何代理配置"]);});
})();