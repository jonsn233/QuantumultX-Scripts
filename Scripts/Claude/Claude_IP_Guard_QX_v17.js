/**
 * Claude IP Guard v17.0 — node-aware, manual UIAction task.
 *
 * Trigger: long-press an individual Quantumult X server node.
 * Quantumult X passes the selected server tag in $environment.params.
 * Every HTTP request below explicitly uses that exact policy.
 *
 * Safety:
 * - No default/fallback policy. Missing selected node => stop.
 * - Read-only GET requests only; no account login, cookies, credentials,
 *   MitM, DNS changes, routing/config mutation, notifications or schedules.
 * - Two independent IPv4 echo providers must agree before history is saved.
 * - History stores only timestamps and IPs, separately per selected node.
 *
 * Requires Quantumult X event-interaction support and a build that passes
 * UIAction params as documented by the official sample-fetch-opts-policy.js.
 */
(function () {
  "use strict";

  var VERSION = "17.2";
  var TIMEOUT_MS = 12000;
  var MAX_HISTORY = 20;
  var IPV4_A = "https://api.ipify.org?format=json";
  var IPV4_B = "https://ipv4.icanhazip.com/";
  var LOOKUP = "https://ipwho.is/";
  var startedAt = Date.now();

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeText(value) {
    return value === undefined || value === null || value === "" ? "未知" : String(value);
  }

  function isIPv4(value) {
    if (typeof value !== "string") return false;
    var parts = value.trim().split(".");
    return parts.length === 4 && parts.every(function (part) {
      return /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255;
    });
  }

  function parseIPv4(body, mode) {
    var text = String(body || "").replace(/^\uFEFF/, "").trim();
    var ip = "";
    if (mode === "json") {
      var data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.ip !== "string") {
        throw new Error("JSON 返回结构不含有效 ip 字段");
      }
      ip = data.ip.trim();
    } else {
      ip = text;
    }
    if (!isIPv4(ip)) throw new Error("响应不是严格有效的 IPv4 地址");
    return ip;
  }

  function request(url, policy, parser) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        finish({ ok: false, error: "请求超时" });
      }, TIMEOUT_MS);

      function finish(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }

      try {
        Promise.resolve($task.fetch({
          url: url,
          method: "GET",
          headers: { "Accept": "application/json, text/plain;q=0.9" },
          opts: {
            "policy": policy,
            "redirection": true,
            "skip-cert-verify": false,
            "auto-cookie": false
          }
        })).then(function (response) {
          if (!response || Number(response.statusCode) < 200 || Number(response.statusCode) >= 300) {
            finish({ ok: false, error: "HTTP " + (response ? safeText(response.statusCode) : "无响应") });
            return;
          }
          if (typeof response.body !== "string" || !response.body.trim()) {
            finish({ ok: false, error: "响应正文为空或格式异常" });
            return;
          }
          try {
            finish({ ok: true, data: parser(response.body), ms: Date.now() });
          } catch (error) {
            finish({ ok: false, error: error && error.message ? error.message : "响应解析失败" });
          }
        }, function () {
          finish({ ok: false, error: "网络请求失败" });
        });
      } catch (error) {
        finish({ ok: false, error: "请求启动失败" });
      }
    });
  }

  function parseIpify(body) {
    var text = String(body || "").replace(/^\uFEFF/, "").trim();
    // ipify normally returns {"ip":"x.x.x.x"} for format=json.
    // Some QX/network intermediaries may return a plain IPv4 body instead.
    // Accept either representation, but never accept HTML or arbitrary text.
    try {
      var data = JSON.parse(text);
      if (data && typeof data === "object" && !Array.isArray(data) && typeof data.ip === "string") {
        return parseIPv4(data.ip, "text");
      }
      if (typeof data === "string") {
        return parseIPv4(data, "text");
      }
    } catch (error) {
      // Fall through to strict plain-IPv4 validation below.
    }
    return parseIPv4(text, "text");
  }

  function parsePlainIp(body) {
    return parseIPv4(body, "text");
  }

  function lookup(ip, policy) {
    return request(LOOKUP + encodeURIComponent(ip), policy, function (body) {
      var data = JSON.parse(body.replace(/^\uFEFF/, ""));
      if (!data || data.success !== true) throw new Error("IP 归属查询未成功");
      var connection = data.connection || {};
      return {
        ip: data.ip || ip,
        country: data.country || "未知",
        countryCode: data.country_code || "未知",
        region: data.region || "未知",
        city: data.city || "未知",
        asn: connection.asn === undefined ? "未知" : String(connection.asn),
        org: connection.org || "未知",
        isp: connection.isp || "未知",
        type: data.type || "未知"
      };
    });
  }

  function historyKey(policy) {
    return "ClaudeIPGuard.v17.history." + encodeURIComponent(policy).slice(0, 180);
  }

  function updateHistory(policy, ip, agreed) {
    var report = { saved: false, count: 0, changes: 0, previous: "无记录", status: "未保存", records: [] };
    if (!agreed || !isIPv4(ip)) {
      report.status = "双来源未一致，本次不保存";
      return report;
    }

    var key = historyKey(policy);
    var state = { version: 1, count: 0, changes: 0, last: null, records: [] };

    try {
      var raw = $prefs.valueForKey(key);
      var old = raw ? JSON.parse(raw) : null;
      if (old && old.version === 1 && Array.isArray(old.records)) {
        state.count = Math.max(0, Number(old.count) || 0);
        state.changes = Math.max(0, Number(old.changes) || 0);
        state.last = old.last || null;
        state.records = old.records.slice(-MAX_HISTORY);
      }
    } catch (error) {
      report.status = "历史读取失败，本次不保存";
      return report;
    }

    report.previous = state.last && state.last.ip ? state.last.ip : "无记录";
    var changed = !!(state.last && state.last.ip !== ip);
    state.count += 1;
    if (changed) state.changes += 1;

    var record = { ip: ip, at: new Date().toISOString() };
    state.last = record;
    state.records.push(record);
    state.records = state.records.slice(-MAX_HISTORY);

    try {
      report.saved = $prefs.setValueForKey(JSON.stringify(state), key) === true;
    } catch (error) {
      report.saved = false;
    }

    report.count = state.count;
    report.changes = state.changes;
    report.records = state.records.slice(-10);
    report.status = !report.saved ? "写入未确认" : (!changed ? "与上次相同" : "出口 IP 发生变化");
    return report;
  }

  function render(policy, resultA, resultB, intel, history) {
    var both = resultA.ok && resultB.ok;
    var agree = both && resultA.ip === resultB.ip;
    var ip = agree ? resultA.ip : "无法确认";
    var place = intel && intel.ok
      ? safeText(intel.data.country) + " / " + safeText(intel.data.region) + " / " + safeText(intel.data.city)
      : "归属信息不可用";
    var colorGreen = "#18804e";
    var colorAmber = "#b7791f";
    var colorBlue = "#315b90";
    var colorMuted = "#64748b";

    function tile(label, value, sub, color) {
      return '<td width="50%" style="padding:4px;vertical-align:top"><div style="padding:7px 3px;text-align:center;min-height:56px"><div style="font-size:11px;color:#718096">' +
        escapeHtml(label) + '</div><div style="font-size:15px;font-weight:700;color:' + color + '">' +
        escapeHtml(value) + '</div><div style="font-size:10px;color:#94a3b8">' +
        escapeHtml(sub) + '</div></div></td>';
    }
    function row(label, value) {
      return '<tr><td style="padding:5px 2px;color:#718096;font-size:12px">' +
        escapeHtml(label) + '</td><td style="padding:5px 2px;text-align:right;font-size:12px;font-weight:600;color:#111827">' +
        escapeHtml(value) + '</td></tr>';
    }
    function section(label) {
      return '<div style="font-size:13px;font-weight:700;color:' + colorBlue + ';margin:9px 0 2px">' +
        escapeHtml(label) + '</div>';
    }
    function historyStrip(records) {
      records = Array.isArray(records) ? records.slice(-10) : [];
      if (!records.length) return '<div style="font-size:11px;color:#94a3b8;padding:4px 0">尚无有效历史采样</div>';
      var marks = [];
      var labels = [];
      records.forEach(function (record, index) {
        var mark = index === 0 ? "⚪" : (record.ip === records[index - 1].ip ? "🟢" : "🟠");
        marks.push(mark);
        labels.push(String(index + 1));
      });
      return '<div style="text-align:center;font-size:17px;letter-spacing:1px;white-space:nowrap">' +
        marks.join(" ") + '</div><div style="text-align:center;font-size:10px;color:#64748b;letter-spacing:2px">' +
        labels.join("　") + '</div><div style="font-size:10px;color:#718096;margin-top:3px">左→右：较早→最近 · ' +
        records.length + ' 次有效采样</div><div style="font-size:10px;color:#64748b">⚪ 首个可见样本　🟢 与前次相同　🟠 与前次不同</div>' +
        '<div style="font-size:10px;color:#64748b">仅比较已保存的采样记录，不代表两次采样间持续稳定。</div>';
    }

    var historyColor = history.saved ? colorGreen : colorAmber;
    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.35;text-align:left;color:#111827">';
    html += '<div style="padding:9px 5px 8px;text-align:center;border-bottom:1px solid #d7dee8">';
    html += '<div style="font-size:11px;color:#718096">Claude IP Guard · 被测节点出口 IPv4</div>';
    html += '<div style="font-size:27px;font-weight:750;letter-spacing:.2px;overflow-wrap:anywhere">' + escapeHtml(ip) + '</div>';
    html += '<div style="font-size:12px;color:#334155">' + escapeHtml(place) + '</div>';
    html += '<div style="font-size:11px;color:#718096">' + escapeHtml(intel && intel.ok ? intel.data.asn + " · " + intel.data.org : "ASN / 运营商未知") + '</div></div>';

    html += '<table width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin-top:5px"><tr>';
    html += tile("双源出口校验", agree ? "双源一致" : "未通过", "ipify + icanhazip", agree ? colorGreen : colorAmber);
    html += tile("IP 归属信息", intel && intel.ok ? "已获取" : "不可用", intel && intel.ok ? intel.data.countryCode : "第三方查询失败", intel && intel.ok ? colorGreen : colorMuted);
    html += '</tr><tr>';
    html += tile("节点策略", "已指定", policy, colorBlue);
    html += tile("出口历史", history.status, (history.count || 0) + " 次采样 · " + (history.changes || 0) + " 次变化", historyColor);
    html += '</tr></table>';

    html += section("最近出口采样");
    html += historyStrip(history.records);
    html += '<table width="100%" cellspacing="0" cellpadding="0">';
    html += row("上次有效 IP", history.previous || "无记录");
    html += row("历史保存", history.saved ? "成功" : "未保存");
    html += row("累计有效采样", history.count || 0);
    html += row("累计 IP 变化", history.changes || 0);
    html += '</table>';

    html += section("出口身份");
    html += '<table width="100%" cellspacing="0" cellpadding="0">';
    html += row("请求策略", policy);
    html += row("IP 查询源 A · ipify", resultA.ok ? resultA.ip : resultA.error);
    html += row("IP 查询源 B · icanhazip", resultB.ok ? resultB.ip : resultB.error);
    html += row("国家 / 地区 / 城市", intel && intel.ok ? place : "未知");
    html += row("ASN", intel && intel.ok ? intel.data.asn : "未知");
    html += row("组织", intel && intel.ok ? intel.data.org : "未知");
    html += row("ISP", intel && intel.ok ? intel.data.isp : "未知");
    html += row("网络类型", intel && intel.ok ? intel.data.type : "未知");
    html += row("归属数据源", intel && intel.ok ? "ipwho.is" : "不可用");
    html += row("本次检测耗时", (Date.now() - startedAt) + " ms");
    html += '</table>';

    html += '<div style="margin-top:8px;padding-top:7px;border-top:1px solid #d1d9e3;font-size:10px;color:#718096">';
    html += '本报告仅确认脚本请求所使用的策略及两个 IP 查询源的结果。实际节点路由请以 Quantumult X 活动记录中的 FETCH 策略为准。';
    html += ' IP 地理位置、ASN、ISP 和网络类型为第三方估算，不代表 Claude 服务端确认的出口，也不构成账号风险或封禁概率判断。';
    html += ' 当前版本尚未接入第三方 IP 信誉评分、DNS/IPv6 泄漏检测或长期稳定性评估。历史仅保存在本机 QX 偏好存储中。';
    html += '</div></div>';

    console.log("Claude IP Guard v" + VERSION + " completed; policy=" + policy +
      "; sourceA=" + (resultA.ok ? "ok" : "failed") +
      "; sourceB=" + (resultB.ok ? "ok" : "failed") +
      "; agree=" + agree + "; historySaved=" + history.saved);

    $done({
      title: "🛡 Claude IP Guard · A v" + VERSION,
      htmlMessage: html
    });
  }

  var policy = "";
  try {
    policy = $environment && typeof $environment.params === "string"
      ? $environment.params.trim()
      : "";
  } catch (error) {
    policy = "";
  }

  if (!policy || policy.length > 200) {
    $done({
      title: "Claude IP Guard v" + VERSION,
      message: "没有收到有效的节点标签。请在 Quantumult X 中长按单个服务器节点触发本任务；本次已停止，未发起网络请求。"
    });
    return;
  }

  Promise.all([
    request(IPV4_A, policy, parseIpify),
    request(IPV4_B, policy, parsePlainIp)
  ]).then(function (results) {
    var a = results[0];
    var b = results[1];
    var agree = a.ok && b.ok && a.data === b.data;
    var ip = agree ? a.data : "";
    var intelPromise = ip
      ? lookup(ip, policy)
      : Promise.resolve({ ok: false, error: "双来源不一致或查询失败，跳过归属查询" });

    return intelPromise.then(function (intel) {
      var history = updateHistory(policy, ip, agree);
      render(policy,
        a.ok ? { ok: true, ip: a.data } : { ok: false, error: a.error },
        b.ok ? { ok: true, ip: b.data } : { ok: false, error: b.error },
        intel,
        history
      );
    });
  }).catch(function () {
    $done({
      title: "Claude IP Guard v" + VERSION,
      message: "检测流程发生未预期错误。未能形成可信的节点出口结论，请查看 Quantumult X 日志。"
    });
  });
})();
