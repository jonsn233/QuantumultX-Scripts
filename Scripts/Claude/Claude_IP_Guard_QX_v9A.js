/** Claude IP Guard v9A | Quantumult X event-interaction
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
 function tile(name,value,color){return '<td width="50%" style="padding:5px;vertical-align:top"><div style="border:1px solid #bdc8d5;border-radius:9px;padding:9px 5px;text-align:center"><div style="font-size:11px;color:#65758c">'+e(name)+'</div><div style="font-size:16px;font-weight:bold;color:'+color+'">'+e(value)+'</div></div></td>';}
 function row(k,v){return '<tr><td style="padding:5px 3px;color:#69788d;font-size:12px;vertical-align:top">'+e(k)+'</td><td style="padding:5px 3px;text-align:right;font-size:12px;font-weight:bold;vertical-align:top">'+e(v)+'</td></tr>';}
 function section(name){return '<div style="font-weight:bold;color:#365e96;padding:10px 0 5px">'+e(name)+'</div>';}
 function bar(label,ms){var pct=Math.max(0,Math.min(100,Math.round(ms/1500*100)));return '<div style="font-size:12px;margin:5px 0">'+e(label)+' · '+e(ms)+'ms<div style="height:7px;background:#e4eaf2;border-radius:5px;overflow:hidden"><div style="height:7px;width:'+pct+'%;background:#5186c8"></div></div></div>';}
 var html='<div style="font-family:-apple-system,sans-serif;font-size:13px;line-height:1.35;text-align:left">';
 html+='<div style="text-align:center;padding:9px 3px;border:1px solid #b7c7d9;border-radius:12px"><div style="font-size:11px;color:#66788c">AI-Claude · 公网出口 IPv4</div><div style="font-size:24px;font-weight:bold">'+e(data.ip)+'</div><div style="font-size:12px">'+e(data.place)+'</div></div>';
 html+='<table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin-top:8px"><tr>'+tile("Claude API",data.apiOK?"● 可达":"! 待检查",data.apiOK?"#16824d":"#bd6a23")+tile("Claude 网页",data.webOK?"● 可达":"! 待检查",data.webOK?"#16824d":"#bd6a23")+'</tr><tr>'+tile("双出口一致性",data.agree,data.agree==="一致"?"#16824d":"#bd6a23")+tile("第三方风险","未接入","#69788d")+'</tr></table>';
 html+=section("网络响应时间");
 html+=bar("Anthropic API",data.apiMs)+bar("Claude 网页",data.webMs);
 html+=section("出口身份");
 html+='<table width="100%" cellspacing="0" cellpadding="0">'+row("策略","AI-Claude")+row("国家 / 城市",data.place)+row("ASN",data.asn)+row("运营商",data.org)+row("数据来源",data.source)+'</table>';
 html+=section("第三方 IP 风险");
 html+='<table width="100%" cellspacing="0" cellpadding="0">'+row("Scamalytics","未接入")+row("IP2Proxy","未接入")+row("AbuseIPDB","未接入")+row("IPQualityScore","未接入")+'</table>';
 html+='<div style="margin-top:10px;padding:8px;border:1px solid #c6d0dd;border-radius:8px;font-size:11px;color:#586b83">双来源：'+e(data.agree)+' · 总耗时 '+e(data.total)+'ms。IP 风险、DNS 泄漏及长期稳定性未检测。401 是无效测试密钥的预期响应。此报告不能证明 Claude 服务端记录的 IP 或账号安全。</div></div>';
 console.log(JSON.stringify(data));
 $done({title:"🛡 Claude IP Guard · A Dashboard",htmlMessage:html});
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
  var data={ip:val(ip),place:g.ok?val(d.country)+" / "+val(d.city):"归属地未知",apiOK:r[0].status===401,webOK:r[1].status===200||r[1].status===302,apiMs:r[0].ms,webMs:r[1].ms,agree:agree,asn:val(d.asn),org:val(d.org),source:g.ok?g.source:"不可用",total:Date.now()-started};
  show(data);
 });
}).catch(function(e){show({ip:"检测失败",place:"请查看日志",apiOK:false,webOK:false,apiMs:0,webMs:0,agree:"未知",asn:"未知",org:"未知",source:"不可用",total:Date.now()-started});});
})();