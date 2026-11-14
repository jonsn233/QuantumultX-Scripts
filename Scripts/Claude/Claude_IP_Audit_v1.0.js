/**
 * Claude IP Audit v1.0
 * Quantumult X task: event-interaction only (manual execution).
 *
 * Checks public IPv4/IPv6 and enriches each returned address with
 * country/region, ASN, organization and ISP metadata.
 *
 * No notifications, no persistent storage, no schedule, no state changes.
 * Network providers receive the requester's public IP as part of normal
 * HTTP transport. Review provider privacy policies before use.
 */

const ENDPOINTS = {
  ipv4: "https://api.ipify.org?format=json",
  ipv6: "https://api6.ipify.org?format=json",
  lookup: "https://ipwho.is/"
};

function requestText(url) {
  return $task.fetch({
    url: url,
    method: "GET",
    headers: { "Accept": "application/json", "User-Agent": "QuantumultX-Claude-IP-Audit/1.0" },
    opts: {
      "redirection": true,
      "skip-cert-verify": false,
      "auto-cookie": false
    }
  }).then(function (response) {
    var status = response.statusCode || response.status || 0;
    if (status < 200 || status >= 300) {
      throw new Error("HTTP " + status + " from " + url);
    }
    return response.body || "";
  });
}

function parseJSON(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(label + ": invalid JSON");
  }
}

function getPublicIP(url, label) {
  return requestText(url).then(function (body) {
    var data = parseJSON(body, label);
    if (!data || typeof data.ip !== "string" || !data.ip) {
      throw new Error(label + ": missing ip field");
    }
    return { ok: true, ip: data.ip };
  }).catch(function (error) {
    return { ok: false, error: String(error) };
  });
}

function lookupIP(ip, label) {
  return requestText(ENDPOINTS.lookup + encodeURIComponent(ip)).then(function (body) {
    var data = parseJSON(body, label);
    if (!data || data.success !== true) {
      throw new Error((data && data.message) || "lookup unsuccessful");
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
    output.push("========== Claude IP Audit v1.0 ==========");
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
    output.push("[Not tested in v1.0]");
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
  console.log("Claude IP Audit failed: " + String(error));
  $done();
});
