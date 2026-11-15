/**
 * Claude IP Guard v19.0 engine candidate — Quantumult X UIAction.
 * Development branch only. Not yet device-validated.
 * Read-only, selected-node policy mandatory, no Claude credentials.
 */
(function () {
  "use strict";
  var VERSION = "19.0-geo-fallback-candidate";
  var TIMEOUT_MS = 6500;
  var HISTORY_LIMIT = 30;
  var A = "https://api.ipify.org?format=json";
  var B = "https://ipv4.icanhazip.com/";
  var GEO = "https://ipwho.is/";
  var GEO_BACKUP = "https://ipapi.co/";
  var start = Date.now();
  function text(v) { return v === undefined || v === null ? "" : String(v); }
  function esc(v) { return text(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function ip4(v) {
    if (typeof v !== "string") return false;
    var p = v.trim().split(".");
    return p.length === 4 && p.every(function (x) {
      return /^(0|[1-9][0-9]{0,2})$/.test(x) && Number(x) <= 255;
    });
  }
  function parseEcho(raw) {
    var s = text(raw).replace(/^\uFEFF/,"").trim();
    try {
      var obj = JSON.parse(s);
      if (typeof obj === "string") s = obj.trim();
      else if (obj && !Array.isArray(obj) && typeof obj.ip === "string") s = obj.ip.trim();
    } catch (_) { /* strict plain IPv4 fallback */ }
    if (!ip4(s)) throw new Error("返回内容不是有效 IPv4");
    return s;
  }
  function get(url, policy, parse) {
    return new Promise(function (resolve) {
      var finished = false;
      var timer = setTimeout(function () { end({ ok:false, status:"timeout", error:"请求超时" }); }, TIMEOUT_MS);
      function end(value) { if (finished) return; finished = true; clearTimeout(timer); resolve(value); }
      var t0 = Date.now();
      try {
        Promise.resolve($task.fetch({
          url:url, method:"GET",
          headers:{"Accept":"application/json, text/plain;q=0.9"},
          opts:{"policy":policy,"redirection":true,"skip-cert-verify":false,"auto-cookie":false}
        })).then(function (res) {
          var status = res && Number(res.statusCode);
          if (!(status >= 200 && status < 300)) {
            end({ok:false,status:"http",code:status || null,error:"HTTP " + (status || "无响应")}); return;
          }
          if (!res || typeof res.body !== "string" || !res.body.trim()) {
            end({ok:false,status:"empty",error:"响应为空"}); return;
          }
          try {
            end({ok:true,status:"ok",code:status,data:parse(res.body),latencyMs:Date.now()-t0});
          } catch (err) {
            end({ok:false,status:"parse",error:text(err && err.message) || "解析失败"});
          }
        }, function (err) {
          end({ok:false,status:"network",error:text(err && err.message) || "网络请求失败"});
        });
      } catch (err) { end({ok:false,status:"request",error:text(err && err.message) || "请求启动失败"}); }
    });
  }
  function selectedTag() {
    try {
      var v = $environment.params;
      return typeof v === "string" ? v.trim() : "";
    } catch (_) { return ""; }
  }
  function historyKey(tag) { return "ClaudeIPGuard.v19.history." + encodeURIComponent(tag); }
  function history(tag, ip) {
    var key = historyKey(tag), state = {schema:2,count:0,changes:0,last:null,records:[]};
    try {
      var raw = $prefs.valueForKey(key);
      if (raw) {
        var old = JSON.parse(raw);
        if (old && old.schema === 2 && Array.isArray(old.records)) {
          state.count = Math.max(0, Number(old.count) || 0);
          state.changes = Math.max(0, Number(old.changes) || 0);
          state.last = old.last || null;
          state.records = old.records.slice(-HISTORY_LIMIT);
        }
      }
    } catch (_) { return {saved:false,error:"历史读取失败",state:state}; }
    var previous = state.last && state.last.ip || null;
    if (previous && previous !== ip) state.changes++;
    state.count++;
    state.last = {ip:ip,at:new Date().toISOString()};
    state.records.push(state.last);
    state.records = state.records.slice(-HISTORY_LIMIT);
    try {
      var saved = $prefs.setValueForKey(JSON.stringify(state),key) === true;
      return {saved:saved,previous:previous,changed:!!previous && previous !== ip,state:state,
        error:saved ? null : "本地写入未确认"};
    } catch (_) { return {saved:false,previous:previous,state:state,error:"本地写入失败"}; }
  }
  function geoParse(body, expected) {
    var d = JSON.parse(text(body).replace(/^\uFEFF/,""));
    if (!d || d.success !== true || d.ip !== expected) throw new Error("归属查询结果未匹配目标 IP");
    var c = d.connection || {};
    return {country:d.country || null,region:d.region || null,city:d.city || null,
      asn:c.asn === undefined ? null : text(c.asn),org:c.org || null,isp:c.isp || null,
      source:"ipwho.is"};
  }
  function geoBackupParse(body, expected) {
    var d = JSON.parse(text(body).replace(/^\uFEFF/,""));
    if (!d || d.error || d.ip !== expected) throw new Error("备用归属查询失败或 IP 不匹配");
    if (!d.country_name && !d.asn && !d.org) throw new Error("备用归属数据为空");
    return {country:d.country_name || null,region:d.region || null,city:d.city || null,
      asn:d.asn === undefined ? null : text(d.asn),org:d.org || null,isp:null,
      source:"ipapi.co"};
  }
  function geoWithFallback(ip, policy) {
    return get(GEO+encodeURIComponent(ip),policy,function(body){return geoParse(body,ip);})
      .then(function(primary){
        if (primary.ok) return {ok:true,data:primary.data,primary:primary,backup:null};
        return get(GEO_BACKUP+encodeURIComponent(ip)+"/json/",policy,function(body){
          return geoBackupParse(body,ip);
        }).then(function(backup){
          return backup.ok ? {ok:true,data:backup.data,primary:primary,backup:backup} :
            {ok:false,status:"unavailable",error:"主源 "+primary.error+"；备用 "+backup.error,
             primary:primary,backup:backup};
        });
      });
  }
  function row(k,v) { return '<div class="r"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>'; }
  function finish(title, html) {
    $done({title:"Claude IP Guard · v19",htmlMessage:
      '<html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<style>body{font:-apple-system-body;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1e293b;margin:0;padding:18px;background:#f8fafc}'+
      'h2{font-size:18px;margin:0 0 12px}h3{font-size:14px;color:#315d93;margin:16px 0 8px}'+
      '.ip{font-size:29px;font-weight:750;letter-spacing:-.6px;overflow-wrap:anywhere;margin:10px 0}'+
      '.sub{color:#64748b;font-size:12px;line-height:1.5}.r{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:13px}'+
      '.r span{color:#64748b;flex:0 0 42%}.r b{font-weight:600;text-align:right;overflow-wrap:anywhere}'+
      '.ok{color:#138451}.warn{color:#aa5d13}.bad{color:#bd3030}'+
      '</style></head><body><h2>'+esc(title)+'</h2>'+html+'</body></html>'});
  }
  var tag = selectedTag();
  if (!tag) {
    finish("未选择节点",'<p class="bad">请从 Quantumult X 长按具体节点启动。未收到节点标签，已停止，未发送检测请求。</p>');
    return;
  }
  Promise.all([get(A,tag,parseEcho),get(B,tag,parseEcho)]).then(function (pair) {
    var a=pair[0],b=pair[1],agreed=a.ok && b.ok && a.data===b.data;
    var ip=agreed ? a.data : null;
    var h=agreed ? history(tag,ip) : null;
    var geo=agreed ? geoWithFallback(ip,tag) :
      Promise.resolve({ok:false,status:"skipped",error:"双源未一致，跳过归属查询"});
    return geo.then(function(g) {
      var summary='<div class="sub">检测节点：'+esc(tag)+'</div>'+
        '<div class="ip">'+esc(ip || "出口未确认")+'</div>'+
        '<div class="'+(agreed?"ok":"bad")+'">'+(agreed?"● 双来源一致":"● 双来源未确认")+'</div>';
      summary+='<h3>出口证据</h3>'+
        row("ipify",a.ok?a.data:"不可用 · "+a.error)+
        row("icanhazip",b.ok?b.data:"不可用 · "+b.error)+
        row("双源结论",agreed?"一致":"不一致 / 无法确认");
      summary+='<h3>IP 归属</h3>'+
        row("国家 / 地区",g.ok?[g.data.country,g.data.region,g.data.city].filter(Boolean).join(" / "):"不可用")+
        row("ASN",g.ok?(g.data.asn || "未知"):"未知")+
        row("运营商",g.ok?(g.data.org || g.data.isp || "未知"):"未知")+
        row("归属数据来源",g.ok?g.data.source:"不可用 · "+g.error)+
        row("主源状态",g.primary?(g.primary.ok?"正常":g.primary.error):"未查询")+
        row("备用状态",g.backup?(g.backup.ok?"正常":g.backup.error):"未触发");
      summary+='<h3>节点历史</h3>'+
        row("保存结果",h?(h.saved?"成功":h.error):"双源未一致，不保存")+
        row("有效采样",h?h.state.count:"—")+
        row("IP 变化次数",h?h.state.changes:"—")+
        row("上次出口",h?(h.previous || "首次记录"):"—");
      summary+='<h3>检测说明</h3><p class="sub">本候选版仅验证所选节点的代理出口、归属和本地历史。归属查询在主源失败后尝试备用来源；备用来源也可能限流。'+
        'IP 归属服务失败不会影响双源出口结论。历史按节点标签隔离；同名节点可能复用历史。'+
        '此 IP 不代表 Claude 服务端确认的地址，不能用于判断账号封禁风险。'+
        '第三方信誉模块将在后续阶段接入。</p>'+
        '<p class="sub">总耗时 '+(Date.now()-start)+' ms · '+esc(VERSION)+' · 未经真机验收</p>';
      finish("Claude IP Guard · 节点出口",summary);
    });
  }).catch(function(err){
    finish("检测异常",'<p class="bad">'+esc(err && err.message || "未知异常")+'</p>');
  });
})();
