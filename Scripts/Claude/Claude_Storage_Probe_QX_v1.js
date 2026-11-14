/* Quantumult X persistence probe | manual event-interaction
 * Isolated test key. No network, no configuration changes.
 * Run twice; second run should read first run's value.
 */
(function(){
"use strict";
var KEY="ClaudeIPGuard.StorageProbe.v1";
function done(title,message){$done({title:title,message:message});}
try{
 if(typeof $prefs==="undefined"||typeof $prefs.valueForKey!=="function"||typeof $prefs.setValueForKey!=="function"){
  done("存储验证 · 不支持","当前脚本环境未提供预期的 $prefs 读写接口。未修改配置。");return;
 }
 var raw=$prefs.valueForKey(KEY),old=null;
 try{if(raw)old=JSON.parse(raw);}catch(e){}
 var count=old&&Number.isFinite(old.count)&&old.count>=1?old.count+1:1;
 var item={count:count,updated:new Date().toISOString()};
 var ok=$prefs.setValueForKey(JSON.stringify(item),KEY);
 var back=$prefs.valueForKey(KEY),verified=false;
 try{var parsed=JSON.parse(back||"null");verified=!!parsed&&parsed.count===count;}catch(e){}
 var msg="本次计数："+count+"\n上次记录："+(old?"存在（计数 "+old.count+"）":"不存在")+"\n写入结果："+String(ok)+"\n立即读回："+(verified?"成功":"失败")+"\n"+(old&&verified?"跨运行持久化：初步通过":"请稍后再次运行同一脚本，确认能读到本次记录。")+"\n仅使用独立测试键，不访问网络、不修改代理配置。";
 done("Claude IP Guard · 存储验证",msg);
}catch(e){done("存储验证 · 出错",String(e&&e.message||e));}
})();