/* Quantumult X V3.1 trial: read-only health + privacy rule inventory + one-tap dashboard.
 * Does not inspect other apps' live traffic, change policies, enable MitM, or upload logs.
 * Uses $task.fetch, $prefs and event-interaction's $done({htmlMessage}).
 */
(function () {
  "use strict";
  var VERSION = "3.1.0";
  var ROOT = "https://raw.githubusercontent.com/jonsn233/QuantumultX-Scripts/main/";
  var PARAMS = String((typeof $environment !== "undefined" && $environment.sourcePath) || "");
  var MODE = /(?:#|&)mode=(health|privacy|all)(?:&|$)/.exec(PARAMS);
  MODE = MODE ? MODE[1] : "all";
  var TESTS = [
    {name:"ChatGPT",url:"https://chatgpt.com/"},
    {name:"Claude",url:"https://claude.ai/"},
    {name:"Gemini",url:"https://gemini.google.com/"},
    {name:"Google",url:"https://www.google.com/generate_204"},
    {name:"GitHub",url:"https://github.com/"},
    {name:"百度",url:"https://www.baidu.com/"}
  ];
  var started = Date.now();
  function str(x) { return x === undefined || x === null ? "" : String(x); }
  function esc(x) { return str(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function req(url) {
    var ts = Date.now();
    return Promise.resolve().then(function(){
      return $task.fetch({
        url:url,method:"GET",
        headers:{"User-Agent":"QuantumultX-V3.1-Trial","Cache-Control":"no-cache","Accept":"application/json, text/plain, */*"},
        opts:{"auto-cookie":false,"skip-cert-verify":false}
      });
    }).then(function(r){
      return {code:Number((r && (r.statusCode || r.status)) || 0), ms:Date.now()-ts, body:str(r && r.body)};
    },function(err){
      return {code:0,ms:Date.now()-ts,error:str(err && (err.message || err)).slice(0,110),body:""};
    });
  }
  function classify(code) {
    if (code >= 200 && code < 400) return {label:"可达",color:"#15803d",weight:1};
    if (code === 401 || code === 403 || code === 429) return {label:"已响应/受限",color:"#b45309",weight:0.5};
    if (code >= 400 && code < 500) return {label:"HTTP错误",color:"#b45309",weight:0.25};
    return {label:"不可用",color:"#b91c1c",weight:0};
  }
  function validIP(ip) {
    var x = str(ip).trim();
    if (x.length > 45 || !/^[a-fA-F0-9:.]+$/.test(x)) return false;
    if (x.indexOf(":") >= 0) return x.split(":").length >= 3;
    var parts=x.split(".");
    return parts.length===4 && parts.every(function(p){return /^(0|[1-9][0-9]{0,2})$/.test(p) && Number(p)<=255;});
  }
  function publicIP() {
    return req("https://api.ipify.org?format=json").then(function(r){
      var ip="";
      try {ip = JSON.parse(r.body).ip;} catch(e) {}
      if (validIP(ip)) return {ip:ip,source:"api.ipify.org"};
      return req("https://www.cloudflare.com/cdn-cgi/trace").then(function(b){
        var match=/^ip=([^\r\n]+)/m.exec(b.body);
        return match && validIP(match[1]) ? {ip:match[1],source:"Cloudflare trace"} : {ip:"未知",source:"查询失败"};
      });
    });
  }
  function ipHistory(ip) {
    if (!validIP(ip)) return "出口记录未更新";
    var key="QX.V31.Trial.LastObservedIP",prev="";
    try {prev=str($prefs.valueForKey(key));} catch(e) {}
    var changed=validIP(prev) && prev!==ip;
    try {$prefs.setValueForKey(ip,key);} catch(e) {}
    return changed ? "与本设备上次记录不同（可能是换网或切换节点）" : (prev===ip ? "与本设备上次记录一致" : "首次记录本设备出口 IP");
  }
  function health() {
    return Promise.all([Promise.all(TESTS.map(function(t){return req(t.url);})),publicIP()]).then(function(all){
      var results=all[0],ip=all[1],pass=0,points=0,rows=[];
      results.forEach(function(r,i){
        var s=classify(r.code);points+=s.weight;if(s.weight===1)pass++;
        rows.push('<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #e5e7eb"><span>'+esc(TESTS[i].name)+'</span><span style="color:'+s.color+'">'+s.label+' · '+(r.code||"ERR")+' · '+r.ms+'ms</span></div>');
      });
      var score=Math.round(points/TESTS.length*100);
      var bg=score>=80?"#15803d":score>=55?"#b45309":"#b91c1c";
      var heading='<div style="background:#f1f5f9;border-radius:12px;padding:12px;margin:8px 0"><strong style="font-size:26px;color:'+bg+'">'+score+'/100</strong> <span style="font-size:12px;color:#475569">HTTP 响应参考分 · '+pass+'/'+TESTS.length+' 正常</span></div>';
      var note='<p style="font-size:12px;color:#64748b">检测按当前 QX 路由发起；HTTP 耗时并非 ping/带宽，登录页返回 403/429 不等于代理故障，也不能证明各 AI 应用实际出口。</p>';
      return '<h3 style="margin:8px 0">🌐 网络体检</h3>'+heading+rows.join("")+
        '<p style="font-size:13px">本次公共查询出口：<strong>'+esc(ip.ip)+'</strong> <span style="color:#64748b">('+esc(ip.source)+')</span></p>'+
        '<p style="font-size:12px;color:#475569">'+esc(ipHistory(ip.ip))+'</p>'+note;
    });
  }
  function auditRules() {
    var report=ROOT+"Rules/Adblock/Experiments/QX-V2.8-Aggressive-Report.json";
    var pilot=ROOT+"Rules/Adblock/QX-Adblock-Candidate.list";
    return Promise.all([req(report),req(pilot)]).then(function(r){
      var html='<h3 style="margin:12px 0 8px">🛡️ 隐私与广告规则审计</h3>';
      try {
        var data=JSON.parse(r[0].body);
        var included=Number(data.included),excluded=Number(data.excluded),total=Number(data.candidates);
        if (![included,excluded,total].every(function(n){return isFinite(n)&&n>=0;}) || included+excluded!==total) throw new Error("计数不一致");
        html+='<div style="background:#eff6ff;border-radius:12px;padding:12px"><strong>仓库发布报告</strong><div style="padding-top:6px">候选 '+total+' 条 · 保留 '+included+' 条 · 剔除 '+excluded+' 条</div><div style="font-size:12px;color:#475569;padding-top:5px">报告设备验证：'+(data.device_tested===true?"已标记":"尚未标记为已完成")+'</div></div>';
      } catch(e) {html+='<p style="color:#b45309">发布报告不可用，无法确认规则统计。</p>';}
      var hosts=[],lines=r[1].body.split(/\r?\n/);
      lines.forEach(function(line){
        var m=/^host(?:-suffix)?,([^,\s]+),reject\s*$/i.exec(line.trim());
        if(m)hosts.push(m[1].toLowerCase());
      });
      if(r[1].code>=200 && r[1].code<300){
        var seen={},unique=hosts.filter(function(h){if(seen[h])return false;seen[h]=true;return true;});
        html+='<p style="font-size:13px">独立候选清单：<strong>'+unique.length+'</strong> 个去重广告域名（仅统计，不代表已在手机启用）。</p>';
        html+='<p style="font-size:12px;color:#475569">候选示例：'+esc(unique.slice(0,4).join("、")||"无")+'</p>';
      } else {html+='<p style="color:#b45309">候选清单读取失败。</p>';}
      html+='<p style="font-size:12px;color:#64748b">这不是手机实时抓包、实际 REJECT 次数或已拦截数量。真实追踪请求请在圈 X「活动/请求记录」按域名查看，勿将含令牌的完整 URL 发布到公开仓库。</p>';
      return html;
    });
  }
  function finish(parts) {
    var body='<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a;line-height:1.55;font-size:14px;max-width:520px">'+
      '<div style="font-size:12px;color:#64748b">Quantumult X · V'+VERSION+' · 只读试用</div>'+
      parts.join('')+'<p style="border-top:1px solid #e2e8f0;padding-top:8px;font-size:11px;color:#64748b">耗时 '+((Date.now()-started)/1000).toFixed(1)+'s · 无 MitM · 不修改节点/策略 · 不上传本机日志</p></div>';
    console.log("QX V3.1 trial finished: mode="+MODE+" duration="+(Date.now()-started)+"ms");
    $done({title:"QX V3.1 网络控制中心",htmlMessage:body});
  }
  var jobs=[];
  if(MODE!=="privacy")jobs.push(health().catch(function(e){return '<p>网络体检异常：'+esc(e && e.message)+'</p>';}));
  if(MODE!=="health")jobs.push(auditRules().catch(function(e){return '<p>规则审计异常：'+esc(e && e.message)+'</p>';}));
  Promise.all(jobs).then(finish,function(e){$done({title:"QX V3.1 运行异常",message:str(e && e.message)});});
})();