# Claude IP Guard v19.0 — 发布说明

## 状态
v19.0 正式版文件已在开发分支准备，尚未合并 main；正式版部署前应以 GitHub Actions 的最终结果为准。

## 真机验收
用户确认 Quantumult X iPhone 端 v19 Compact RC3 正常运行，且原生「好的」按钮可关闭弹窗。日本和美国节点此前的出口双源一致、历史记录等功能有真机实测证据。RC3 与正式版的功能代码应完全一致，差别仅为文件头与版本号；CI 负责核实。

## 功能
- 长按具体节点运行，必须有选中节点标签；所有检测请求绑定该节点策略。
- ipify 与 icanhazip 双源有效 IPv4 一致后才确认出口，随后查询归属、信誉并保存历史。
- ipwho.is 主源，ipapi.co 备用；响应必须匹配目标 IP。
- IPPure、ipapi.is、IP2Location、Scamalytics 独立查询与独立缓存；查询失败不当作零风险。
- 按节点标签隔离历史，支持只读旧版历史导入；不改写旧版记录。
- 简短原生弹窗，可关闭；限制异常文本长度。
- 只读网络检测，不访问 Claude 账户或修改 Quantumult X 配置。

## 局限
- IP 归属和信誉服务可能限流、超时或因网页改版失效。
- 信誉来源数量与 Claude 封号风险没有可验证的对应关系。
- 本工具测量指定节点访问检测服务的出口，不保证 Claude 服务端看到的出口始终相同。
- 早先美国节点偶发请求失败未定位根因，不归因于 DNS。
- 逻辑超时不代表底层请求已经取消。

## 文件
- 正式版候选路径：`Scripts/Claude/Claude_IP_Guard_QX_v19.js`
- 已验证候选路径：`Scripts/Claude/v19/Claude_IP_Guard_QX_v19_compact_native_candidate.js`
- 旧版 v18.1 保留，不覆盖。
