/**
 * Claude IP Guard v19.0 engine candidate — Quantumult X UIAction.
 * Development branch only. Not yet device-validated.
 * Read-only, selected-node policy mandatory, no Claude credentials.
 */
(function () {
  "use strict";
  var VERSION = "19.0-release-candidate-2";
  var TIMEOUT_MS = 6500;
  var HISTORY_LIMIT = 30;
  var A = "https://api.ipify.org?format=json";
  var B = "https://ipv4.icanhazip.com/";
  var GEO = "https://ipwho.is/";
  var GEO_BACKUP = "https://ipapi.co/";
  var REP_OK_TTL = 6 * 60 * 60 * 1000;
  var REP_FAIL_TTL = 60 * 1000;
  var REP_SOURCES = ["ippure","ipapi","ip2location","scamalytics"];
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

  function readLegacy(tag) {
    var encoded=encodeURIComponent(tag);
    if (encoded.length>180) return {state:null,note:"标签过长，旧版记录不导入"};
    try {
      var raw=$prefs.valueForKey("ClaudeIPGuard.v17.history."+encoded);
      if (!raw) return {state:null,note:null};
      var v=JSON.parse(raw);
      if (!v || v.version!==1 || !Array.isArray(v.records)) return {state:null,note:"旧版格式不兼容"};
      var records=v.records.filter(function(rec) {
        return rec && ip4(rec.ip) && typeof rec.at==="string" && !isNaN(Date.parse(rec.at));
      }).map(function(rec) {return {ip:rec.ip,at:rec.at};}).slice(-HISTORY_LIMIT);
      var last=v.last && ip4(v.last.ip) && typeof v.last.at==="string" &&
        !isNaN(Date.parse(v.last.at)) ? {ip:v.last.ip,at:v.last.at} :
        (records.length?records[records.length-1]:null);
      if (!last) return {state:null,note:"旧版没有有效记录"};
      var count=Number(v.count),changes=Number(v.changes);
      return {state:{schema:2,count:isFinite(count)?Math.max(records.length,Math.floor(count)):records.length,
        changes:isFinite(changes)?Math.max(0,Math.floor(changes)):0,last:last,records:records},
        note:"旧版历史已导入，原数据未修改"};
    } catch (_) {return {state:null,note:"旧版历史读取失败"};}
  }
  function history(tag, ip) {
    var key = historyKey(tag), state = {schema:2,count:0,changes:0,last:null,records:[]};
    var migrationNote=null;
    try {
      var raw = $prefs.valueForKey(key);
      if (!raw) {
        var imported=readLegacy(tag);
        migrationNote=imported.note;
        if (imported.state) state=imported.state;
      }
      if (raw) {
        var old = JSON.parse(raw);
        if (old && old.schema === 2 && Array.isArray(old.records)) {
          state.count = Math.max(0, Number(old.count) || 0);
          state.changes = Math.max(0, Number(old.changes) || 0);
          state.last = old.last && ip4(old.last.ip) && typeof old.last.at === "string" && !isNaN(Date.parse(old.last.at)) ? old.last : null;
          state.records = old.records.filter(function(rec){ return rec && ip4(rec.ip) && typeof rec.at === "string" && !isNaN(Date.parse(rec.at)); }).slice(-HISTORY_LIMIT);
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
      return {saved:saved,previous:previous,changed:!!previous && previous !== ip,state:state,migrationNote:migrationNote,
        error:saved ? null : "本地写入未确认"};
    } catch (_) { return {saved:false,previous:previous,state:state,migrationNote:migrationNote,error:"本地写入失败"}; }
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

  function score(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }
  function json(body) {
    var d = JSON.parse(text(body).replace(/^\uFEFF/,""));
    if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("JSON 结构无效");
    return d;
  }
  function reputationKey(ip, provider) {
    return "ClaudeIPGuard.v19.rep." + ip + "." + provider;
  }
  function readRep(ip, provider) {
    try {
      var raw = $prefs.valueForKey(reputationKey(ip,provider));
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || v.schema !== 2 || v.ip !== ip || v.provider !== provider ||
          !v.at || !v.item || (v.item.status !== "ok" && v.item.status !== "unavailable")) return null;
      var age = Date.now() - Number(v.at);
      var ttl = v.item.status === "ok" ? REP_OK_TTL : REP_FAIL_TTL;
      if (age < 0 || age > ttl) return null;
      return {status:v.item.status,score:v.item.score===undefined?null:v.item.score,
        raw:v.item.raw||null,usageType:v.item.usageType||null,error:v.item.error||null,
        checkedAt:v.item.checkedAt||null,cached:true};
    } catch (_) { return null; }
  }
  function writeRep(ip,provider,item) {
    try {
      $prefs.setValueForKey(JSON.stringify({
        schema:2,ip:ip,provider:provider,at:Date.now(),item:item
      }),reputationKey(ip,provider));
    } catch (_) { /* cache failure never fails detection */ }
  }
  function parseIP2(body,ip) {
    var html=text(body);
    if (html.indexOf(ip)<0) throw new Error("页面未包含目标 IP");
    if (/Attention Required|access denied|cf-error-details/i.test(html)) throw new Error("目标站点拒绝访问");
    var usage=html.match(/Usage\s*Type<\/label>\s*<p[^>]*>\s*\(?([A-Z]+(?:\/[A-Z]+)*)/i);
    var fraud=html.match(/Fraud\s*Score<\/label>\s*<p[^>]*>\s*(\d+(?:\.\d+)?)/i);
    var n=fraud?score(fraud[1]):null;
    if (!usage && n===null) throw new Error("没有可验证的评分或用途字段");
    return {score:n,usageType:usage?usage[1].toUpperCase():null};
  }
  function parseScam(body,ip) {
    var html=text(body);
    if (html.indexOf(ip)<0) throw new Error("页面未包含目标 IP");
    if (/Attention Required|access denied|cf-error-details/i.test(html)) throw new Error("目标站点拒绝访问");
    var m=html.match(/Fraud\s*Score\b[\s\S]{0,300}?(\d{1,3})/i);
    var n=m?score(m[1]):null;
    if (n===null) throw new Error("Fraud Score 无效或缺失");
    return {score:n};
  }
  function repQuery(provider,ip,policy) {
    var url, parser;
    if (provider === "ippure") {
      url="https://my.ippure.com/v1/info";
      parser=function(body) {
        var d=json(body);
        if (d.ip !== ip) throw new Error("IPPure 返回 IP 不匹配或缺失");
        var n=score(d.fraudScore);
        if (n===null) throw new Error("IPPure 未提供有效 fraudScore");
        return {score:n};
      };
    } else if (provider === "ipapi") {
      url="https://api.ipapi.is/?q="+encodeURIComponent(ip);
      parser=function(body) {
        var d=json(body);
        if (d.ip !== ip) throw new Error("ipapi.is 返回 IP 不匹配或缺失");
        var raw=d.company && d.company.abuser_score;
        if (raw===undefined || raw===null || raw==="") throw new Error("缺少 abuser_score");
        return {raw:text(raw)};
      };
    } else if (provider === "ip2location") {
      url="https://www.ip2location.io/"+encodeURIComponent(ip);
      parser=function(body){return parseIP2(body,ip);};
    } else {
      url="https://scamalytics.com/ip/"+encodeURIComponent(ip);
      parser=function(body){return parseScam(body,ip);};
    }
    return get(url,policy,parser).then(function(r) {
      var item=r.ok ? {status:"ok",score:r.data.score===undefined?null:r.data.score,
        raw:r.data.raw||null,usageType:r.data.usageType||null,error:null,checkedAt:new Date().toISOString(),cached:false} :
        {status:"unavailable",score:null,raw:null,usageType:null,error:r.error,checkedAt:new Date().toISOString(),cached:false};
      writeRep(ip,provider,item);
      return item;
    });
  }
  function collectRep(ip,policy) {
    return Promise.all(REP_SOURCES.map(function(provider) {
      var cached=readRep(ip,provider);
      return cached ? Promise.resolve(cached) : repQuery(provider,ip,policy);
    })).then(function(items) {
      var out={};
      REP_SOURCES.forEach(function(k,i){out[k]=items[i];});
      return out;
    });
  }
  function row(k,v) { return '<div class="r"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>'; }
  function finish(title, html) {
    $done({title:"Claude IP Guard · v19",htmlMessage:
      '<html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<style>body{font:-apple-system-body;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1e293b;margin:0;padding:calc(28px + env(safe-area-inset-top, 0px)) 18px calc(24px + env(safe-area-inset-bottom, 0px));background:#f8fafc}'+
      'h2{font-size:18px;margin:0 0 12px;padding-top:8px}h3{font-size:14px;color:#315d93;margin:16px 0 8px}'+
      '.ip{font-size:29px;font-weight:750;letter-spacing:-.6px;overflow-wrap:anywhere;margin:10px 0}'+
      '.sub{color:#64748b;font-size:12px;line-height:1.5}.r{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:13px}'+
      '.r span{color:#64748b;flex:0 0 42%}.r b{font-weight:600;text-align:right;overflow-wrap:anywhere}'+
      '.ok{color:#138451}.warn{color:#aa5d13}.bad{color:#bd3030}'+
      '.ip{padding:16px;border-radius:14px;background:#eaf2ff;border:1px solid #d6e4fa}'+
      'h3{border-left:3px solid #3b82f6;padding-left:9px}.r{background:#fff;padding:10px 12px}'+
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
    var rep = agreed ? collectRep(ip,tag) : Promise.resolve(null);
    return Promise.all([geo,rep]).then(function(results) {
      var g=results[0], reputation=results[1];
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
      summary+='<h3>第三方信誉（各平台独立）</h3>';
      if (reputation) {
        REP_SOURCES.forEach(function(k) {
          var v=reputation[k], label={ippure:"IPPure",ipapi:"ipapi.is",ip2location:"IP2Location",scamalytics:"Scamalytics"}[k];
          var value=v.status==="ok" ?
            (v.score!==null?v.score+"/100":v.raw||v.usageType||"有效字段") :
            "不可用 · "+v.error;
          summary+=row(label,value+(v.cached?" · 缓存":" · 实时"));
        });
      } else summary+=row("信誉查询","双源未一致，跳过");
      summary+='<h3>节点历史</h3>'+
        row("保存结果",h?(h.saved?"成功":h.error):"双源未一致，不保存")+
        row("有效采样",h?h.state.count:"—")+
        row("IP 变化次数",h?h.state.changes:"—")+
        row("上次出口",h?(h.previous || "首次记录"):"—")+
        row("历史兼容",h?(h.migrationNote || "v19 独立记录"):"—");
      if (h && h.state.records.length) {
        summary+='<h3>最近采样</h3>';
        h.state.records.slice(-5).reverse().forEach(function(rec) {
          summary+=row(rec.at.slice(0,19).replace("T"," "),rec.ip);
        });
      }
      summary+='<h3>检测说明</h3><p class="sub">本候选版仅验证所选节点的代理出口、归属和本地历史。归属查询在主源失败后尝试备用来源；备用来源也可能限流。'+
        'IP 归属服务失败不会影响双源出口结论。历史按节点标签隔离；同名节点可能复用历史。'+
        '此 IP 不代表 Claude 服务端确认的地址，不能用于判断账号封禁风险。'+
        '信誉查询仅展示第三方原始字段，不合并安全分数；缓存成功数据 6 小时，失败结果 1 分钟。</p>'+
        '<p class="sub">总耗时 '+(Date.now()-start)+' ms · '+esc(VERSION)+' · 未经真机验收</p>';
      finish("Claude IP Guard · 节点出口",summary);
    });
  }).catch(function(err){
    finish("检测异常",'<p class="bad">'+esc(err && err.message || "未知异常")+'</p>');
  });
})();
