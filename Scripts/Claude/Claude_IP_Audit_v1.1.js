/**
 * Claude IP Audit v1.1
 * Quantumult X task: event-interaction only (manual execution).
 *
 * Checks public IPv4/IPv6 and enriches each returned address with
 * country/region, ASN, organization and ISP metadata.
 *
 * Diagnostics log HTTP status, allowlisted MIME category, body type and
 * character length. Response bodies, headers and native errors are never logged.
 * Per-request deadline: 12 seconds (underlying QX request is not cancelled).
 * Endpoints: api.ipify.org (IPv4), api6.ipify.org (IPv6), ipwho.is (metadata).
 * No credentials, account identifiers or request bodies are sent. Metadata
 * lookup sends the detected public IP in the URL; results include public IPs.
 * Device acceptance: pending; local mocked tests are not QX device tests.
 * No notifications, no persistent storage, no schedule, no state changes.
 * Network providers receive the requester's public IP as part of normal
 * HTTP transport. Review provider privacy policies before use.
 */

const ENDPOINTS = {
  ipv4: "https://api.ipify.org?format=json",
  ipv6: "https://api6.ipify.org?format=json",
  lookup: "https://ipwho.is/"
};

// Documented QX response fields: statusCode, headers, body.
// No policy override: requests use the user's existing routing configuration.
// auto-cookie:false requires QX build 934+; older builds may ignore it.
const REQUEST_TIMEOUT_MS = 12000;

function auditError(kind, detail) {
  return new Error(kind + ": " + detail);
}

function requestText(url, label) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      finish(auditError("NETWORK_TIMEOUT", "request exceeded 12000 ms"));
    }, REQUEST_TIMEOUT_MS);
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    }
    // Promise boundary also catches synchronous fetch failures. Do not log the
    // rejection object: it can contain headers, URLs or credentials.
    Promise.resolve().then(function () {
      return $task.fetch({
        url: url,
        method: "GET",
        headers: { "Accept": "application/json" },
        opts: {
          "redirection": true,
          "skip-cert-verify": false,
          "auto-cookie": false
        }
      });
    }).then(function (response) {
      if (settled) return;
      response = response || {};
      var status = Number(response.statusCode);
      var body = response.body;
      var bodyType = body === null ? "null" : typeof body;
      var length = typeof body === "string" ? body.length : 0;
      // Only emit a fixed MIME category, never arbitrary header values.
      var headers = response.headers || {};
      var mime = "unknown";
      Object.keys(headers).forEach(function (key) {
        if (key.toLowerCase() !== "content-type") return;
        var value = String(headers[key]).split(";")[0].trim().toLowerCase();
        if (["application/json", "text/json", "text/html", "text/plain"].indexOf(value) >= 0) mime = value;
        else mime = "other";
      });
      console.log("[" + label + "] HTTP=" + (isFinite(status) ? status : "unknown") +
        " contentType=" + mime + " bodyType=" + bodyType + " bodyLength(chars)=" + length);
      if (!isFinite(status) || status < 100 || status > 599) {
        finish(auditError("RESPONSE_ERROR", "missing or invalid statusCode"));
      } else if (status < 200 || status >= 300) {
        finish(auditError("HTTP_ERROR", "status " + status));
      } else if (body === undefined || body === null || (typeof body === "string" && !body.replace(/^\uFEFF/, "").trim())) {
        finish(auditError("EMPTY_RESPONSE", "no JSON body"));
      } else if (typeof body !== "string") {
        finish(auditError("RESPONSE_TYPE_ERROR", "expected text body"));
      } else {
        finish(null, body);
      }
    }, function () {
      if (!settled) console.log("[" + label + "] NETWORK_ERROR: fetch rejected (details withheld)");
      finish(auditError("NETWORK_ERROR", "fetch rejected; details withheld"));
    }).catch(function () {
      finish(auditError("RESPONSE_ERROR", "response processing failed; details withheld"));
    });
  });
}

function parseJSON(text, label) {
  try {
    // QX exposes a text body; tolerate a UTF-8 BOM decoded as U+FEFF.
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (e) {
    // Native parse messages may echo response content, including secrets.
    console.log("[" + label + "] JSON_ERROR: syntax invalid; parser details/body withheld");
    throw auditError("JSON_ERROR", "invalid JSON syntax; details withheld");
  }
}

function isIPv4(ip) {
  var parts = ip.split(".");
  return parts.length === 4 && parts.every(function (p) {
    return /^(0|[1-9][0-9]{0,2})$/.test(p) && Number(p) <= 255;
  });
}

function isIPv6(ip) {
  if (ip.indexOf(":") < 0 || /[^0-9a-fA-F:.]/.test(ip)) return false;
  if (ip.indexOf(".") >= 0) {
    var tail = ip.slice(ip.lastIndexOf(":") + 1);
    if (!isIPv4(tail)) return false;
    ip = ip.slice(0, ip.lastIndexOf(":") + 1) + "0:0";
  }
  var halves = ip.split("::");
  if (halves.length > 2) return false;
  var groups = [];
  halves.forEach(function (half) { if (half) groups = groups.concat(half.split(":")); });
  if (!groups.every(function (g) { return /^[0-9a-fA-F]{1,4}$/.test(g); })) return false;
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

function getPublicIP(url, label) {
  return requestText(url, label).then(function (body) {
    var data = parseJSON(body, label);
    if (!data || typeof data.ip !== "string") {
      throw auditError("JSON_SCHEMA_ERROR", "missing string ip field");
    }
    data.ip = data.ip.trim();
    if (!(label === "IPv4" ? isIPv4(data.ip) : isIPv6(data.ip))) {
      throw auditError("IP_FAMILY_ERROR", "invalid or unexpected address family");
    }
    return { ok: true, ip: data.ip };
  }).catch(function (error) {
    return { ok: false, error: String(error) };
  });
}

function lookupIP(ip, label) {
  return requestText(ENDPOINTS.lookup + encodeURIComponent(ip), label).then(function (body) {
    var data = parseJSON(body, label);
    if (!data || data.success !== true) {
      throw auditError("LOOKUP_ERROR", "provider did not report success; details withheld");
    }
    var connection = data.connection || {};
    return {
      ok: true,
      ip: data.ip || ip,
      type: data.type || "Unknown",
      country: data.country || "Unknown",
      country_code: data.country_code || "Unknown",
      region: data.region || "Unknown",
      city: data.city || "Unknown",
      asn: connection.asn !== undefined ? String(connection.asn) : "Unknown",
      org: connection.org || "Unknown",
      isp: connection.isp || "Unknown"
    };
  }).catch(function (error) {
    return { ok: false, ip: ip, error: String(error) };
  });
}

function line(label, value) {
  return label + ": " + (value === undefined || value === null || value === "" ? "Unknown" : value);
}

Promise.all([
  getPublicIP(ENDPOINTS.ipv4, "IPv4"),
  getPublicIP(ENDPOINTS.ipv6, "IPv6")
]).then(function (ips) {
  var jobs = [];
  if (ips[0].ok) jobs.push(lookupIP(ips[0].ip, "IPv4 lookup"));
  if (ips[1].ok) jobs.push(lookupIP(ips[1].ip, "IPv6 lookup"));

  return Promise.all(jobs).then(function (lookups) {
    var output = [];
    output.push("========== Claude IP Audit v1.1 ==========");
    output.push("Mode: manual / read-only");
    output.push("Time: " + new Date().toISOString());
    output.push("");

    output.push("[IPv4]");
    if (ips[0].ok) {
      output.push(line("Address", ips[0].ip));
    } else {
      output.push("Unavailable / request failed: " + ips[0].error);
    }

    output.push("");
    output.push("[IPv6]");
    if (ips[1].ok) {
      output.push(line("Address", ips[1].ip));
    } else {
      output.push("Unavailable / request failed (this alone does not prove IPv6 is disabled): " + ips[1].error);
    }

    output.push("");
    output.push("[IP intelligence]");
    if (!lookups.length) {
      output.push("No IP address was successfully obtained; enrichment skipped.");
    }

    lookups.forEach(function (item, index) {
      output.push("");
      output.push("Address " + (index + 1) + ": " + item.ip);
      if (!item.ok) {
        output.push("Lookup failed: " + item.error);
        return;
      }
      output.push(line("Type", item.type));
      output.push(line("Country", item.country + " (" + item.country_code + ")"));
      output.push(line("Region / City", item.region + " / " + item.city));
      output.push(line("ASN", item.asn));
      output.push(line("Organization", item.org));
      output.push(line("ISP", item.isp));
    });

    if (lookups.length === 2 && lookups[0].ok && lookups[1].ok) {
      output.push("");
      output.push("[Cross-family comparison]");
      output.push(line("Country consistent", lookups[0].country_code === lookups[1].country_code ? "Yes" : "No — review routing"));
      output.push(line("ASN consistent", lookups[0].asn === lookups[1].asn ? "Yes" : "No — may be normal"));
    }

    output.push("");
    output.push("[Not tested in v1.1]");
    output.push("- DNS resolver / DNS leak");
    output.push("- WebRTC");
    output.push("- Packet routing path");
    output.push("- VPN / proxy / hosting risk classification");
    output.push("- Claude account or login acceptance");
    output.push("");
    output.push("Important: IP geolocation and ASN metadata are estimates, not a cleanliness score or an account-ban prediction.");
    output.push("Privacy: ipify and ipwho.is receive requests from this device/network. No credentials are sent by this script.");

    console.log(output.join("\n"));
    $done();
  });
}).catch(function (error) {
  console.log("Claude IP Audit failed: unexpected runtime error; details withheld");
  $done();
});

