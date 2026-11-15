# Claude IP Guard v19 — 架构与验收规范（草案）

状态：设计冻结候选；尚未发布、尚未设备验收。基线：`Scripts/Claude/Claude_IP_Guard_QX_v18_1.js`。

## 目标与非目标
目标：在 Quantumult X 长按**具体节点**时，可靠获取该节点代理请求的公网 IPv4，显示可核实的 IP 身份、第三方信誉和逐节点历史，并提供适合 iPhone 的紧凑仪表盘。

非目标：不能宣称检测到 Claude 服务端记录的实际出口；不能仅凭 IP 信誉分数推断 Claude 账号封禁概率；不获取登录凭据，不开启 MitM，不修改现有路由、DNS 或证书。

## v18.1 已确认的基线
- `$environment.params` 获取长按节点标签；无有效标签时停止。
- 所有 `$task.fetch` 请求明确设置 `opts.policy`，禁止静默回退默认节点。
- ipify JSON 与 icanhazip 文本双源一致后，才将 IP 写入按节点标签区分的本地历史。
- 四个信誉数据来源：IPPure、ipapi.is、IP2Location、Scamalytics；当前页面解析有第三方结构变化风险。
- IP 归属当前单点依赖 ipwho.is；实测失败时地区/ASN/ISP 均未知。
- 历史按标签而非节点唯一 ID 隔离；相同标签背后的服务器替换可能无法区分。
- 6.5 秒统一超时；缓存以 IP 为键、部分失败可短时重试，但每次重试可能重新请求全部来源。
- 当前 UI 过长，顶端在小屏幕截图中出现裁切。

## v19 数据模型
```js
{
  schema: 2, checkedAt: "ISO8601",
  target: { tag: "...", source: "QX_UIAction", policyRequested: true },
  exit: { sourceA: {status, ip, latencyMs, error}, sourceB: {...},
          agreed: false, ip: null, confidence: "two_echo_services" },
  identity: { status: "ok|partial|unavailable", country: null,
              region: null, city: null, asn: null, org: null, isp: null,
              sources: [{provider, status, checkedAt, error}] },
  reputation: { providers: [{provider, status, score, scale, direction,
                              checkedAt, cached, error, sourceUrl}] },
  history: { storageKey: "...", previousIp: null, sampleCount: 0,
             changeCount: 0, records: [{at, ip}] },
  claude: { apiReachability: "not_tested", webReachability: "not_tested",
            actualServiceObservedIp: "unknown" },
  diagnostics: { elapsedMs: 0, warnings: [] }
}
```
**未知值使用 null/status，不伪造 0 分或通过状态。**

## 阶段顺序
1. **出口引擎**：保留双源策略与严格 IPv4 解析；单来源失败不得保存有效样本；校验每次请求确实指定当前节点策略；错误分类：HTTP、超时、解析、响应 IP 不匹配。
2. **归属回退**：首先验证备选提供方的公开接口格式、可用性和访问条款，再实现有界并发与回退。每个字段保留来源；同一字段冲突时显示“来源不一致”，不能盲目覆盖。
3. **信誉适配器**：每家供应商单独解析、独立 TTL 与失败冷却；区分反欺诈分、滥用分、网络类型；仅当返回内容确实属于查询 IP 才标记为可用。不能跨平台平均。
4. **历史迁移**：保持 v17/v18 旧数据可读；v19 使用 schema 2 独立键空间；迁移只读旧键、成功写新键后才使用新格式；不删除旧历史。按节点标签隔离并注明标签复用限制。
5. **Claude 专项**：服务连通性、地区参考、代理出口信誉各自独立；API 401（无效诊断密钥）仅表明接口响应，302 仅表明重定向；不视为已登录或账号安全。
6. **仪表盘**：首屏仅 IP、节点、双源一致、归属状态、历史变化、第三方成功数量；详情分区展示原始证据与失败原因。先验证 QX htmlMessage 的 HTML/CSS 及交互限制，若不支持分页则提供独立“总览/详细”任务。
7. **性能**：双源查询先行；只有确认出口后才查询第三方。每来源独立超时；限制并发；成功缓存不因其他来源失败而丢失。展示网络耗时与缓存命中，不把缓存当作实时检测。
8. **发布**：开发分支独立文件、静态检查、模拟 HTTP 返回测试、美国与日本至少各一次真机节点测试；验证不同节点 IP 不串线、历史隔离、失败处理、弹窗顶部不裁切；通过后才合并 main。

## 验收红线
- 不改变现有 QX 代理配置；不触碰 Claude 账号/密钥。
- 未证实归属时明确“不可用”，不得用节点名称猜国家。
- 双源不一致不得保存成功样本；单个信誉服务失败不得导致整个检测失败。
- 不把检测请求的出口 IP 写成“Claude 服务端实际看到的 IP”。
- 不把不同评分尺度合并成总安全分。
- 任何新版未经 iPhone 真实运行前均标记“候选/未验收”。
