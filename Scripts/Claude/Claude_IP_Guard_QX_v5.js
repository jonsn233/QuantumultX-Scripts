/**
 * Claude endpoint & exit IP diagnostic for Quantumult X.
 * Ported concepts from cso1z/claude-ip-guard (MIT).
 * Manual event-interaction only. No MitM, credentials, or configuration changes.
 * A public IP service may follow a DIFFERENT policy from Claude.
 */
(function () {
  "use strict";
  var LIMIT=10000;
  var CLAUDE_POLICY="AI-Claude";
  function request(url,method,headers,body) {
    return new Promise(function(resolve){
      var done=false;
      var timer=setTimeout(function(){finish({error:"timeout"});},LIMIT);
      function finish(x){if(done)return;done=true;clearTimeout(timer);resolve(x);}
      try{
        var req={url:url,method:method||"GET",headers:headers||{"Accept":"application/json"},opts:{"policy":CLAUDE_POLICY,"redirection":false,"skip-cert-verify":false,"auto-cookie":false}};
        if(body!==undefined)req.body=body;
        Promise.resolve($task.fetch(req)).then(function(r){
          finish({status:Number(r.statusCode),body:typeof r.body==="string"?r.body:""});
        },function(){finish({error:"network failure"});});
      }catch(e){finish({error:"request error"});}
    });
  }
  function json(s){try{return JSON.parse(s.replace(/^\uFEFF/,""));}catch(e){return null;}}
  function ip4(s){if(typeof s!=="string")return false;var a=s.split(".");return a.length===4&&a.every(function(x){return /^(0|[1-9][0-9]{0,2})$/.test(x)&&Number(x)<256;});}
  function value(v){return v===undefined||v===null||v===""?"Unknown":String(v);}
  function info(r){return r.error?"Failed: "+r.error:"HTTP "+r.status;}
  function geo(ip){
    var providers=[
      {name:"ipapi.co",url:"https://ipapi.co/"+encodeURIComponent(ip)+"/json/",extract:function(d){if(!d||d.error||!d.country_code)return null;return {ip:d.ip,country:d.country_name||d.country_code,code:d.country_code,region:d.region,city:d.city,asn:d.asn,org:d.org};}},
      {name:"ipwho.is",url:"https://ipwho.is/"+encodeURIComponent(ip),extract:function(d){if(!d||d.success!==true)return null;return {ip:d.ip,country:d.country,code:d.country_code,region:d.region,city:d.city,asn:d.connection&&d.connection.asn,org:d.connection&&d.connection.org};}}
    ];
    function attempt(i,errors){
      if(i>=providers.length)return Promise.resolve({ok:false,errors:errors});
      return request(providers[i].url).then(function(r){
        var data=r.status===200?providers[i].extract(json(r.body)):null;
        if(data&&data.code)return {ok:true,provider:providers[i].name,data:data,errors:errors};
        errors.push(providers[i].name+": "+info(r));
        return attempt(i+1,errors);
      });
    }
    return attempt(0,[]);
  }
  var probe=JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1,messages:[{role:"user",content:"ping"}]});
  Promise.all([
    request("https://api.anthropic.com/v1/messages","POST",{"content-type":"application/json","anthropic-version":"2023-06-01","x-api-key":"invalid-diagnostic-key"},probe),
    request("https://claude.ai/","GET",{"Accept":"text/html"}),
    request("https://api.ipify.org?format=json")
  ]).then(function(r){
    var p=json(r[2].body||""),ip=p&&p.ip;
    if(!ip4(ip))ip=ip4((r[2].body||"").trim())?(r[2].body||"").trim():null;
    return (ip?geo(ip):Promise.resolve({ok:false,errors:["No valid IPv4"]})).then(function(g){
      var out=["===== Claude IP Guard | QX v5 =====","Requested policy: "+CLAUDE_POLICY,"[Claude connectivity]","Anthropic API: "+info(r[0]),"Claude web: "+info(r[1])];
      if(r[0].status===401)out.push("API 401: endpoint reachable; diagnostic key rejected as expected.");
      if(r[0].status===403)out.push("API 403: denied; cannot attribute cause without further evidence.");
      if(r[1].status===302)out.push("Web 302: redirect received; login not verified.");
      out.push("","[Public IPv4 observation]","IP: "+value(ip));
      if(g.ok){
        var d=g.data;
        out.push("Metadata source: "+g.provider,"Country: "+value(d.country)+" ("+value(d.code)+")","Region / City: "+value(d.region)+" / "+value(d.city),"ASN: "+value(d.asn),"Organization: "+value(d.org));
        if(d.ip&&d.ip!==ip)out.push("WARNING: metadata IP differs from observed IP.");
      }else out.push("Metadata unavailable: "+g.errors.join("; "));
      out.push("","All requests explicitly set opts.policy=AI-Claude; this is not server-side proof of Claude IP.","Claude's actual server-observed IP, account login, and account risk are NOT verified.","Read-only; no credentials or configuration changes.");
      var lines=["🛡 Claude 专用代理检测","━━━━━━━━━━━━","策略：AI-Claude","API："+info(r[0]),"网页："+info(r[1]),"出口 IPv4："+value(ip)];if(g.ok){lines.push("国家："+value(g.data.country)+" ("+value(g.data.code)+")","城市："+value(g.data.city),"ASN："+value(g.data.asn),"运营商："+value(g.data.org));}else{lines.push("归属信息：查询失败");}lines.push("━━━━━━━━━━━━","出口查询已指定 AI-Claude","非 Claude 服务端 IP 证明","IP 风险评分：未检测");console.log(out.join("\n"));var esc=function(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");};var html='<div style="font-family:-apple-system;text-align:left;font-size:15px;line-height:1.65">'+lines.map(function(s){return esc(s);}).join("<br>")+"</div>";$done({title:"🛡 Claude IP Guard v5",htmlMessage:html});
    });
  }).catch(function(){console.log("Claude IP Guard QX v5: unexpected error");$done();});
})();
