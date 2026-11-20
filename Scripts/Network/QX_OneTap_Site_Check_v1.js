/* QX One-Tap Site Check V1.1 — stable URL, 3 rounds
 * Read-only HTTP response checks via current Quantumult X routing.
 * No MITM, credentials, telemetry, speedtest downloads or proxy changes.
 * Average = mean of successful rounds; jitter = max-min successful times.
 */
const targets=[
 {group:'国内',name:'百度',url:'https://www.baidu.com/'},
 {group:'国内',name:'腾讯',url:'https://www.qq.com/'},
 {group:'国内',name:'哔哩哔哩',url:'https://www.bilibili.com/'},
 {group:'国外',name:'Google',url:'https://www.google.com/generate_204'},
 {group:'国外',name:'GitHub',url:'https://github.com/'},
 {group:'国外',name:'YouTube',url:'https://www.youtube.com/'},
 {group:'国外',name:'Cloudflare',url:'https://www.cloudflare.com/cdn-cgi/trace'}
];
const ROUNDS=3,started=Date.now();
function check(t){
 const start=Date.now();
 return $task.fetch({url:t.url,method:'GET',headers:{'User-Agent':'Mozilla/5.0 QX-Site-Check/1.1','Cache-Control':'no-cache'},timeout:6000})
 .then(r=>{const code=Number(r.statusCode||r.status||0);return {ok:code>=200&&code<400,code:code,ms:Date.now()-start};})
 .catch(e=>({ok:false,code:0,ms:Date.now()-start,error:String(e).slice(0,70)}));
}
function round(){return Promise.all(targets.map(check));}
let runs=[];
function runNext(){
 if(runs.length===ROUNDS)return report();
 return round().then(r=>{runs.push(r);return runNext();});
}
function report(){
 const lines=['连续 '+ROUNDS+' 轮 · HTTP响应检测'];
 for(const group of ['国内','国外']){
  lines.push('【'+group+'】');
  targets.forEach((t,i)=>{
   if(t.group!==group)return;
   const samples=runs.map(r=>r[i]),good=samples.filter(s=>s.ok),count=good.length;
   if(!count){lines.push('❌ '+t.name+' 0/'+ROUNDS+' 全部失败');return;}
   const ms=good.map(s=>s.ms),avg=Math.round(ms.reduce((a,b)=>a+b,0)/count),jitter=Math.max(...ms)-Math.min(...ms);
   const warn=count<ROUNDS||avg>1000||jitter>500;
   lines.push((warn?'⚠️':'✅')+' '+t.name+' '+count+'/'+ROUNDS+' 均'+avg+'ms 波动'+jitter+'ms');
  });
 }
 const successes=runs.reduce((n,r)=>n+r.filter(s=>s.ok).length,0);
 lines.push('成功 '+successes+'/'+(targets.length*ROUNDS)+'；总耗时 '+((Date.now()-started)/1000).toFixed(1)+'s');
 lines.push('波动=max-min；仅测HTTP响应，不代表带宽或实际出口。');
 const msg=lines.join('\n');console.log(msg);$notify('QX 国内国外一键检测 V1.1','',msg);$done();
}
runNext().catch(e=>{console.log(String(e));$notify('QX 一键检测异常','',String(e));$done();});
