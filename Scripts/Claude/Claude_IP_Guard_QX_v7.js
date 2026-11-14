/** Claude IP Guard v7.0 | Quantumult X event-interaction
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
 var esc=escapeHtml;
 var html='<div style="font-family:-apple-system,sans-serif;text-align:left;font-size:14px;line-height:1.55">';
 rows.forEach(function(r){
  if(r===null){html+='<div style="height:9px"></div>';return;}
  if(r.heading){html+='<div style="font-weight:700;background:#edf2fa;color:#243e66;border-radius:9px;padding:8px 10px;margin:7px 0">'+esc(r.heading)+'</div>';return;}
  if(r.hero){html+='<div style="text-align:center;border:1px solid #ccd7e6;border-radius:12px;padding:12px 6px;margin:8px 0"><div style="font-size:12px;color:#63758b">Claude 专用出口 IPv4</div><div style="font-weight:800;font-size:24px;letter-spacing:.2px">'+esc(r.hero)+'</div><div style="font-size:12px;color:#63758b">'+esc(r.note||"")+'</div></div>';return;}
  if(r.k){html+='<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 2px;border-bottom:1px solid #e4e7eb"><span style="color:#667085">'+esc(r.k)+'</span><span style="font-weight:600;text-align:right;overflow-wrap:anywhere">'+esc(r.v)+'</span></div>';return;}
  html+='<div style="padding:3px 0">'+esc(r)+'</div>';
 });
 html+='</div>';
 console.log(rows.map(function(r){return r===null?"---":r.heading||r.hero||(r.k?r.k+": "+r.v:r);}).join("\\n"));
 $done({title:"🛡 Claude IP Guard v7.0",htmlMessage:html});
}
function kv(k,v){return {k:k,v:val(v)};}

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
  var apiOK=r[0].status===401,webOK=r[1].status===200||r[1].status===302;
  var region=g.ok&&g.data.code==="US"?"美国：位于 Claude 官方支持地区（名单非实时查询）":"未确认：需核对 Claude 官方最新地区名单";
  var rows=[{hero:val(ip),note:g.ok?val(g.data.country)+" · "+val(g.data.region)+" / "+val(g.data.city):"归属地待查询"},
   {heading:"① Claude 服务专项"},
   kv("API 连通性",result(r[0])+(apiOK?" · 测试密钥拒绝符合预期":"")),
   kv("Claude 网页",result(r[1])+(webOK?" · 已响应":"")),
   kv("API 耗时",r[0].ms+" ms"),kv("网页耗时",r[1].ms+" ms"),
   kv("账号登录", "本脚本不检测"),
   null,{heading:"② 出口与地区适用性"},
   kv("请求策略",POLICY),kv("出口 IPv4",val(ip)),
   kv("第二来源",ipv4(second)?second:result(r[3])),
   kv("双来源一致",agree),kv("地区参考",region)];
  if(g.ok){var d=g.data;rows.push(kv("国家",val(d.country)+" ("+val(d.code)+")"),kv("地区 / 城市",val(d.region)+" / "+val(d.city)),kv("ASN",d.asn),kv("运营商",d.org),kv("时区",d.timezone),kv("归属数据源",g.source));if(d.ip&&d.ip!==ip)rows.push("⚠ 归属数据 IP 与出口 IP 不一致");}
  else rows.push(kv("归属数据","查询失败"));
  rows.push(null,{heading:"③ 路由与网络质量"},
   kv("策略指定","所有请求均使用 AI-Claude"),
   kv("实际节点","请以 QX 请求记录为准"),
   kv("双 IP 检测耗时",r[2].ms+" / "+r[3].ms+" ms"),
   kv("检测总耗时",(Date.now()-started)+" ms"),
   kv("检测时间",new Date().toLocaleString()),
   null,{heading:"④ Claude 环境结论"},
   kv("服务端点",apiOK&&webOK?"接口可达":"部分失败 / 待检查"),
   kv("出口一致性",agree),
   kv("地区适用性",region),
   kv("IP 类型 / 风险","未检测，不能推断账号安全"),
   kv("DNS / IPv6 泄漏","未检测"),
   kv("长期出口稳定性","未检测"),
   "注：本次为代理出口环境检测，不能证明 Claude 服务端实际记录的 IP，也不能预测封号风险。");
  if(agree==="不一致")rows.push("⚠ 双来源 IP 不一致，建议检查 QX 请求记录");
  show(rows);
 });
}).catch(function(e){show([{heading:"检测异常"},"错误："+val(e&&e.message),"未修改任何代理配置"]);});
})();