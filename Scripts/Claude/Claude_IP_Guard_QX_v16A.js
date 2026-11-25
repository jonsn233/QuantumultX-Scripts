/** Claude IP Guard V16.2 | QX event-interaction | Read-only policy check; fresh per-node IPv4 history. */
(function(){
"use strict";
async function dashboard(env) {
 const policy="AI-Claude",version="16.2.0",start=env.now();
 const esc=v=>String(v==null?"未知":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const val=v=>v===undefined||v===null||v===""?"未知":String(v);
 function ip4(s){return typeof s==="string"&&s.split(".").length===4&&s.split(".").every(x=>/^(0|[1-9]\d{0,2})$/.test(x)&&Number(x)<=255);}
 function ip6(s){if(typeof s!=="string"||!s.includes(":")||!/^[0-9a-f:]+$/i.test(s))return null;const a=s.toLowerCase().split("::");if(a.length>2)return null;const l=a[0]?a[0].split(":"):[],r=a.length===2&&a[1]?a[1].split(":"):[];if([...l,...r].some(x=>!/^[a-f0-9]{1,4}$/.test(x)))return null;const n=8-l.length-r.length;if(a.length===1?n!==0:n<1)return null;const parts=[...l,...Array(n).fill("0"),...r].map(x=>parseInt(x,16).toString(16));return parts.join(":");}
 function parse(s){try{return JSON.parse(String(s).replace(/^\uFEFF/,"").trim());}catch(_){return null;}}
 function ok(r){return r&&r.status>=200&&r.status<300&&!r.error;}
 function echo(r,family){if(!ok(r))return null;let s=String(r.body||"").replace(/^\uFEFF/,"").trim(),d=parse(s);if(typeof d==="string")s=d.trim();else if(d&&typeof d.ip==="string")s=d.ip.trim();return family===4?(ip4(s)?s:null):ip6(s);}
 function status(r){return r.error||"HTTP "+val(r.status);}
 function asn(s){const a=String(s==null?"":s).trim().match(/^(?:AS)?(\d+)$/i);return a&&Number(a[1])>0?"AS"+a[1]:null;}
 function geo(r,source,ip){if(!ok(r))return null;let d=parse(r.body);if(!d||d.ip!==ip||d.error||(source==="ipwho.is"&&d.success!==true))return null;const c=source==="ipwho.is"?d.connection||{}:d;let code=String(d.country_code||"").toUpperCase();return {source,code:/^[A-Z]{2}$/.test(code)?code:null,country:val(source==="ipwho.is"?d.country:d.country_name),city:val(d.city),asn:asn(c.asn),org:val(c.org)};}
 function score(r,ip){if(!ok(r))return "未知 · "+status(r);const d=parse(r.body);if(!d||d.ip!==ip)return "未知 · IP 不匹配";const n=d.fraudScore;if(typeof n!=="number"||!Number.isFinite(n)||n<0||n>100)return "未知 · 无有效评分";return String(n)+"/100";}
 function abuse(r,ip){if(!ok(r))return "未知 · "+status(r);const d=parse(r.body);if(!d||d.ip!==ip)return "未知 · IP 不匹配";const v=d.company&&d.company.abuser_score;return typeof v==="string"&&v.trim()?v.trim().slice(0,90):typeof v==="number"&&Number.isFinite(v)?String(v):"未知 · 无公开数据";}
 function leaf(state){const chain=state&&state.ret&&state.ret[policy];return Array.isArray(chain)&&chain[0]===policy&&chain.length>=2&&typeof chain[chain.length-1]==="string"?chain[chain.length-1]:null;}
 function history(tag,ip,eligible){const key="ClaudeIPGuard.History.v16_1."+encodeURIComponent(tag||"unverified");let state={version:2,count:0,changes:0,records:[],last:null};if(!tag)return {...state,saved:false,previous:"无记录",status:"节点未确认，不入库"};try{const raw=env.read(key);if(raw){const s=JSON.parse(raw);if(!s||s.version!==2||!Array.isArray(s.records)||!Number.isSafeInteger(s.count)||!Number.isSafeInteger(s.changes)||s.count<s.records.length||s.changes<0||s.changes>Math.max(0,s.count-1)||s.records.some(x=>!x||!ip4(x.ip)||typeof x.at!=="string"||!Number.isFinite(Date.parse(x.at)))||!s.last||!s.records.length||s.last.ip!==s.records[s.records.length-1].ip||s.last.at!==s.records[s.records.length-1].at)return {...state,saved:false,previous:"未知",status:"历史格式异常，未覆盖"};state={...s,records:s.records.slice(-30)};}}catch(_){return {...state,saved:false,previous:"未知",status:"历史读取失败，未覆盖"};}
 const previous=state.last?state.last.ip:"无记录";if(!eligible)return {...state,saved:false,previous,status:"无有效双源样本，不入库"};const changed=!!state.last&&state.last.ip!==ip;const rec={ip,at:new Date(env.now()).toISOString()};const next={version:2,count:state.count+1,changes:state.changes+(changed?1:0),last:rec,records:[...state.records,rec].slice(-30)};try{if(env.write(key,JSON.stringify(next))!==true)return {...state,saved:false,previous,status:"保存未确认"};}catch(_){return {...state,saved:false,previous,status:"保存失败"};}return {...next,saved:true,previous,status:state.last?(changed?"IP 变化":"与上次相同"):"首次记录"};}
 const before=leaf(await env.state());
 let r=[],a=null,b=null,v6a=null,v6b=null,g1=null,g2=null,rep="未查询",networkAbuse="未查询",api="未检测",web="未检测",apiMs=null,webMs=null;
 const blocked=before&&/^(reject(?:-[a-z]+)?|direct|proxy)$/i.test(before);
 if(before&&!blocked){
 r=await Promise.all([env.req("https://api.ipify.org?format=json"),env.req("https://ipv4.icanhazip.com/"),env.req("https://api6.ipify.org?format=json"),env.req("https://ipv6.icanhazip.com/"),env.req("https://api.anthropic.com/v1/messages","POST",{"content-type":"application/json","anthropic-version":"2023-06-01","x-api-key":"invalid-diagnostic-key"},JSON.stringify({model:"diagnostic",max_tokens:1,messages:[{role:"user",content:"ping"}]})),env.req("https://claude.ai/","GET",{"Accept":"text/html"})]);
 a=echo(r[0],4);b=echo(r[1],4);v6a=echo(r[2],6);v6b=echo(r[3],6);api=status(r[4]);web=status(r[5]);apiMs=r[4].error?null:r[4].ms;webMs=r[5].error?null:r[5].ms;
 if(a&&b&&a===b){const ip=encodeURIComponent(a);const x=await Promise.all([env.req("https://ipwho.is/"+ip),env.req("https://ipapi.co/"+ip+"/json/"),env.req("https://my.ippure.com/v1/info"),env.req("https://api.ipapi.is/?q="+ip)]);g1=geo(x[0],"ipwho.is",a);g2=geo(x[1],"ipapi.co",a);rep=score(x[2],a);networkAbuse=abuse(x[3],a);}
 }
 const after=leaf(await env.state()),stable=!!before&&before===after&&!blocked,confirmed=stable&&!!a&&a===b;
 const ip=confirmed?a:"未确认",ipv6=stable&&v6a&&v6a===v6b?v6a:null;
 const h=history(stable?before:null,ip,confirmed);
 const disagree=(x,y)=>x&&y&&x!==y;
 const geoConflict=!!(g1&&g2&&(disagree(g1.code,g2.code)||disagree(g1.asn,g2.asn)));
 const g=confirmed?(g1||g2):null;
 const place=g?geoConflict?"归属来源不一致":g.country+" / "+g.city:"归属地未知";
 const asnLabel=g?geoConflict?"需核对":val(g.asn):"未知";
 const ipv6Status=!stable?"未确认":ipv6?"双源一致":v6a&&v6b?"双源不一致":v6a||v6b?"仅单源有结果":"未取得有效 IPv6";
 const geoDetail=x=>x?x.country+" / "+x.city+" · "+val(x.asn)+" · "+x.org:"未知或响应未匹配";
 const out={version,node:before,stable,confirmed,ip,a,b,v6a,v6b,ipv6,history:h,geoConflict,geo1:g1,geo2:g2,rep:confirmed?rep:"未查询/未确认",networkAbuse:confirmed?networkAbuse:"未查询/未确认",api,web,apiMs,webMs};
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
 var e=esc,h=data.history||{},both=data.apiOK&&data.webOK;
 function tile(label,value,sub,color){return '<td width="50%" style="padding:3px;vertical-align:top"><div style="border:1px solid #c6d2e0;border-radius:10px;padding:8px 3px;text-align:center"><div style="font-size:11px;color:#64748b">'+e(label)+'</div><div style="font-size:15px;font-weight:700;color:'+color+'">'+e(value)+'</div><div style="font-size:10px;color:#718096">'+e(sub)+'</div></div></td>';}
 function row(k,v){return '<tr><td style="font-size:12px;color:#64748b;padding:5px 2px">'+e(k)+'</td><td style="font-size:12px;text-align:right;font-weight:600;padding:5px 2px">'+e(v)+'</td></tr>';}
 var html='<div style="font-family:-apple-system,sans-serif;line-height:1.35;text-align:left">';
 html+='<div style="text-align:center;padding:10px 4px;border:1px solid #b8cadc;border-radius:12px"><div style="font-size:11px;color:#64748b">AI-Claude · '+e(data.node)+'</div><div style="font-size:25px;font-weight:750;letter-spacing:.2px">'+e(data.ip)+'</div><div style="font-size:12px">'+e(data.place)+'</div><div style="font-size:11px;color:#64748b">'+e(data.asn)+' · '+e(data.org)+'</div></div>';
 html+='<table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin-top:8px"><tr>'+
 tile("Claude 端点",both?"可达":"待确认",data.apiStatus+" / "+data.webStatus,both?"#18804e":"#a66b28")+
 tile("IPv4 出口",data.agree==="一致"?"双源一致":"需核对","ipify + icanhazip",data.agree==="一致"?"#18804e":"#a66b28")+'</tr><tr>'+
 tile("出口历史",h.status||"未知",(h.count||0)+" 次采样 · "+(h.changes||0)+" 次变化",h.saved?"#315b90":"#a66b28")+
 tile("IP 信誉",data.rep,"IPPure 风险分","#315b90")+'</tr></table>';
 html+='<div style="font-size:13px;font-weight:700;color:#315b90;margin:10px 0 3px">最近出口采样</div>'+historyStrip(h);
 html+='<table width="100%" cellspacing="0" cellpadding="0">'+row("上次有效 IP",h.previous||"无记录")+row("IPv6 出口",data.ipv6||data.ipv6Status)+row("归属校验",data.geoStatus)+'</table>';
 html+='<div style="font-size:13px;font-weight:700;color:#315b90;margin:8px 0 3px">服务响应</div>';
 html+='<table width="100%" cellspacing="0" cellpadding="0">'+row("Anthropic API",(data.apiMs===null?"未知":data.apiMs+"ms")+" · "+data.apiStatus)+row("Claude 网页",(data.webMs===null?"未知":data.webMs+"ms")+" · "+data.webStatus)+'</table>';
 html+='<div style="border-top:1px solid #d1d9e3;margin-top:7px;padding-top:7px;font-size:10px;color:#718096">401/302 仅表示端点响应；IPv6 未确认不代表无泄漏。信誉分不等于账号风险。</div></div>';
 return html;
}
 const data={node:val(before),ip,place,asn:asnLabel,org:g&&!geoConflict?g.org:"未知",agree:confirmed?"一致":"未确认",history:h,apiOK:stable&&!!r[4]&&r[4].status===401,webOK:stable&&!!r[5]&&[200,301,302,303,307,308].includes(r[5].status),apiStatus:api,webStatus:web,apiMs,webMs,rep:out.rep,ipv6,ipv6Status,geoStatus:!confirmed?"未确认":geoConflict?"来源不一致":g1&&g2&&g1.code&&g2.code&&g1.asn&&g2.asn?(g1.city!==g2.city||g1.org!==g2.org?"国家/ASN 一致，细节有差异":"双源一致"):g1&&g2?"双源部分信息":g?"单源可用":"未知"};
 return {out,title:"🛡 Claude IP Guard · V16.2",htmlMessage:show(data)};
}
function qxEnv(){
 const policy="AI-Claude",timeout=6500;
 function timed(p,fallback){return new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(timer);resolve(v);};const timer=setTimeout(()=>finish(fallback),timeout);try{Promise.resolve(p()).then(finish,()=>finish(fallback));}catch(_){finish(fallback);}});}
 return {now:()=>Date.now(),state:()=>timed(()=>$configuration.sendMessage({action:"get_policy_state"}),null),read:k=>$prefs.valueForKey(k),write:(k,v)=> $prefs.setValueForKey(v,k),req:(url,method,headers,body)=>{const t=Date.now();return timed(()=>{const opts={url,method:method||"GET",headers:headers||{"Accept":"application/json, text/plain;q=0.9"},opts:{policy,redirection:false,"skip-cert-verify":false,"auto-cookie":false}};if(body!==undefined)opts.body=body;return Promise.resolve($task.fetch(opts)).then(r=>({status:Number(r.statusCode),body:typeof r.body==="string"?r.body:"",ms:Date.now()-t}),()=>({error:"网络请求失败"}));},{error:"超时/请求失败"});}};
}
dashboard(qxEnv()).then(function(r){$done({title:r.title,htmlMessage:r.htmlMessage});},function(){  $done({title:"Claude IP Guard · V16.2",message:"检测异常，未确认结果。请重新运行。"}); });
})();
