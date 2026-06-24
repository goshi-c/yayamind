# YayaMind MVP 收口归档摘要 - 2026-06-22

## 版本结论

- 版本名称：MVP 收口版
- 收口日期：2026-06-22
- 收口状态：功能基线可归档；build / pack / sync / 资源核验 / 真实入口冷启动完成；保留桌面语音人工验收项
- 当前主文档：`PRD.md`、`SDD.md`、`TODO.md`
- 下一阶段入口：`docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md`

## MVP 已收口能力

| 能力 | 收口结论 | 关键入口 |
|---|---|---|
| Web 工作台 | 已形成三栏工作台，支持一周安排、右侧详情和多页面导航 | `src/App.tsx`、`src/styles.css` |
| 自然语言输入 | parse / commit 分离，支持追问、确认、风险提示、写入后刷新 | `server/index.ts`、`server/dataStore.ts` |
| 桌面小猫 | 支持单击听写、再次单击提交、双击打开、拖动、取消和阶段反馈 | `electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html` |
| 右侧日期详情 | 支持查看、双击编辑、自动保存、右键删除确认和软删除 | `src/App.tsx`、`server/dataStore.ts` |
| 项目待办 | 支持项目分组、新增、编辑、完成、删除、拖拽、deadline 和未归类兜底 | `src/App.tsx`、`server/index.ts`、`server/dataStore.ts` |
| 本地数据层 | 开发态和真实桌面态数据目录分离，删除优先软删除 | `personal-assistant-data/`、`D:\YayaMindData\personal-assistant-data\` |
| 设置页 | 支持作息、休息日、法定节假日和 AI 接口配置 | `src/App.tsx`、`server/aiAdapter.ts` |
| 打包真实入口 | 已建立 build output、真实入口和用户数据三层边界 | `package.json`、`D:\YayaMindBuild\release`、`D:\YayaMind` |

## 保留验收项

- 真实入口 `D:\YayaMind\YayaMind.exe` 已启动，`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 用户在真实桌面环境点击小猫说一句明确日程。
- 确认 `D:\YayaMindData\userData\desktop-cat.log` 出现 `commit-success`。
- 确认工作台日程格子刷新，且小猫状态不提前睡觉。
- 确认桌面小猫可见、单击 / 双击 / 拖动语义符合预期。

## 不再扩大 MVP 的内容

- 不把 AI 化 1.0 的 `plan_day`、今日安排草稿、历史实体词表、模糊时间解释器、画像排程写入 MVP 必做项。
- 新用户教程、最新作品集截图和 `desktop:release-local` 脚本转入 1.0 前置优化或工程化优化。
- 不迁移、不删除真实用户数据目录。

## 1.0 启动建议

1. 读取 `docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md`。
2. 确认 1.0 P0 范围，避免把整份草案一次性提升为开发承诺。
3. 将根目录 `PRD.md` / `SDD.md` / `TODO.md` 从 MVP 收口版切换为 AI 化 1.0 开发版。
4. 先处理语音会话稳定性、`plan_day` 今日规划、画像参与排程和草稿确认后写入。
