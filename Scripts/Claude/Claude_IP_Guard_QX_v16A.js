/** Claude IP Guard v16A | Quantumult X event-interaction
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
var HISTORY_KEY="ClaudeIPGuard.History.v13A",HISTORY_MAX=30;
function historyUpdate(data){
 var state={count:0,changes:0,records:[],last:null},valid=ipv4(data.ip1)&&ipv4(data.ip2)&&data.ip1===data.ip2;
 try{var raw=$prefs.valueForKey(HISTORY_KEY),saved=raw?JSON.parse(raw):null;
  if(saved&&saved.version===1&&Array.isArray(saved.records)){
   state.records=saved.records.slice(-HISTORY_MAX);state.count=Math.max(0,Number(saved.count)||0);state.changes=Math.max(0,Number(saved.changes)||0);state.last=saved.last||null;
  }
 }catch(e){state.readError=true;}
 var prev=state.last;
 var report={valid:valid,previous:prev&&prev.ip||"无记录",count:state.count,changes:state.changes,status:"未记录",saved:false,records:state.records.slice(-10)};
 if(!valid){report.status="双来源不一致或查询失败，本次不入库";return report;}
 var now={ip:data.ip1,at:new Date().toISOString(),country:data.countryCode||"未知",asn:data.asn||"未知"};
 var changed=!!prev&&prev.ip!==now.ip;
 var countryChange=changed&&prev.country!=="未知"&&now.country!=="未知"&&prev.country!==now.country;
 var asnChange=changed&&prev.asn!=="未知"&&now.asn!=="未知"&&prev.asn!==now.asn;
 state.count++;if(changed)state.changes++;
 state.last=now;state.records.push(now);state.records=state.records.slice(-HISTORY_MAX);
 report.status=!prev?"首次记录":!changed?"与上次相同":countryChange?"国家变化":asnChange?"ASN 变化":"IP 变化";
 report.count=state.count;report.changes=state.changes;report.records=state.records.slice(-10);
 try{report.saved=$prefs.setValueForKey(JSON.stringify({version:1,count:state.count,changes:state.changes,last:state.last,records:state.records}),HISTORY_KEY)===true;}catch(e){}
 if(!report.saved)report.status+="（写入未确认）";
 return report;
}
function historyStrip(history){
 var records=(history.records||[]).slice(-10),n=records.length;
 if(!n)return '<div style="font-size:11px;color:#718096">尚无有效历史采样</div>';
 var marks=[],labels=[];
 for(var i=0;i<n;i++){
  var mark=i===0?"⚪":records[i].ip!==records[i-1].ip?"🟠":"🟢";
  marks.push(mark);labels.push(String(i+1));
 }
 var html='<div style="text-align:center;font-size:17px;letter-spacing:1px;white-space:nowrap">'+marks.join(' ')+'</div>';
 html+='<div style="text-align:center;font-size:10px;color:#64748b;letter-spacing:2px">'+labels.join('　')+'</div>';
 html+='<div style="font-size:10px;color:#718096;margin-top:3px">左→右：较早→最近 · '+n+' 次有效采样</div>';
 html+='<div style="font-size:10px;color:#64748b">⚪ 首个可见样本　🟢 与前次相同　🟠 与前次不同</div>';
 html+='<div style="font-size:10px;color:#64748b">仅比较采样记录；不代表两次采样间持续稳定。</div>';
 return html;
}
function show(data){
 var e=escapeHtml,h=data.history||{},both=data.apiOK&&data.webOK;
 function tile(label,value,sub,color){return '<td width="50%" style="padding:3px;vertical-align:top"><div style="border:1px solid #c6d2e0;border-radius:10px;padding:8px 3px;text-align:center"><div style="font-size:11px;color:#64748b">'+e(label)+'</div><div style="font-size:15px;font-weight:700;color:'+color+'">'+e(value)+'</div><div style="font-size:10px;color:#718096">'+e(sub)+'</div></div></td>';}
 function row(k,v){return '<tr><td style="font-size:12px;color:#64748b;padding:5px 2px">'+e(k)+'</td><td style="font-size:12px;text-align:right;font-weight:600;padding:5px 2px">'+e(v)+'</td></tr>';}
 var html='<div style="font-family:-apple-system,sans-serif;line-height:1.35;text-align:left">';
 html+='<div style="text-align:center;padding:10px 4px;border:1px solid #b8cadc;border-radius:12px"><div style="font-size:11px;color:#64748b">AI-Claude · 检测请求出口</div><div style="font-size:25px;font-weight:750;letter-spacing:.2px">'+e(data.ip)+'</div><div style="font-size:12px">'+e(data.place)+'</div><div style="font-size:11px;color:#64748b">'+e(data.asn)+' · '+e(data.org)+'</div></div>';
 html+='<table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin-top:8px"><tr>'+
 tile("Claude 端点",both?"可达":"待确认",data.apiStatus+" / "+data.webStatus,both?"#18804e":"#a66b28")+
 tile("出口校验",data.agree==="一致"?"双源一致":"需核对","ipify + icanhazip",data.agree==="一致"?"#18804e":"#a66b28")+'</tr><tr>'+
 tile("出口历史",h.status||"未知",(h.count||0)+" 次采样 · "+(h.changes||0)+" 次变化",h.saved?"#315b90":"#a66b28")+
 tile("IP 信誉","未检测","无授权评分数据","#64748b")+'</tr></table>';
 html+='<div style="font-size:13px;font-weight:700;color:#315b90;margin:10px 0 3px">最近出口采样</div>'+historyStrip(h);
 html+='<table width="100%" cellspacing="0" cellpadding="0">'+row("上次有效 IP",h.previous||"无记录")+row("历史保存",h.saved?"成功":"未保存")+'</table>';
 html+='<div style="font-size:13px;font-weight:700;color:#315b90;margin:8px 0 3px">服务响应</div>';
 html+='<table width="100%" cellspacing="0" cellpadding="0">'+row("Anthropic API",data.apiMs+"ms · "+data.apiStatus)+row("Claude 网页",data.webMs+"ms · "+data.webStatus)+'</table>';
 html+='<div style="border-top:1px solid #d1d9e3;margin-top:7px;padding-top:7px;font-size:10px;color:#718096">脚本指定 AI-Claude；实际 Claude 路由仍需 QX 请求记录确认。401 为无效测试密钥预期响应；302 是网页重定向。此处 IP 非 Claude 服务端证明；未评估账号风险、DNS 泄漏或长期稳定性。</div></div>';
 console.log(JSON.stringify(data));
 $done({title:"🛡 Claude IP Guard · A v16",htmlMessage:html});
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
  var data={ip:val(ip),ip1:ipv4(ip)?ip:"无有效 IPv4",ip2:ipv4(second)?second:"无有效 IPv4",ip1Status:result(r[2]),ip2Status:result(r[3]),place:g.ok?val(d.country)+" / "+val(d.city):"归属地未知",region:g.ok?(d.code==="US"?"美国 · Claude 支持地区参考":"需核对官方支持地区名单"):"地区未确认",apiOK:r[0].status===401,webOK:r[1].status===200||r[1].status===302,apiStatus:result(r[0]),webStatus:result(r[1]),apiMs:r[0].ms,webMs:r[1].ms,agree:agree,asn:val(d.asn),org:val(d.org),source:g.ok?g.source:"不可用",total:Date.now()-started};
  data.countryCode=g.ok?val(d.code):"未知";data.history=historyUpdate(data);show(data);
 });
}).catch(function(e){var failed={ip:"检测失败",ip1:"未知",ip2:"未知",ip1Status:"失败",ip2Status:"失败",place:"请查看日志",region:"未知",apiOK:false,webOK:false,apiStatus:"失败",webStatus:"失败",apiMs:0,webMs:0,agree:"未知",asn:"未知",org:"未知",source:"不可用",total:Date.now()-started};failed.history=historyUpdate(failed);show(failed);});
})();