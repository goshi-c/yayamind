# 10 技术栈 SDD

## 目标

技术栈需要服务第一版 Web 模拟个人助手：快速做出可用体验，支持本地 Obsidian 文件读写，方便后续迁移到桌面壳。

第一版不追求复杂工程体系，优先选择轻量、稳定、容易展示作品集价值的方案。

## 推荐技术栈

```text
前端：React + TypeScript + Vite
样式：Tailwind CSS 或 CSS Modules
本地后端：Node.js + Fastify
本地数据：Obsidian 文件夹中的 JSON / JSONL / Markdown
语音识别：浏览器 Web Speech API
AI 接入：后端封装 model adapter
后续桌面壳：优先 Tauri，备选 Electron
```

## 前端

前端负责：

- 三栏 Web 面板。
- 日历列视图。
- 今日面板。
- 小猫浮窗。
- 输入和确认流程。
- 浏览器通知授权和触发。

推荐 `React + TypeScript + Vite`。

原因：

- 启动快，适合原型和作品集。
- TypeScript 方便约束数据结构。
- 后续迁移 Tauri 或 Electron 时，前端可复用。
- 不需要一开始引入 Next.js 这类偏服务端渲染的框架。

## 本地后端

后端负责：

- 读取和写入 Obsidian 数据文件。
- 封装 AI 模型调用。
- 做冲突检测和重排候选方案。
- 提供前端 API。

推荐 `Node.js + Fastify`。

原因：

- 和前端同语言，降低上下文切换。
- 文件读写和 JSON/JSONL 处理简单。
- 适合本地轻量服务。
- 后续可迁移为 Tauri command 或 sidecar。

## 数据存储

第一版不引入数据库。

原因：

- 项目强调本地、可读、Obsidian 友好。
- JSON/JSONL 足够支撑 MVP。
- 后续如果数据量变大，再考虑 SQLite。

核心数据结构见 `01-data-schema.md`。

## 语音识别

第一版使用浏览器 Web Speech API。

原因：

- 成本低。
- 接入快。
- 足够验证“语音 -> 文本确认 -> 解析写入”的体验。

限制：

- 浏览器兼容性可能不完全一致。
- 页面关闭时不提供后台识别。
- 识别结果必须给用户确认后再提交。

## AI 接入

AI 不直接写在前端，而是通过后端统一封装。

建议抽象：

```text
model adapter
  -> classify input
  -> extract fields
  -> phrase suggestion
  -> summarize review
```

这样后续可以替换不同模型或接入用户自己的 key。

AI 使用边界见 `09-ai-strategy.md`。

## 后续桌面迁移

第一版先做 Web 模拟。

后续优先考虑 Tauri：

- 体积较小。
- 适合本地文件能力。
- 可以复用前端。

Electron 作为备选：

- 生态成熟。
- 桌面能力丰富。
- 体积更大。

第一版不提前绑定桌面壳实现。

## 第一版不做

- 不引入数据库。
- 不上完整用户账号系统。
- 不接外部日历同步。
- 不做复杂多模型路由。
- 不做真正桌面常驻。
- 不为了未来桌面化提前复杂化 Web 架构。

## 验收标准

- 技术栈能支持本地文件读写和 Web 面板。
- 前端能复用到后续桌面壳。
- AI 调用不会散落在前端组件里。
- 第一版不需要依赖复杂基础设施。
- 后续实现者可以直接按这套栈开始搭项目。
