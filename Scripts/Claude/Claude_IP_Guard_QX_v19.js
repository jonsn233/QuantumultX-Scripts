/**
 * Claude IP Guard v19.0 — Quantumult X UIAction.
 * Release preparation branch. Compact native dialog validated on iPhone.
 * Read-only, selected-node policy mandatory, no Claude credentials.
 */
(function () {
  "use strict";
  var VERSION = "19.0.0";
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
  function brief(value, max) {
    var s=text(value).replace(/[\r\n\t]+/g," ").trim();
    return s.length > max ? s.slice(0,max-1)+"…" : s;
  }
  function finish(title, message) {
    $done({title:"Claude IP Guard · v19",message:brief(title,60)+"\n"+text(message).slice(0,680)});
  }
  var tag = selectedTag();
  if (!tag) {
    finish("未选择节点","请长按具体节点启动。未发送请求。");
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
      var lines=[
        "节点："+brief(tag,64),
        "出口："+(ip || "未确认"),
        "双源："+(agreed ? "一致" : "未确认"),
        "归属："+(g.ok ? [g.data.country,g.data.region].filter(Boolean).join(" / ") : "未知"),
        "历史："+(h ? (h.saved ? "已保存，累计"+h.state.count+"次，变化"+h.state.changes+"次" : "保存失败") : "未保存"),
        "信誉数据："+(reputation ? REP_SOURCES.filter(function(k){return reputation[k].status==="ok";}).length+"/4 家可用" : "未查询"),
        "耗时："+(Date.now()-start)+"ms"
      ];
      if (!agreed) {
        lines.push("ipify："+brief(a.ok?a.data:a.error,80));
        lines.push("icanhazip："+brief(b.ok?b.data:b.error,80));
      }
      if (g.ok && g.data.source==="ipapi.co") lines.push("归属：备用来源");
      lines.push("注：信誉数据≠Claude封号风险");
      lines.push("版本："+VERSION);
      var summary=lines.join("\n");
      finish("Claude IP Guard · 节点出口",summary);
    });
  }).catch(function(err){
    finish("检测异常",text(err && err.message || "未知异常"));
  });
})();
