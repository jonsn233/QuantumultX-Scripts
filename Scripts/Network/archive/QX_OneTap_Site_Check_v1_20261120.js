/* Quantumult X event-interaction: one-tap connectivity/HTTP response timing.
 * No secrets, no MITM, no external telemetry. Tests follow current QX routing.
 * This is not a bandwidth test or a guarantee of a particular proxy exit.
 */
const targets = [
  {group:'国内',name:'百度',url:'https://www.baidu.com/'},
  {group:'国内',name:'腾讯',url:'https://www.qq.com/'},
  {group:'国内',name:'哔哩哔哩',url:'https://www.bilibili.com/'},
  {group:'国外',name:'Google',url:'https://www.google.com/generate_204'},
  {group:'国外',name:'GitHub',url:'https://github.com/'},
  {group:'国外',name:'YouTube',url:'https://www.youtube.com/'},
  {group:'国外',name:'Cloudflare',url:'https://www.cloudflare.com/cdn-cgi/trace'}
];
const started = Date.now();
function check(t) {
  const begin = Date.now();
  return $task.fetch({url:t.url,method:'GET',headers:{'User-Agent':'Mozilla/5.0 QX-Site-Check/1.0'},timeout:6000})
    .then(r => ({...t,ms:Date.now()-begin,code:r.statusCode||r.status||0,ok:(r.statusCode||r.status||0)>=200 && (r.statusCode||r.status||0)<400}))
    .catch(e => ({...t,ms:Date.now()-begin,code:0,ok:false,error:String(e).slice(0,75)}));
}
Promise.all(targets.map(check)).then(results=>{
  const lines=[];
  for(const group of ['国内','国外']) {
    const list=results.filter(x=>x.group===group);
    lines.push('【'+group+'】'+list.filter(x=>x.ok).length+'/'+list.length+' 成功');
    list.forEach(x=>lines.push((x.ok?'✅':'❌')+' '+x.name+'：'+(x.ok?x.ms+'ms (HTTP '+x.code+')':(x.code?'HTTP '+x.code:'请求失败/超时'))));
  }
  lines.push('总耗时 '+((Date.now()-started)/1000).toFixed(1)+'s');
  lines.push('说明：测的是HTTP响应时间，不是下载速度；失败也可能是网站限制。');
  const msg=lines.join('\n');
  $notify('QX 一键国内/国外网站检测','',msg);
  console.log(msg);
  $done();
}).catch(e=>{$notify('QX 网站检测异常','',String(e));$done();});
