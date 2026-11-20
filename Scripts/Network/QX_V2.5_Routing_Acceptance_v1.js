/* Quantumult X V2.5 read-only routing acceptance, v1.0
 * Checks reachability, latency and observed exit IP. Does NOT claim QX policy hits.
 * No MitM, no credentials, no config changes; 1 request per endpoint.
 */
const targets=[
 {name:"ChatGPT",url:"https://chatgpt.com/",expect:"AI-OpenAI"},
 {name:"Claude",url:"https://claude.ai/",expect:"AI-Claude"},
 {name:"Gemini",url:"https://gemini.google.com/",expect:"AI-Gemini"},
 {name:"YouTube",url:"https://www.youtube.com/",expect:"Intl-YouTube"},
 {name:"GitHub",url:"https://github.com/",expect:"Intl-GitHub"},
 {name:"Telegram",url:"https://web.telegram.org/",expect:"Intl-General"},
 {name:"百度",url:"https://www.baidu.com/",expect:"DIRECT"},
 {name:"哔哩哔哩",url:"https://www.bilibili.com/",expect:"DIRECT"}
];
const timeout=8000;
function req(url){const t=Date.now();return $task.fetch({url,method:"GET",timeout,headers:{"Cache-Control":"no-cache","User-Agent":"Mozilla/5.0 QX-Acceptance/1.0"}}).then(r=>({code:Number(r.statusCode||r.status||0),ms:Date.now()-t,body:r.body||""})).catch(e=>({code:0,ms:Date.now()-t,error:String(e).slice(0,70)}));}
function good(code){return code>=200&&code<400;}
function status(code){return good(code)?"✅":code===403||code===429?"⚠️":"❌";}
function exitCheck(){return req("https://api.ipify.org?format=json").then(r=>{let ip="unknown";try{const v=JSON.parse(r.body);if(typeof v.ip==="string"&&/^[0-9a-fA-F:.]+$/.test(v.ip))ip=v.ip;}catch(e){}return {ip,code:r.code};});}
Promise.all([Promise.all(targets.map(t=>req(t.url))),exitCheck()]).then(([results,exit])=>{
 const lines=["V2.5 合并规则验收 · 只读","【HTTP 可达性｜当前 QX 路由】"];
 targets.forEach((t,i)=>{const r=results[i];lines.push(status(r.code)+" "+t.name+" HTTP "+r.code+" / "+r.ms+"ms");});
 lines.push("【出口 IP】","观察到的公共出口："+exit.ip+" (HTTP "+exit.code+")");
 lines.push("【预期策略｜需在 QX 请求记录核实】");
 targets.forEach(t=>lines.push(t.name+" → "+t.expect));
 lines.push("⚠️ 仅测通断及 ipify 请求出口；不证明各应用策略命中、国内直连或 AI 独立出口。");
 const msg=lines.join("\n");console.log(msg);$notify("QX V2.5 分流验收", "",msg);$done();
}).catch(e=>{console.log("Audit failed: "+String(e));$done();});
