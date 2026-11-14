/** Claude IP Guard v10A | Quantumult X event-interaction
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
function show(data){
 var e=escapeHtml;
 function tile(name,value,color,detail){return '<td width="50%" style="padding:3px;vertical-align:top"><div style="border:1px solid #c6d1df;border-radius:9px;padding:8px 3px;text-align:center"><div style="font-size:11px;color:#68778b">'+e(name)+'</div><div style="font-size:15px;font-weight:bold;color:'+color+'">'+e(value)+'</div><div style="font-size:10px;color:#778599">'+e(detail)+'</div></div></td>';}
 function row(k,v){return '<tr><td style="padding:4px 2px;color:#68778b;font-size:12px;vertical-align:top">'+e(k)+'</td><td style="padding:4px 2px;text-align:right;font-size:12px;font-weight:600;vertical-align:top">'+e(v)+'</td></tr>';}
 function section(s){return '<div style="font-size:13px;font-weight:bold;color:#315b90;margin:9px 0 4px">'+e(s)+'</div>';}
 function bar(label,ms,max){var pct=ms>0?Math.max(2,Math.round(ms/max*100)):0;var color=ms>=3000?"#ce8140":ms>=1500?"#d5ad45":"#4b88c7";return '<div style="font-size:11px;margin:5px 0 7px">'+e(label)+' · '+e(ms)+'ms<div style="height:8px;background:#dfe7f0;border-radius:5px;overflow:hidden;margin-top:3px"><div style="height:8px;width:'+pct+'%;background:'+color+'"></div></div></div>';}
 var apiText=data.apiOK?(data.apiMs>=3000?"可达·较慢":"可达"):"待检查";
 var webText=data.webOK?(data.webMs>=3000?"可达·较慢":"可达"):"待检查";
 var html='<div style="font-family:-apple-system,sans-serif;font-size:13px;line-height:1.35;text-align:left">';
 html+='<div style="text-align:center;padding:8px 3px;border:1px solid #b7c7d9;border-radius:12px"><div style="font-size:11px;color:#66788c">AI-Claude · 出口 IPv4</div><div style="font-size:25px;font-weight:bold">'+e(data.ip)+'</div><div style="font-size:12px">'+e(data.place)+'</div><div style="font-size:11px;color:#68788c">'+e(data.asn)+' · '+e(data.org)+'</div></div>';
 html+='<table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin-top:7px"><tr>'+tile("Claude API",apiText,data.apiOK?"#16824d":"#bd6a23",data.apiMs+"ms · "+data.apiStatus)+tile("Claude 网页",webText,data.webOK?(data.webMs>=3000?"#a66c20":"#16824d"):"#bd6a23",data.webMs+"ms · "+data.webStatus)+'</tr><tr>'+tile("出口一致性",data.agree,data.agree==="一致"?"#16824d":"#bd6a23","双 IP 来源")+tile("IP 风险","未检测","#69788d","第三方数据未接入")+'</tr></table>';
 html+=section("HTTP 请求耗时");
 var max=Math.max(1,data.apiMs,data.webMs);
 html+=bar("Anthropic API",data.apiMs,max)+bar("Claude 网页",data.webMs,max);
 html+='<div style="font-size:10px;color:#728095">按本次最大值等比例绘制；非 Ping / 丢包率。≥3000ms 标记较慢。</div>';
 html+=section("Claude 出口专项");
 html+='<table width="100%" cellspacing="0" cellpadding="0">'+row("地区参考",data.region)+row("出口 / 策略",data.ip+" / AI-Claude")+row("ASN / 运营商",data.asn+" / "+data.org)+row("归属来源",data.source)+'</table>';
 html+=section("第三方风险");
 html+='<div style="font-size:12px;color:#6b798d">Scamalytics · IP2Proxy · AbuseIPDB · IPQualityScore：均未接入</div>';
 html+='<div style="margin-top:9px;padding:7px;border:1px solid #c6d0dd;border-radius:8px;font-size:11px;color:#586b83">双来源 '+e(data.agree)+' · 总耗时 '+e(data.total)+'ms。API 401 为无效诊断密钥预期响应。支持地区为静态参考，非实时官方核验。DNS/IPv6 泄漏、长期稳定性和账号风险未检测；出口 IP 非 Claude 服务端证明。</div></div>';
 console.log(JSON.stringify(data));
 $done({title:"🛡 Claude IP Guard · A v10",htmlMessage:html});
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
  var d=g.ok?g.data:{};
  var data={ip:val(ip),place:g.ok?val(d.country)+" / "+val(d.city):"归属地未知",region:g.ok?(d.code==="US"?"美国 · Claude 支持地区参考":"需核对官方支持地区名单"):"地区未确认",apiOK:r[0].status===401,webOK:r[1].status===200||r[1].status===302,apiStatus:result(r[0]),webStatus:result(r[1]),apiMs:r[0].ms,webMs:r[1].ms,agree:agree,asn:val(d.asn),org:val(d.org),source:g.ok?g.source:"不可用",total:Date.now()-started};
  show(data);
 });
}).catch(function(e){show({ip:"检测失败",place:"请查看日志",region:"未知",apiOK:false,webOK:false,apiStatus:"失败",webStatus:"失败",apiMs:0,webMs:0,agree:"未知",asn:"未知",org:"未知",source:"不可用",total:Date.now()-started});});
})();