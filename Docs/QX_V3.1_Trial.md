# Quantumult X V3.1｜第一轮只读试用

## 目标
- **网络体检**：当前 QX 路由下六个网页的 HTTP 响应状态与耗时，另记录公共 IP 查询的出口变化。
- **隐私/广告分析**：读取本仓库已发布的 V3.0 规则数量与独立广告候选清单，展示风险边界。
- **统一入口**：一个主控任务、两个独立任务；按需运行，不添加定时或自动切换。

## 安装（不替换既有配置）
打开 Quantumult X 的任务 / Gallery 添加以下**独立**图库，然后导入 `V3.1 网络总控` 等三个任务：
https://raw.githubusercontent.com/jonsn233/QuantumultX-Scripts/main/Gallery/QX_V3.1_Trial.gallery.json

如不使用图库，可在 `[task_local]` 中增加：
```ini
event-interaction https://raw.githubusercontent.com/jonsn233/QuantumultX-Scripts/main/Scripts/Network/QX_V3.1_Control_Center.js#mode=all&force-timeout=20000, tag=V3.1 网络总控, enabled=true
```
需要 Quantumult X Tunnel 已启动；进入 UIAction 执行即可。

## 数据边界
- 不读取其它应用的实时活动日志；不存在“已拦截次数”的伪统计。
- 规则报告的 `included` 数字只表示仓库生成结果，不证明用户设备订阅、命中或拦截。
- AI 的 403/429 可能是认证/限流，不能仅据此认定节点故障。
- 公共出口查询只反映该次 HTTP 请求使用的路由，不代表 Claude、Gemini、ChatGPT 各自的最终出口。
- 脚本仅把最后一次观察到的出口 IP 保存于 iPhone 的 QX 本地 `$prefs`；不上传日志到 GitHub。
- 无 MitM、无重写、无代理切换、无策略修改；现有 V2.4、V3.0 继续独立运行。

## 验收
在开启 QX Tunnel 时执行「V3.1 网络总控」，看到网络体检、规则审计和底部运行说明，即为首次设备验证。遇到界面无法显示或任务失败，再查看 QX 日志针对性排查。
