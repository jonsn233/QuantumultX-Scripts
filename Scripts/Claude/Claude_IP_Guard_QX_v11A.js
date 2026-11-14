/** Claude IP Guard v11A | Quantumult X event-interaction
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
 function tile(label,main,detail,color){return '<td width="50%" style="padding:3px;vertical-align:top"><div style="border:1px solid #bdcbdc;border-radius:9px;padding:8px 3px;text-align:center"><div style="font-size:11px;color:#6c7a8d">'+e(label)+'</div><div style="font-size:15px;font-weight:bold;color:'+color+'">'+e(main)+'</div><div style="font-size:10px;color:#738198">'+e(detail)+'</div></div></td>';}
 function line(k,v){return '<tr><td style="padding:4px 2px;color:#6c7a8d;font-size:12px">'+e(k)+'</td><td style="padding:4px 2px;text-align:right;font-size:12px;font-weight:600">'+e(v)+'</td></tr>';}
 function section(s){return '<div style="font-size:13px;color:#315b90;font-weight:bold;margin:10px 0 4px">'+e(s)+'</div>';}
 function meter(label,ms,max){var count=ms>0?Math.max(1,Math.round(ms/max*12)):0;var blocks="■■■■■■■■■■■■".slice(0,count)+"□□□□□□□□□□□□".slice(0,12-count);return '<div style="font-size:12px;padding:3px 0">'+e(label)+' · '+e(ms)+'ms<br><span style="font-family:monospace;letter-spacing:1px;color:'+(ms>=3000?"#b56b2a":"#3f7cb7")+'">'+blocks+'</span></div>';}
 var html='<div style="font-family:-apple-system,sans-serif;font-size:13px;line-height:1.4;text-align:left">';
 html+='<div style="text-align:center;padding:9px 4px;border:1px solid #b7c7d9;border-radius:12px"><div style="font-size:11px;color:#66788c">AI-Claude · 检测请求出口</div><div style="font-size:25px;font-weight:bold">'+e(data.ip)+'</div><div style="font-size:12px">'+e(data.place)+'</div><div style="font-size:11px;color:#68788c">'+e(data.asn)+' · '+e(data.org)+'</div></div>';
 html+='<table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin-top:7px"><tr>'+
 tile("Claude 服务",data.apiOK&&data.webOK?"端点可达":"待检查",data.apiStatus+" / "+data.webStatus,data.apiOK&&data.webOK?"#16824d":"#b56b2a")+
 tile("实际路由","部分验证","脚本指定 AI-Claude","#b56b2a")+'</tr><tr>'+
 tile("IP 网络信誉","待查询","无授权风险数据","#718096")+
 tile("出口稳定性","未建立","仅本次检测","#718096")+'</tr></table>';
 html+=section("① 路由与出口证据");
 html+='<table width="100%" cellspacing="0" cellpadding="0">'+line("指定策略","AI-Claude")+line("双来源 IP",data.agree)+line("实际 Claude 路由","需查看 QX 请求记录")+line("地区参考",data.region)+'</table>';
 html+=section("② IP 信誉与属性");
 html+='<div style="font-size:12px;color:#66778e">住宅 / 机房 / VPN / 滥用评分：尚无已授权数据源，不作推断。</div>';
 html+=section("③ 出口稳定性");
 html+='<div style="font-size:12px;color:#66778e">当前仅单次采样；尚未建立持久历史记录，不能判断是否固定 IP。</div>';
 html+=section("④ 服务与响应");
 var max=Math.max(1,data.apiMs,data.webMs);
 html+=meter("Anthropic API",data.apiMs,max)+meter("Claude 网页",data.webMs,max);
 html+='<div style="font-size:11px;color:#718198">条形按本次较慢请求等比例绘制；非 Ping。≥3000ms 仅作慢响应提示。</div>';
 html+='<div style="margin-top:9px;padding:8px;border:1px solid #c6d0dd;border-radius:8px;font-size:11px;color:#586b83">双来源 '+e(data.agree)+' · '+e(data.source)+' · 总耗时 '+e(data.total)+'ms。API 401 是无效诊断密钥预期响应；302 仅表示网页重定向。IP 查询不等于 Claude 服务端确认的 IP；账号风险、DNS/IPv6 泄漏均未检测。</div></div>';
 console.log(JSON.stringify(data));
 $done({title:"🛡 Claude IP Guard · A v11",htmlMessage:html});
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