# TASK_LOG

> 历史遗留资料：本文件只用于按日期或关键词查旧验证证据，不再作为日常开发主读文档，也不再写入普通新记录。新记录优先写入 `PROJECT_CONTEXT.md` 的编号条目；当前任务状态写入 `TODO.md`。

## 2026-06-16 桌面语音链路复盘与经验沉淀
### 完成
- 复盘类型：Mixed Review。范围包括本轮真实入口日志、项目任务记录、`productize` 经验库、`productize` Skill，以及记忆中的前两轮桌面小猫/真实入口会话摘要。
- 复盘结论：此前返工的核心不是“缺一个小补丁”，而是没有把桌面语音当作完整链路验收；多次只修了云转文字、点击状态或气泡文案，漏掉 parse 成功后的 commit 写入和日程刷新。
- `C:\Users\17978\.codex\skills\productize\PRODUCT_LESSONS.md`：新增经验 021，记录“能理解但不写入”的根因、修法和后续端到端验收口径。
- `C:\Users\17978\.codex\skills\productize\SKILL.md`：在返工预防规则中新增链路型 bug 检查要求，明确修改前后要回看“输入 -> 中间状态 -> 用户反馈 -> 数据写入 -> 刷新/后续动作 -> 日志证据”。
- `C:\Users\17978\.codex\memories\extensions\ad_hoc\notes\2026-06-16-yayamind-voice-chain-review.md`：新增本地长期记忆补充，方便后续会话优先召回这次语音链路经验。

## 2026-06-16 桌面语音解析后自动写入日程
### 完成
- 先读真实入口日志定位：最新链路已经到 `parse-preview-success`，且示例“下午四点开会明天”返回 `hasQuestions:false`，小猫显示“我整理好了：开会 · 16:00-17:00”，但后续没有 `commit` 事件，因此日程未写入。
- 根因：Electron 桌面模式隐藏了主界面内的小猫确认卡片；解析成功后既没有用户可点击的“确认记录”，也没有桌面语音专用自动提交。
- `src/App.tsx`：桌面语音解析成功且 `needsConfirmation=false`、无冲突选项时自动调用 `commitInput(..., source='voice')` 写入日程；需要追问或冲突选择时不自动写入。
- `src/App.tsx`：补充 `desktop-auto-commit-start`、`commit-start`、`commit-success`、`commit-needs-confirmation`、`commit-failed` 日志，后续可以完整追踪“听写 -> 解析 -> 提交 -> 刷新”链路。
- 已重新打包并同步到真实入口 `D:\YayaMind`。
### 验证
- `node --check electron/main.cjs` 通过。
- `node --check electron/preload.cjs` 通过。
- `npm run build` 通过。
- `npm run desktop:pack` 通过。
- 真实入口 `/api/bootstrap` 返回 200。
### 未完全验证
- 未用假日程直接调用 `/api/input/commit`，避免污染用户真实数据；需要用户再说一句真实安排，确认日志出现 `commit-success` 且日程格子刷新。

## 2026-06-16 小猫气泡移除内部意图标签
### 完成
- 先读真实入口日志定位：用户结束听写后链路已进入 `parse-preview-success`，不是 AI 理解中断；气泡显示“我理解成：日程 / 时间块”的原因是 `getDesktopCatMessage()` 把 `parsePreview.intent` 的内部分类标签直接展示给用户。
- 日志同时显示本次系统听写实际捕获文本为“有个会议要开”，没有捕获到前半句“明天下午4点”，所以解析结果 `hasQuestions: true`，后续应以追问缺失信息的方式反馈。
- `src/App.tsx`：新增桌面小猫专用解析预览文案。缺字段时显示“还差一点：...”；字段完整时显示“我整理好了：...”；不再在小猫气泡显示“我理解成：日程 / 时间块”。
- 已重新打包并同步到真实入口 `D:\YayaMind`。
### 验证
- `node --check electron/main.cjs` 通过。
- `node --check electron/preload.cjs` 通过。
- `npm run build` 通过。
- `npm run desktop:pack` 通过。
- 真实入口 `/api/bootstrap` 返回 200。

## 2026-06-16 桌面小猫系统听写停止态与日志补强
### 完成
- 先读 `D:\YayaMindData\userData\desktop-cat.log` 定位：最新真实入口第二次点击已不再触发新的 `Win+H`，但停止后小猫状态仍停在 `listening`，且缺少渲染侧“拿到文字 -> 开始解析 -> 解析成功/失败”的结构化日志。
- `src/App.tsx`：补充 `native-voice-start`、`native-voice-stop-prepare`、`native-voice-stop`、`desktop-recognized-text`、`parse-preview-start/success/error` 日志，后续每次实测可直接按这些事件定位。
- `src/App.tsx`：结束听写并解析完成后让小猫回到休息态，同时保留“我理解成：...”气泡；思考中仍保持倾听态反馈。
- `electron/main.cjs`：补充 `bubble-message` 和 `bubble-lift` 日志，并在开始/停止听写时把悬浮小猫重新抬到最前，降低被主窗口盖住导致“猫消失”的概率。
- 已重新打包并同步到真实入口 `D:\YayaMind`，当前用户测试入口为 `D:\YayaMind\YayaMind.exe`。
### 验证
- `node --check electron/main.cjs` 通过。
- `node --check electron/preload.cjs` 通过。
- `npm run build` 通过。
- `npm run desktop:pack` 通过。
- 真实入口 `/api/bootstrap` 返回 200。
### 下一步实测口径
- 用户点击小猫说一句，再点一次结束后，检查 `desktop-cat.log` 最新尾部是否出现 `native-voice-stop`、`desktop-recognized-text`、`parse-preview-success`，并确认小猫回休息态但气泡仍显示理解结果。

## 2026-06-16 云转文字链路回退到 Windows 系统听写
### 完成
- 本轮只处理云转文字和桌面小猫点击后立刻回休息的问题，未改后续 AI 转写/理解策略。
- 回溯现状：历史日志显示曾经试过 Chromium Web Speech、Windows `System.Speech`、WinRT modern STT 和“Electron 录音 -> 后端 `/api/stt/transcribe`”。当前源码里的主入口已经切到未闭环的录音后端 STT，但 preload/前端没有 `start-recording`/`stop-recording` 接收链路，因此小猫会进入听写态后很快回落，且没有转写结果。
- 真实日志显示 WinRT helper 在安装版里会以 `windows-modern-winrt` 启动，但 0.5 秒左右报 `No speech result`；本轮 smoke test 进一步确认 PowerShell 5 不能稳定加载 WinMD 引用，继续沿这条 helper 小修不可取。
- `electron/main.cjs`：桌面小猫听写改为 Windows 系统听写桥。点击小猫后触发 `Win + H`，第二次点击后再次触发 `Win + H` 关闭听写，不再启动未接通的录音后端 STT。
- `src/App.tsx` / `src/styles.css`：Electron 桌面模式下新增隐藏听写捕获框，系统听写输入会实时同步到小猫气泡，停止后把捕获文本交给现有理解预览。
### 验证
- `node --check electron/main.cjs` 通过。
- `node --check electron/stt-helper.cjs` 通过。
- `npm run build` 通过。
- Vite 预览已启动在 `http://127.0.0.1:5173`。
### 未完全验证
- 当前机器已有多个 `D:\YayaMind\YayaMind.exe` 进程占用生产 API/缓存，开发态 Electron 打开时被缓存冲突关闭；本轮未打包、未同步真实入口。
- 下一步需要在可交互桌面环境点开发态或后续打包版小猫，说一句话，确认 Windows 听写文字能进入气泡。

## 2026-06-15 桌面小猫改为 Windows 本机语音主链路
### 完成
- 回答并确认当前音转文字方案：此前桌面版同时启动 Windows `System.Speech` 和 Chromium Web Speech；日志显示 Web Speech 在真实入口连续 `network` 报错，不适合作为桌面小猫主识别源。
- `electron/main.cjs`：桌面小猫单击后只启动 Windows `System.Speech.Recognition.SpeechRecognitionEngine(zh-CN)`，不再同时触发 `desktop-cat:start-voice` 去启动 Web Speech，避免网络错误把状态打回失败。
- `electron/main.cjs`：第二次点击停止听写时只写入 Windows 识别停止信号并等待 final 文本；final 不再因为 `stopRequested` 被丢弃，识别到文本后继续通过 `desktop-cat:recognized-text` 交给前端解析。
- `electron/main.cjs`：为桌面语音增加 `desktopVoiceSessionId`，防止旧识别进程迟到结果污染新一轮；Windows 识别失败时向前端发送 `desktop-cat:voice-error`，并更新托盘状态。
- 已重新执行 `npm run desktop:pack`，并把 `D:\YayaMindBuild\release\win-unpacked` 同步到真实入口 `D:\YayaMind`，随后从 `D:\YayaMind\YayaMind.exe` 冷启动。
### 验证
- `node --check electron/main.cjs` 通过。
- `npx tsc --noEmit --pretty false` 通过。
- 本机已检测到 Windows 中文桌面识别器：`zh-CN | MS-2052-80-DESK`。
- `npm run desktop:pack` 通过。
- 真实入口 `http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 安装目录 `D:\YayaMind\resources\app\electron\main.cjs` 已包含 `windows-speech-start`、`windows-speech-final` 和 `desktopVoiceSessionId`；未再包含 `renderer-speech-start`。
### 未完全验证
- 当前环境不能替用户对真实麦克风说话；需要用户点击桌面小猫，说一句话后再点一次结束，观察气泡是否出现实时文字和理解卡片。若仍失败，下一步直接看 `D:\YayaMindData\userData\desktop-cat.log` 中最新 `windows-speech-*` 事件。

## 2026-06-15 同步桌面小猫双通道语音修复
### 完成
- 接收并核对当前修复方案：Electron Web Speech 在当前环境会报 `network`，不能作为主识别源；桌面版改为 Windows `System.Speech` 主通道 + Web Speech 兜底。
- 确认 `electron/main.cjs` 中 `startDesktopVoiceInput()` 会同时发送 `desktop-cat:start-voice` 和启动 `recognizeWithWindowsSpeech()`。
- 确认 Windows Speech partial 会通过 `desktop-cat:voice-partial` 回传，前端 `onVoicePartial` 会更新 input，从而带动小猫气泡实时显示转写。
- 重新打包并同步 `D:\YayaMindBuild\release\win-unpacked` 到真实入口 `D:\YayaMind`，已从 `D:\YayaMind\YayaMind.exe` 启动。
### 验证
- `node --check electron/main.cjs` 通过。
- `node --check electron/preload.cjs` 通过。
- `npx tsc --noEmit --pretty false` 通过。
- `npm run desktop:pack` 通过。
- 真实入口 `/api/bootstrap` 返回 200。
- 安装目录 `D:\YayaMind\resources\app\electron\main.cjs` 已包含 `recognizeWithWindowsSpeech`、`desktop-cat:voice-partial`、`windows-speech-partial`。
- 安装目录 `D:\YayaMind\resources\app\electron\preload.cjs` 已包含 `desktop-cat:voice-partial` 和 `onVoicePartial`。
- 日志确认 Web Speech 曾返回 `voice-renderer errorName=network`，也确认 media 权限为 `allowed:true`。
### 未完全验证
- 当前环境不能替用户对真实麦克风说话；最终还需要用户点击小猫说一句，观察气泡是否实时出字，并检查日志是否出现 `windows-speech-partial`。

## 2026-06-15 桌面小猫语音改用渲染端 Web Speech
### 完成
- 排查真实入口日志，确认此前“没听到”的直接表现是 Windows 原生语音链路退出为 `Windows speech exited with 2`，且没有 partial/final 转写输出。
- `electron/main.cjs`：桌面小猫点击后默认通知主窗口启动渲染端 Web Speech，不再默认走 Windows `System.Speech` 进程。
- `electron/main.cjs`：`media/microphone` 权限判断改为信任主窗口/小猫窗口，并补充 `pageUrl`、`requestOrigin` 日志，修复空 origin 下 media 权限被误拒的风险。
- `src/App.tsx`：保留“听写中实时显示转写，第二次点击后提交解析”的流程，并补充 `speech-api-unavailable`、`ready`、`result`、`error` 等诊断日志。
- 重新打包并同步 `D:\YayaMindBuild\release\win-unpacked` 到真实入口 `D:\YayaMind`，已启动 `D:\YayaMind\YayaMind.exe`。
### 验证
- `node --check electron/main.cjs` 通过。
- `npx tsc --noEmit --pretty false` 通过。
- `npm run desktop:pack` 通过。
- 真实入口 `/api/bootstrap` 返回 200。
- 安装目录 `D:\YayaMind\resources\app\electron\main.cjs` 已包含 `renderer-speech-start` 和新的 microphone 权限逻辑；前端 bundle 已包含语音诊断日志。
- 最新启动日志中 `media` 权限在空 origin 下返回 `allowed:true`。
### 未完全验证
- 当前环境不能替用户对真实麦克风说话；下一步需用户点小猫说一句，检查气泡是否实时显示转写，以及日志是否出现 `voice-renderer` 的 `ready/result`。

## 2026-06-15 桌面小猫语音提交与 rewrite 展示修复
### 完成
- `electron/main.cjs`：第二次点击小猫从“取消会话”改成“停止录音并等待 final 文本”，不再把用户说完后的 stop request 记录成 `windows-speech-cancelled` 并丢弃结果。
- `electron/main.cjs`：Windows `SpeechHypothesized` partial 改为“已确认分段 + 当前假设文本”的累计输出，方便气泡实时显示正在说的话。
- `src/App.tsx`：语音输入改为“听写中只实时显示转写；点击结束后调用 `/api/input/parse` 做意图识别和 query rewrite；展示理解卡片”，不再在停顿 1.8 秒后自动提交。
- `src/App.tsx` / `src/styles.css`：理解卡片显示“实时转写 / AI改写”，并补充“确认记录”按钮，让 rewrite 和 intent 可见后再写入。
- 重新执行 `npm run desktop:pack`，同步 `D:\YayaMindBuild\release\win-unpacked` 到真实入口 `D:\YayaMind`，并清理安装目录旧 hashed assets。
### 验证
- `node --check electron/main.cjs`、`node --check electron/preload.cjs` 通过。
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 和 `npm run desktop:pack` 通过。
- API 回放 `项目代办明天下午三点提交表格`：返回 `intent=add_task`，并带 `transcription.originalText=项目代办...`、`transcription.correctedText=项目待办...`。
- 打包版 `http://127.0.0.1:8787` 可打开，`/api/bootstrap` 返回 200。
- 从 `D:\YayaMind\YayaMind.exe` 启动真实入口成功；安装目录 assets 只保留本次构建的 `index-DExZZLqL.js`、`index-fwAW7gqQ.css` 和两张猫图。
- 抽取真实入口内嵌 PowerShell 语音脚本做语法解析，结果为 `PowerShell speech script syntax OK`。
### 未完全验证
- 当前环境无法替用户真实开口说话，因此麦克风实际拾音质量、Windows 语音引擎 partial/final 产出仍需用户点小猫实测一句。若仍无文本，下一步应看新版日志里是否出现 `windows-speech-result`、`windows-speech-empty` 或 `windows-speech-stop-error`。

## 2026-06-15 桌面语音输入与小猫气泡收口

### 完成
- `electron/main.cjs`：修复 Windows 语音识别 PowerShell 子进程在空结果/超时后不稳定退出的问题，增加 `ERROR:` 结构化输出和 `[Environment]::Exit($exitCode)`，避免应用只记录 `Windows speech exited with 2`。
- `src/App.tsx`：桌面壳模式下不再渲染主工作台右下角 `.cat-dialog`，对话内容由 Electron 小猫气泡窗口跟随小猫显示。
- `electron/main.cjs`：启动小猫窗口时把旧设置里的 `92x92` 规范化为 `360x190` 并写回，避免消息气泡被裁切。
- `electron/main.cjs`：桌面语音从 `RecognizeMode::Single` 改为 `RecognizeMode::Multiple`，点击小猫开始持续听写，再次点击写入停止信号文件，正常收尾并汇总多段识别文本。
- `electron/main.cjs`：修复手动听写脚本在真实入口中 0.3 秒退出的问题。根因是生成的 `.ps1` 在 Windows PowerShell 下出现字符串/编码解析失败；现已改为写入 UTF-8 BOM，并把脚本中的状态前缀字符串改为 ASCII 单引号，避免解析失败。
- `src/App.tsx`：桌面听写提示改为“我在听，你可以一直说；说完再点我一下。”
- 已执行 `npm run desktop:pack`，并把 `D:\YayaMindBuild\release\win-unpacked` 覆盖同步到真实入口 `D:\YayaMind`。

### 验证
- `node --check electron/main.cjs` 通过。
- `npm run build` 通过。
- `npm run desktop:pack` 通过。
- 从 `D:\YayaMind\YayaMind.exe` 启动后，`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- `D:\YayaMindData\userData\desktop-settings.json` 已写回 `width: 360`、`height: 190`。
- 真实入口 `D:\YayaMind\resources\app\electron\main.cjs` 已确认包含 `RecognizeMode::Multiple`、`RecognizeAsyncStop()` 和 `windows-speech-stop-*` 停止信号逻辑。
- 使用同类 `.ps1 + 停止信号` 命令行烟测通过，返回 `code: 0`、`FINAL:`、无 stderr，说明解析错误已消除。

### 未完全验证
- 语音链路已验证 Windows 中文识别器存在、识别脚本可正常退出，但没有在本轮用真实麦克风逐字说话验证识别文本质量；需要用户点小猫实际说一句确认。

## 2026-06-15 修复前端 404 问题

### 问题
打包版 YayaMind 桌面应用启动后，前端页面显示 `{"message":"Route GET:/ not found","error":"Not Found","statusCode":404}`，但后端 API 正常。

### 原因
`electron/server-runner.cjs` 没有设置 `DESKTOP_STATIC_DIR` 环境变量，导致 Fastify 没有注册静态文件路由。

### 修复
修改 `electron/server-runner.cjs`，添加环境变量兜底值：
```javascript
process.env.DESKTOP_STATIC_DIR = process.env.DESKTOP_STATIC_DIR || path.join(__dirname, '..', 'dist');
```

### 验证
- `GET /` → 200，返回 `index.html`
- `GET /api/bootstrap` → 200
- `GET /assets/...` → 200

### 修改文件
- `electron/server-runner.cjs`

---

## 2026-06-15 日程陪伴感、手动新增和个人习惯设置

### 已完成

- 提醒冒泡改为只对“刚刚触发”的提醒显示，旧的已触发提醒不会在每次打开日程时重复打扰。
- 没有提醒和交互状态时，小猫会按凌晨、早上、中午、下午、晚上、深夜给短句问候；问候文案保留陪伴感，并参考用户设置的睡觉时间。
- 右侧日期详情标题旁新增小加号，点击后可手动新增日程；表单包含标题、日期、开始/结束时间、类型、准备事项和备注，保存后写入 `events.jsonl` 并刷新日程。
- 个人画像页新增“个人习惯”区，支持设置起床时间、睡觉时间、休息制度和法定节假日显示；日程时间轴会按作息范围显示。
- 一周日程新增休息日浅暖色标记，双休/单休/大小周可配置；休息日不使用灰色弱化。
- 桌面小猫悬浮窗新增上方消息气泡，主工作台的小猫消息会同步到桌面小猫上方，避免规划框只困在应用窗口右下角。
- 项目待办页字号和间距下调：项目标题 17px、待办标题 14px、行高更紧凑。

### 验证

- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 本地后端 `http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 本地前端 `http://127.0.0.1:5173` 返回 200。
- 浏览器验收：日程时间轴显示 06:00-22:00，周六/周日有“休”标记，右侧有“新增日程”按钮，个人画像页有 4 个个人习惯控件，待办标题字号为 14px。
- API 和 UI 均验证手动新增日程可写入；测试日程已通过删除接口软删除清理。

### 未完成和风险

- 本轮未执行 `npm run desktop:pack`，也未同步到真实安装目录 `D:\YayaMind`；按项目规则，这是阶段收口时再做。
- 法定节假日当前先支持常见固定日期显示，暂未接入每年调休/补班数据。
- 桌面小猫气泡已完成代码链路，但本轮未做打包版真实桌面截图验收。

## 2026-06-15 桌面版安装目录同步规则沉淀

### 背景

本轮复盘前发现：用户电脑重启后，桌面小猫又显示成早期橙色圆底/灰色方块版本。排查后确认不是源码回滚，也不是透明 PNG 失效，而是桌面快捷方式、开始菜单和重启后的真实入口都指向 `D:\YayaMind\YayaMind.exe`，而前几轮主要更新的是 `D:\YayaMindBuild\release\win-unpacked\YayaMind.exe`。因此用户实际打开的是旧安装目录里的旧资源。

### 已完成

- 重新执行 `npm run desktop:pack`。
- 将 `D:\YayaMindBuild\release\win-unpacked` 同步到真实安装目录 `D:\YayaMind`。
- 删除 `D:\YayaMind` 中旧的 hashed 猫图资源，只保留当前认可的 `cat-sleeping` / `cat-listening` 资源。
- 从 `D:\YayaMind\YayaMind.exe` 启动验证，确认真实入口使用的是最新资源。
- 截图验证当前悬浮小猫没有旧橙色圆底和灰色方块，截图路径：`.run-logs\current-desktop-cat-after-sync.png`。

### 沉淀规则

- 日常开发只修改源码目录 `D:\obsidian\MyVault\07_项目\个人助手`，不要每个小改都同步到安装目录。
- 阶段收口、复盘、用户明确说“一轮结束”时，必须打包并同步到真实安装目录 `D:\YayaMind`。
- 同步后必须从桌面快捷方式或 `D:\YayaMind\YayaMind.exe` 启动验证，不能只验证 build 输出目录。
- 桌面视觉资源收口时，要清理旧备份图、旧 hashed 资源和临时预览图，避免旧图再次被误加载。

## 2026-06-12 桌面小猫第二轮优化与 D 盘迁移

### 已完成
- 重做 `electron/bubble.html`：去掉头像图片和矩形底，改为透明背景内联 SVG 小布偶猫，包含默认睡觉态和单击后的倾听态。
- 桌面小猫鼠标样式改为 `grab` / `grabbing`，并用 8px 位移阈值区分普通单击和拖动。
- 单击、双击、拖动重新拆分：单击延迟 230ms 后触发语音；双击取消单击并只打开/聚焦主工作台；拖动不触发单击/双击。
- `electron/preload.cjs` 增加 `desktop-cat:start-voice` 排队，避免主工作台刚创建时 React 监听尚未注册导致单击语音事件丢失。
- `src/App.tsx` 增加桌面小猫语音状态回传：语音开始显示“我在听”，不支持或启动失败时回传 error 状态并给明确提示。
- `electron/main.cjs` 增加桌面小猫日志：click、double click、drag start/end、voice start、bubble show/hide/close、renderer gone。
- 小猫悬浮窗关闭或渲染进程异常退出时会自动重建；托盘菜单中文文案修复，并保留显示/隐藏小猫入口。
- YayaMind 桌面应用产物和缓存迁移到 `D:\YayaMind`：release、userData、sessionData、npm 缓存、Electron 缓存、electron-builder 缓存均落在 D 盘。
- `package.json` 的 `desktop:pack` / `desktop:dist` 已改为输出到 `D:\YayaMind\release`，并在脚本内指定 Electron 相关缓存目录。
- `electron/main.cjs` 设置 `app.setPath('userData', 'D:\YayaMind\userData')` 和 `app.setPath('sessionData', 'D:\YayaMind\sessionData')`，避免运行时重新写入 C 盘 YayaMind 目录。

### 验证
- `npm run build` 通过。
- `node --check electron/main.cjs` 和 `node --check electron/preload.cjs` 通过。
- `npm run desktop:dist` 通过，生成目录版 EXE、NSIS 安装包和 portable EXE。
- 启动 `D:\YayaMind\release\win-unpacked\YayaMind.exe` 后，`http://127.0.0.1:8787/api/bootstrap` 返回 200，确认打包版可自启动本地 API 并加载业务。
- 验证 `C:\Users\17978\AppData\Local\YayaMind`、`C:\Users\17978\AppData\Roaming\YayaMind`、`%TEMP%\yayamind-pack-test`、`%TEMP%\yayamind-dist-test` 均不存在。
- `npm config get cache` 返回 `D:\YayaMind\cache\npm`。

### 备注
- 当前安装包仍使用默认 Electron 图标，后续可补正式 `.ico`。
- 旧桌面快捷方式如果指向 C 盘，需要删除后重新运行 `D:\YayaMind\release\YayaMind Setup 0.1.0.exe` 安装生成。


## 2026-06-12 桌面悬浮小猫应用壳 MVP

### 已完成

- 安装 Electron，并在 `package.json` 增加 `main`、`desktop:dev`、`desktop:open` 和 `desktop:electron` 脚本。
- 新增 `electron/main.cjs`：负责创建透明置顶悬浮小猫窗口，靠边吸附/缩进，并在双击时打开完整 YayaMind 主工作台。
- 新增 `electron/preload.cjs`：用 IPC 暴露拖动、展开、吸边和打开主窗口接口，避免在悬浮球页面直接启用 Node。
- 新增 `electron/bubble.html`：实现第一版圆形小猫悬浮入口，支持拖动、双击、靠边状态样式。
- 本轮继续优化桌面入口：删除吸附/缩进/鼠标移入展开逻辑，悬浮窗拖到哪里就停在哪里，并把位置写入 Electron `userData/desktop-settings.json`。
- 桌面悬浮窗改用 `src/assets/ragdoll-avatar.png`，视觉上和原工作台布偶猫入口一致；Electron 模式下主工作台不再渲染第二个猫脸。
- 单击桌面小猫通过 IPC 触发主工作台原有 `startVoiceInput()`，双击仅打开或聚焦主工作台。
- 新增睡觉态/倾听态两种桌面小猫姿态，并移除应用内小猫右下角 `Zz` 状态字样。
- 新增系统托盘菜单：打开主工作台、显示/隐藏小猫悬浮窗、开机自启、退出应用。
- 新增开机自启开关和持久化设置，使用 Electron `app.setLoginItemSettings` 应用状态。
- 新增单实例锁，重复启动应用时聚焦主工作台，避免多个 Electron 实例抢占缓存和托盘。
- 安装 `electron-builder`，新增 `desktop:pack` 和 `desktop:dist` Windows 打包脚本及基础安装包配置。

### 验证

- `npm run build` 通过，确认现有 Web 工作台构建未受桌面壳影响。
- 在本地服务已占用 5173/8787 的场景下，`npm run desktop:open` 可拉起 Electron 进程；验证后已清理测试进程，无残留。
- `npx tsc --noEmit --pretty false` 通过。
- `node --check electron/main.cjs` 和 `node --check electron/preload.cjs` 通过。
- `npm audit --omit=dev` 为 0 vulnerabilities。

### 下一步

- 运行真实桌面手感验收：检查无灰底、无第二个猫脸、不吸附、单击听写、双击打开、关闭主窗口后小猫仍保留、托盘菜单可用。
- `desktop:dev` 本轮未强制重启，因为本机已有 5173/8787 服务运行；当前使用 `desktop:open` 验证桌面壳。
- Fastify 本地 API 生产自启动已纳入 Electron 包；当前 EXE 已验证不依赖开发命令也能启动业务。

## 2026-06-10 项目收尾文档与面试材料

### 已完成

- 新增 `docs/interview/01-PRD.md`，面向 AI 产品经理面试整理 YayaMind 的产品背景、目标用户、核心痛点、功能范围、用户流程、成功标准和后续规划。
- 新增 `docs/interview/02-SDD.md`，以面试可讲述方式整合 React/Vite 前端、Fastify 后端、本地 JSON/JSONL 数据层、AI adapter、API 契约和核心数据流。
- 新增 `docs/interview/03-COMPETITOR_ANALYSIS.md`，覆盖 Motion、Sunsama、Reclaim、Todoist、Notion Calendar、TickTick、Akiflow，并总结 YayaMind 的差异化机会。
- 新增 `docs/interview/04-PROJECT_DETAILS.md`，详细说明项目目录、前后端连接、数据文件、输入解析链路、日程/待办/总结数据流和面试讲解顺序。
- 新增 `docs/interview/05-INTERVIEW_QA.md`，整理项目开场、产品定位、技术结构、AI 使用、数据存储、竞品差异和后续规划等高频问答。
- 新增 `docs/interview/README.md`，作为面试材料阅读索引。
- 增量更新 `README.md`、`PROJECT_CONTEXT.md` 和 `docs/portfolio/README.md`，补充面试材料入口。

### 验证

- 确认新增文档位于 `docs/interview/`。
- 确认 README、作品集 README 与项目上下文均能指向面试材料。
- 文档只做收尾和说明，不修改功能代码或本地数据文件。

## 2026-06-04 冲突判断、日历玻璃块与右侧编辑收敛

> 说明：下方历史日志保留当时实现过程，当前产品口径以本节、`TODO.md` 和 `DECISIONS.md` 的最新决策为准。

### 已完成
- 修正日程冲突判断：不再因为标题都归纳为“开会”就判重复；日程冲突只看真实时间范围重叠。
- 冲突确认文案收敛为用户能理解的动作：`修改 / 重叠 / 取消`。不再把“保留已有安排、记为待定、使用新时间、移动已有安排”等内部实现逻辑暴露给用户。
- 中间一周视图改为“时间背景 + 透明日程块”：日程块只显示短标题，时间范围由块的位置和高度表达；具体几点到几点在右侧详情展开。
- 日程块视觉改为透明玻璃描边：取消会遮挡时间轴的磨砂 blur，降低填充透明度，让背景小时数字和虚线能透出来。
- 右侧详情收敛为结构化信息：保留标题、具体事项、时间、准备事项；移除“目的”和“备注”的展示/编辑，避免内容重复。
- 右侧内联编辑改为紧凑表单：标题一栏；`月 / 日 / 开始 / 结束` 横向一栏；准备事项默认一行，内容多时再扩展。
- 修复页面残留乱码文案，建立本轮约束：修改中文文案必须用 UTF-8 读取/编辑，不能从 PowerShell 默认乱码输出中复制中文回源码。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 本地服务已重启，前端 `http://127.0.0.1:5173` 和后端 `http://127.0.0.1:8787/api/bootstrap` 均返回 200。
- API 验证：“明天下午 5 点开会”不再因标题相同触发重复；只有真实时间重叠时才返回确认。
- 浏览器验证：中间日程块文本只剩短标题，透明样式实际生效；右侧编辑表单无备注字段，准备事项为一行输入。

## 2026-06-04 语音理解文案、AI 标识与重叠确认修正

### 已完成
- 修复前端多处乱码文案，包括确认预览、右侧详情、编辑按钮、提醒区域、未来安排入口和小猫悬停提示等，避免页面出现看不懂的错字/乱码。
- 调整输入理解预览结构：从零散字段改为 `标题 / 具体内容 / 提前准备` 三块；标题优先归纳为 `开会 / 上课 / 面试 / 提醒 / 任务`，不再简单截取原话前几个字。
- `DeepSeek` 不再写进主标题；只有 AI 参与解析时，在标题旁显示小字 `DeepSeek 参与`。
- 增强具体内容提取：支持从“在软件园开会”中提取地点，并把时间、地点、内容、估时以分行方式展示。
- 增强准备事项提取：支持 `提前准备 / 需要准备 / 要准备 / 带上` 等说法，并在确认预览和右侧详情中显示为准备清单。
- 增强语音意图判断：用户说“补充/备注/准备”时优先补到已有会议/面试/课程；用户说“修改/重新安排/不是……”时优先尝试修改已有安排，不直接当作新日程。
- 调整时间重叠确认策略：当前最终口径为只给 `修改 / 重叠 / 取消` 三个用户动作；确认“重叠”后允许重叠并在日程中并列/重叠展示。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 后端已重启；`/api/ai/status` 返回 DeepSeek 已配置。
- API 验证：
  - “明天下午三点在软件园开会，具体内容是讨论项目进度，提前准备 TODO 和 SDD”可归纳标题为“开会”，提取地点、内容和准备事项。
  - “明天上午十点上课，提前准备课件和笔记本”可归纳标题为“上课”，并显示 `DeepSeek 参与`。
  - 与已有安排重叠时，确认问题和选项已变为“修改 / 重叠 / 取消”。

## 2026-06-04 语音写入确认与首屏修正

### 已完成
- 左侧导航品牌改为两行横排：第一行 `Yaya`，第二行 `Mind`，不再竖排。
- 小猫气泡默认不再显示历史/占位文案；只有追问、确认、修改、听写或思考状态时才出现。
- 新增写入后确认流：语音新增日程/任务成功后，页面会自动跳到对应日期和时间，并显示 `确认 / 修改 / 取消`。
- 新增写入后修改流：点 `修改` 后小猫继续听，支持“不是周五，是周六”“加备注：带电脑”这类修正。
- 新增已有会议备注识别：例如“明天晚上的那个会加一个备注，要带上笔记本电脑”，会尝试匹配当天晚上的会议并补充备注/准备事项。
- 今天列改为半透明暖色，会议卡片保持暖色系；时间轴高度从 `2400px` 缩短到 `1900px`，保留内部滚动。
- 修复一次 PowerShell 写回导致的 `src/App.tsx` 编码/字符串边界损坏，并恢复到可编译状态。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 后端 `http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 浏览器检查 `http://127.0.0.1:5173`：无 Vite 错误；品牌显示为 `Yaya / Mind`；小猫气泡默认隐藏；今天列为半透明；时间轴内部可滚动。

## 2026-06-04 本周缩略视图与未来安排逻辑修正

### 已完成
- 默认滚动改为让今天的红线落在可视区域上三分之一处；时间轴高度加长到 2400px，保证晚间也能把红线顶到上三分之一。
- “未来安排”按钮上移并缩小，贴近中间面板上边缘。
- 中间面板去掉 YayaMind wordmark/logo；品牌文字移到左侧导航栏顶部，删除原图形 logo。
- 本周视图固定为周一到周日 7 列，列宽使用 `minmax(0, 1fr)` 均分，右侧详情默认宽度缩到 360px，避免缩小时周五周六被挤出。
- 过去日期弱化并压缩卡片信息，作为本周缩略视图的一部分。
- “未来安排”语义改为本周之后的未来安排，不再把本周剩余日期塞进去；未来日期来自后端返回的本周以外有安排日期。
- 后端 `buildCalendar` 返回本周 7 天 + 本周之后有安排的未来日期；`下周周四/下周周五` 日期推断修正为真正的下周。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 后端已重启；API 验证“下周周四下午三点开会”日期为 `2026-06-11`，不会落到本周。
- 浏览器检查：本周视图固定 7 列；中间 wordmark 不存在，左侧显示 `YayaMind`；未来按钮 top 约 10px；今天红线比例为 0.33；无 console error。

## 2026-06-04 中间日历密度、未来安排和语音解析修正

### 已完成
- 去掉中间顶部“一周安排”和 YayaMind 文字标题，改为更轻的 YayaMind wordmark；左上角品牌图标改为“丫”字标识方向。
- 中间日历列改为内部滚动的 0:00-24:00 长时间轴，默认滚到 7 点附近；中间板块和左侧导航仍固定不跟随页面滚动。
- 时间轴准点线加深，10 分钟刻度改为更轻的短刻度/细线，方便拖到 14:20 等具体时间。
- 增加“未来安排”按钮，显示未来安排数量；点击后只看有安排的未来日期，并提供“回到今天”。
- 小猫语音停顿自动写入改为 1 秒。
- 小猫增加听和思考两种视觉状态，不再只靠文案说明状态。
- 后端解析修正：明确“几点/三点 + 开会/会议/面试”的输入优先用本地规则，不再被 AI 误追问时间或活动；中文数字时间可识别。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 后端已重启；API 验证“明天下午三点开始开会”返回 `needsConfirmation: false`、标题为“开会”、类型为 `meeting`。
- 浏览器检查：旧标题不显示；wordmark 和“未来安排”按钮存在；每列日程可内部滚动；时间轴包含 0:00 与 24:00；首列有 120 个 10 分钟刻度；无 console error。

## 2026-06-04 时间轴与语音追问体验修正

### 已完成
- 一周安排时间轴从 0:00-24:00 改为 7:00-24:00，去掉睡眠时段的无效空间。
- 时间轴增加 20 分钟粒度的细虚线，方便把日程拖到 14:20 这类具体时间。
- 小猫拖动逻辑改为：按住并移动超过阈值才拖动，普通点击才开始语音，降低拖动和点击冲突。
- 小猫语音状态文案进一步简化，不再反复提示“停顿 2 秒自动写入”。
- 当系统追问补充时间等信息时，会自动继续听用户回答，不需要再次点击小猫。
- 增加轻量输入兜底：明显不像安排/任务/提醒/进度的识别结果，不直接写入，会先问“刚刚这句是要新增安排或任务吗？”。
- 统一追问/冲突选择卡片为浅底深字，提高“原话/保留/两个都保留/取消”等文字可读性。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 浏览器检查：时间轴首个标签为 7:00，包含 24:00，不再包含 0:00；每列有 20 分钟细虚线；语音空状态不再显示冗余说明；无 console error。

## 2026-06-04 右侧滚动与待补充分类修正

### 已完成
- 去掉日历块上下边缘的可见拖动提示框，仅保留鼠标悬停到边缘时的上下拖动光标和隐形拖动区域。
- 右侧日期详情改为内部滚动；页面整体、左侧导航和中间一周安排锁在一屏内，不再随右侧长内容一起滚动。
- 将“明天下午有个面试……在这之前记得一定要把那个……”这类语义含糊的截止任务归入“待补充事项”，不再显示为截止任务或截止线。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 浏览器检查：`body` 和 `.app-shell` 为 `overflow: hidden`，`.today-panel` 为 `overflow-y: auto`；含糊任务出现在“待补充事项/待补充内容”，不再出现在“截止任务”；拖动手柄背景透明且伪元素隐藏。

## 2026-06-04 交互手感二次修正

### 已完成
- 修复小猫听写后对话框把头像往下顶的问题：对话框改为绝对定位在头像上方，并允许横向更宽、内容滚动。
- 语音自动写入停顿时间从 4 秒改为 2 秒，空状态文案同步说明“停顿 2 秒自动写入”。
- 中间一周安排不再展示待补充事项；没有明确开始/结束时间的事项只在右侧“待补充事项”中出现。
- 日历时间块拖动时增加实时位置预览，松手后按 10 分钟刻度保存；上下边缘手柄变得可见，用于调整开始时间或结束时间。
- 开会/会议卡片颜色从蓝色改为暖色系，保持整体暖色调。
- 出门提醒收紧：取消随机感强的全日天气泛提醒；外出识别去掉“去/到/面试/见”等过宽关键词，只对更明确的出门/通勤/交通/医院等场景生成提醒。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 后端 `http://127.0.0.1:8787` 已重启。
- 浏览器检查：小猫对话框位于头像上方；周四中间列不再显示“面试 待补充时间”；右侧仍显示待补充事项；会议卡片为暖色；泛化“如果要出门”提醒消失；会议块有 2 个上下调整手柄。

## 2026-06-03 交互反馈集中修正

### 已完成
- 将右侧事项编辑从右下角悬浮框改为日期详情内的内联编辑：具体安排、待补充事项、截止任务均通过卡片内“编辑”进入可编辑状态。
- 中间一周安排和右侧日期详情之间新增可拖动分隔条，可轻微调整右侧详情宽度。
- 中间一周安排保留日历块拖动/上下边缘拉伸；截止任务改为时间轴上的截止线标记，点击后在右侧对应日期详情里编辑。
- 右侧信息结构调整为：具体安排、待补充事项、截止任务、提醒；提醒下分出门提醒和事件提醒，并保留书面提醒入口。
- 移除右侧执行记录展示，避免日期详情被执行日志挤占。
- 小猫语音入口改为点小猫开始听，停顿 4 秒后自动写入；不再显示“说话/确定”按钮。
- 加强时间不明确等补充说明的视觉提示，使用更醒目的暖色提示块。
- 天气/出门提醒默认不再写死“上海”；只有用户配置天气城市后才显示城市名。

### 验证
- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 浏览器预览 `http://localhost:5175/` 可打开；后端 `http://127.0.0.1:8787` 已重启并生效。
- 浏览器检查无 console error；旧的 `.detail-popover` 不再渲染；分栏拖动柄存在；小猫文案已变为“点一下小猫开始说话。”；天气文案不再包含“上海”。

## 2026-06-03 对话收尾与文档同步

### 本次收尾更新

- 更新 `PROJECT_CONTEXT.md`：同步 V1.1 当前状态，说明语音对话优先、右侧日期详情、一周安排拖拽/拉伸、天气/出门提醒、浅色涂鸦风等最新方向。
- 更新 `README.md`：修正已实现能力清单，补充 DeepSeek 配置方式、AI 状态检查接口、0:00-24:00 时间轴、日历块拖拽、内联编辑、天气提醒等内容。
- 更新 `DECISIONS.md`：沉淀 V1.1 的关键产品和技术决策，包括单一小猫对话气泡、右侧详情结构、10 分钟粒度日历操作、冲突判断规则、天气提醒和视觉方向。
- `TODO.md` 已在上一轮实现时同步勾选 V1.1 试用反馈完成项，并保留后续待打磨项。

### 当前可交接状态

- V1.1 试用反馈主线已经完成并验证：输入理解、明确时间不误追问、右侧内联编辑/删除、执行记录编辑/删除、日历块拖拽/拉伸、冲突视觉、小猫语音对话、天气/出门提醒、浅色涂鸦风主题均已落地。
- 本地服务最近一次状态：前端预览为 `http://localhost:5174/`，后端为 `http://localhost:8787`，DeepSeek key 已配置。
- 最近验证命令均已通过：`npx tsc --noEmit --pretty false`、`npm run build`。

### 下次建议

1. 做一次浏览器手工验收和截图，重点看浅色涂鸦风在真实页面里的层级、对比度和文字是否拥挤。
2. 增加设置入口：作息偏好、默认城市/天气坐标、默认日历显示范围。
3. 继续精修右下角详情：地点、提醒时间、准备事项增删控件，而不是仅用文本拆分。
4. 整理一版作品集展示截图和 V1.1 功能说明。

## 2026-06-03 V1.1 试用反馈修复记录

### 已完成

- 确认 DeepSeek 后端配置已生效：`/api/ai/status` 返回 `provider: deepseek`、`configured: true`，不会暴露 API Key。
- 增加任务/待定事项/日程的基础管理能力：后端新增任务和日程的 `PATCH`、`DELETE` 路由；删除采用软删除/取消，不直接抹掉本地记录。
- 右侧日期详情支持点击事项后进入详情，并提供基础“编辑 / 删除”操作；当前编辑先用浏览器 prompt 完成标题和备注修改。
- 统一追问与确认交互：时间模糊进入独立补充回答卡片；重复、冲突、过载等需要决策的问题进入独立选择卡片。
- 修复补充时间段解析：`下午2:00~3:00` 会和原始输入合并后重新解析为 14:00-15:00。
- 一周安排时间轴扩展为 0:00-24:00，覆盖凌晨安排和较晚作息。
- 一周安排增加当天列顶部的待定事项/任务短预览，只展示短标题和截止/待定信息；无具体时间的任务不再漂在时间轴中或跨天显示。
- 重新启动后端服务，当前后端监听 `http://localhost:8787`，前端预览仍为 `http://localhost:5174`。
- 进一步将右下角详情从 prompt 编辑升级为内联编辑表单：日程可改标题、日期、开始/结束时间和备注；任务可改标题、截止时间、估时和备注；删除仍采用软删除。
- 新增执行记录管理：后端新增 `PATCH /api/work-logs/:id` 和 `DELETE /api/work-logs/:id`；前端执行记录可点击后编辑内容/时间或删除，提醒生成的历史行保持只读。
- 新增日历块拖拽与拉伸：时间块可拖动改变开始时间，可拖上下边缘调整开始/结束时间，并按 10 分钟粒度吸附后保存。
- 新增冲突视觉同步：后端日历数据透出 `conflict`，左侧时间块和右侧具体安排都会显示“已冲突”；重叠时使用醒目的暖色边线，但不使用强烈大红。
- 收敛小猫对话：移除底部普通文本输入框，改为一个小猫气泡内的语音实时转写、确认按钮、追问/选择/理解预览；避免多个追问框同时出现。
- 修复误追问根因：冲突检测只统计 `scheduled` 日程，已取消/已移动的旧事项不再触发重复或时间冲突。
- 初步切换浅色涂鸦风主题：整体改为暖白纸感背景、橘黄/肉色调，过去日期更灰、更弱，今天和冲突安排更醒目。
- 增加天气/出门提醒：后端读取 Open-Meteo 7 天游雨概率，识别外出类安排，在对应日期生成“出门前带伞”等天气提醒；小猫会在当天临近外出前显示这类提醒。
- 右侧日期详情进一步减噪：移除普通提醒列表，只保留具体安排、出门提醒和执行记录；普通提醒仍在数据层和通知能力中保留。
- 详情内联编辑补充结构化字段：目的和准备事项可以直接改，准备事项支持换行/逗号/顿号拆分保存。

### 验证

- `npx tsc --noEmit --pretty false`：通过。
- `npm run build`：通过。
- `/api/ai/status`：返回 DeepSeek 已配置。
- Node API 验证：`明天下午2:00~3:00跟同学开项目会...` 返回 `needsConfirmation: false`，时间解析为 `2026-06-04T14:00:00+08:00` 到 `2026-06-04T15:00:00+08:00`。
- `/api/bootstrap` 验证：返回 7 天日历数据，`today.weatherAlerts` 和整周 `weatherAlerts` 字段正常返回。

### 下一轮建议

1. 增加用户作息偏好设置入口，例如常用睡觉/起床时间和默认显示范围。
2. 继续精修涂鸦风视觉：手写感分隔线、安排块质感、图标和空状态。
3. 后续可把天气城市从默认上海改成可配置项，或接浏览器定位。
4. 继续打磨内联编辑：补提醒时间、地点等更细字段的可编辑能力。

## 2026-06-02 V1.1 实现记录

### 已完成

- 实现输入理解确认卡片：小猫输入区从单行预览升级为结构化卡片，展示类型、标题、时间、目的、准备事项、估时、备注和确认问题。
- 增强输入解析与写入字段：事件支持 `purpose`、`preparations`、`notes`、`reminderIds`；任务支持 `preparations`、`notes`；提醒支持 `relatedType`、`relatedId`；执行记录支持轻量反馈字段。
- 增强右侧日期详情：选中日期可以展示完整安排、会议目的、准备事项、提醒、备注和执行记录；中间一周安排继续保持短标题。
- 保留轻量动态安排策略：模糊时间、冲突、重复和过载仍进入确认；无冲突明确信息直接写入。
- 增加陪伴式反馈：提交成功、拆分、延期、冲突处理、进度记录和复盘记录优先展示后端返回的温和短反馈。
- 根据试用反馈修正日历展示：一周安排只展示有明确开始/结束时间的日程方块，任务和待定事项改放到右侧日期详情，避免像跨天事项一样漂在时间格顶部。
- 根据试用反馈增强输入理解：`面试`、`项目会` 等表达会识别为日程；只有“明天下午”这类模糊时间时会追问具体时间，不再随便写入一个点。
- 接入 DeepSeek AI adapter：新增 `server/aiAdapter.ts`，支持从 `.env.local` / `.env` 或环境变量读取 `DEEPSEEK_API_KEY` / `DEEPSIG_API_KEY`；有 key 时 AI 优先解析，无 key 或失败时回退规则解析。
- 新增 `/api/ai/status`：可查看 AI provider、base URL、model 和是否已配置 key，不返回密钥。
- 新增 `.env.example`：说明 DeepSeek API Key、base URL 和 model 的本地配置方式。
- 增强 AI 状态判断：占位符 key 不再算作已配置，`/api/ai/status` 会返回 `keyLooksPlaceholder`，避免误以为已经调用 AI。
- 增强模糊时间兜底：即使 AI 返回了猜测时间，只要原文只有“上午/下午/晚上/凌晨”等模糊时间且没有具体几点，后端也会强制进入追问。
- 调整一周安排时间轴：前端从 7:00-24:00 改为 0:00-24:00，并显示 0、4、8、12、16、20、24 点刻度，覆盖凌晨安排和睡眠场景。
- 修复追问交互：时间模糊时进入独立的“补充回答”对话框，用户补充 `下午2:00~3:00` 会和原始输入合并解析，不再被当成孤立新任务。
- 修复时间段解析：后端支持 `下午2:00~3:00` 这类带上午/下午语义的范围，并正确归一化为 14:00-15:00。
- 增加待定事项/任务和日程的基础管理：右侧详情和时间块详情可进入编辑/删除，后端新增任务/日程 PATCH 与 DELETE 路由；删除采用软删除/取消，避免直接抹掉本地记录。
- 统一确认交互：时间追问、重复、冲突、过载等需要用户决策的问题都进入独立确认卡片，不再塞在旧理解预览卡片里。

### 验证

- `npx tsc --noEmit --pretty false`：已通过。
- `npm run build`：已通过。
- 解析验证：`明天下午有个面试...` 会进入时间追问；`明天下午 3 点有个面试...` 会识别为 `meeting`，标题浓缩为 `x公司面试`。
- AI 状态验证：`/api/ai/status` 当前返回 `configured: false`，表示代码已接入但本机尚未配置 key。
- AI 状态复查：当前 `.env.local` 仍是占位符，`/api/ai/status` 返回 `configured: false`、`keyLooksPlaceholder: true`。
- 追问验证：`明天下午有个面试...，补充信息：下午2:00~3:00` 可解析为 DeepSeek 结果 `2026-06-04T14:00:00+08:00` 到 `2026-06-04T15:00:00+08:00`；当前出现重复提示是因为本地已有相似面试记录。
- 本轮验证：`npx tsc --noEmit --pretty false` 通过，`npm run build` 通过；后端已重启，`/api/ai/status` 返回 DeepSeek 已配置。

### 下一步建议

- 用 5 个 V1.1 验收场景做手工预览：会议输入、模糊时间追问、时间冲突方案、任务估时写入、进度/提醒反馈。
- 后续如要继续增强，可再接入真实 AI adapter 作为规则解析兜底，但 V1.1 当前不依赖模型。

## 2026-06-02 V1.1 迭代规划记录

### 产品决策

- MVP 已完成，V1.1 不以继续堆复杂功能为目标，而是提升基础好用程度。
- 首页第一屏继续保持“一周安排”：左侧/中间是一周预览，右侧是选中日期详情。
- AI 感优先体现在输入理解：用户可以像跟小猫说话一样输入会议、提醒、任务、临时想法和准备事项。
- 小猫需要把自然语言抽取成结构化信息，并在用户确认后写入计划表。
- 右侧日期详情需要展示完整信息：会议目的、准备事项、提醒、备注和执行记录。
- 小猫角色保持陪伴型助手，不做严厉监督型助手；反馈要短、温和、可继续行动。

### 本次文档更新

- 更新 `PROJECT_CONTEXT.md`：新增 V1.1 迭代方向和阶段路线说明。
- 更新 `TODO.md`：新增 V1.1 P0/P1/P2 阶段任务。
- 新增 `docs/sdd/14-v1.1-input-understanding.md`：输入理解确认 SDD。
- 新增 `docs/sdd/15-v1.1-date-detail.md`：日期详情增强 SDD。
- 新增 `docs/sdd/16-v1.1-dynamic-arrangement-and-reward.md`：轻量动态安排与奖励反馈 SDD。

### 下一轮执行建议

1. 先实现 V1.1 P0 输入理解确认：扩展 parse/commit 的结构化字段和前端确认预览。
2. 再实现 V1.1 P1 日期详情增强：让右侧面板展示目的、准备事项、提醒、备注和执行记录。
3. 最后补 V1.1 P2 轻量反馈：冲突/过载方案和完成/延期后的陪伴式反馈。
4. 本轮代码实现仍保持低风险增量，不引入复杂自动排程引擎和强游戏化系统。

## 2026-06-01 项目推进记录

### 已完成

- 产品名确认：`YayaMind`。
- 完成 SDD 主体文档：`docs/sdd/00-product-scope.md` 到 `docs/sdd/13-implementation-roadmap.md`。
- 技术栈确认并落地：React + TypeScript + Vite 前端，Node.js + Fastify 本地后端，本地 JSON/JSONL 数据。
- 创建第一轮代码脚手架：
  - `src/App.tsx`
  - `src/styles.css`
  - `server/index.ts`
  - `server/dataStore.ts`
  - `server/types.ts`
- 已安装依赖并启动过本地服务：
  - 前端：`http://localhost:5173`
  - 后端：`http://localhost:8787`
- `npm run build` 已通过。
- 已跑通基础数据写入闭环：
  - 任务写入 `tasks.jsonl`
  - 提醒写入 `reminders.jsonl`
  - `/api/bootstrap` 可读取今日数据和本周数据。
- UI 已调整为深色工作台方向：
  - 左侧窄导航。
  - 中间本周计划。
  - 右侧今日面板。
  - 本周与今日区域接近 1:1。
  - 计划项默认短标题，点击后看详情。
  - 品牌图标方向为 `Y + 猫爪` 融合。
  - 小猫浮窗方向为布偶猫风格。
- 已增强自然语言输入解析：
  - 可区分任务、日程/时间块、开始/暂停/继续/结束工作、进度、复盘和生活提醒。
  - `/api/input/parse` 与 `/api/input/commit` 复用同一套规则解析。
  - 模糊时间事项会返回确认问题，不直接写入。
  - 复盘原因写入 `reviews.jsonl`，执行状态写入 `work_logs.jsonl`。
- 已增强 Web 输入反馈：
  - 小猫输入时显示解析预览。
  - 提交后根据意图给出不同反馈。
  - 模糊时间会保留输入并提示补充具体时间。
- 已增强日历列视图：
  - 事项按 7:00-24:00 时间轴定位。
  - 今天显示过去时间置灰和当前时间线。
  - 日程/时间块按类型颜色展示。
- 已增强今日执行面板：
  - 当前状态区显示专注时长。
  - 增加基于当前状态、今日计划和提醒的小猫建议。
- 已增强写入前确认保护：
  - 模糊时间不直接写入。
  - 明确时间段优先识别为日程/时间块，避免被“继续”等动词误判成工作状态。
  - 新时间块与已有安排重叠或疑似重复时，parse 和 commit 都会提示确认并阻止直接写入。
- 已实现轻量冲突处理方案：
  - 冲突预览会展示 1-2 个处理方案。
  - `保留已有安排` 会把新事项写成待定日程。
  - `使用新时间` 会把冲突的已有日程标记为 `moved`，并写入新时间块。
- 已增强提醒触发：
  - `/api/bootstrap` 会把到点的 `pending` 提醒自动更新为 `triggered`。
  - 前端定时刷新今日数据，新触发提醒会让小猫冒泡。
  - 右侧提醒区支持开启浏览器通知；授权后到点提醒会弹系统通知。
- 已增强任务冲突与计划过载：
  - 疑似重复任务会给出 `继续新增` / `只保留已有任务` 两个选择。
  - 今日任务带估时时，会和剩余可安排时间比较；过载时给出 `先记录为待拆分` / `改到明天`。
  - 选择待拆分会给任务打 `needs_split` 标签；选择改到明天会移动 `dueAt`。
- 已继续打磨提醒和日历：
  - 提醒支持完成、稍后 10 分钟、忽略。
  - 重叠时间块支持 `两个都保留，并列显示`，日历数据会返回 `lane` / `laneCount`。
  - 待定事项从时间轴中分离到日列顶部，避免和具体时间块混在一起。
  - 提醒完成/忽略后会从未处理提醒中移除，并在今日执行记录中留下处理记录。
- 已按反馈调整一周视图：
  - 中间区域标题从“本周计划”改为“一周安排”。
  - 日历范围改成自然周周一到周日。
  - 列头显示日期和周几，例如 `今天 周二 6/2`，移除下方 `2026-xx-xx` 小字。
  - 空列不再显示“空空的，可以放点计划”。
  - 整体字体略微收小，提升信息密度。
- 已增强今日面板快捷进度：
  - 当前状态区增加 `写了一半`、`卡住了`、`可能做不完` 三个快捷按钮。
  - 快捷按钮复用输入解析链路，写入 `work_logs.jsonl` 的进度记录。
- 已按最新反馈调整主工作台：
  - 一周安排列头改为大字周几、小字日期。
  - 移除列头“今天”文字，改用列背景区分过去、今天和未来。
  - 过去日期整列灰色；今天列使用主题色，过去时间继续置灰。
  - 移除右上角“正在校准今天”。
  - 右侧移除当前状态、小猫建议、今日计划，改为点击某一天后展示该日具体安排和执行记录。
  - 小猫浮窗改用原创布偶猫动画头像，并支持拖动。
- 已补齐 MVP 后半段能力：
  - 新增阶段性目标数据文件和 API，前端支持新增目标与更新状态。
  - 新增个人画像雏形，基于执行记录和任务信号展示时间习惯、估时模式、生活节奏和近期信号。
  - 新增每日/每周 Markdown 总结生成，输出到 `personal-assistant-data/summaries/`。
  - 右侧日期详情在选中今天时展示未处理提醒，支持开启浏览器通知、完成、稍后和忽略。
- 已完成作品集包装材料：
  - 更新 `README.md`。
  - 新增 `docs/portfolio/ARCHITECTURE.md` 架构图。
  - 新增 `docs/portfolio/DEMO_GUIDE.md` 演示脚本。
  - 新增 `docs/portfolio/DEMO_DATA.md` 演示数据建议。
  - 新增 `docs/portfolio/FEATURES.md` 功能说明。
  - 新增截图 `docs/portfolio/screenshots/yayamind-workbench.png`。
- 已完成验证：
  - `npx tsc --noEmit --pretty false` 通过。
  - `npm run build` 通过。
  - 本地 API `/api/bootstrap` 返回自然周、今日提醒、目标和画像数据。
  - Chrome headless 截图确认工作台、日期详情、提醒处理和布偶猫浮窗正常渲染。

### 当前状态

- 第一轮 Web MVP 已完成：一周安排、日期详情、自然语言写入、冲突确认、提醒处理、目标、画像、Markdown 总结和布偶猫浮窗均已具备可演示闭环。
- 当前仍是 Web 模拟版，不是桌面常驻应用；真实 AI adapter、系统级常驻提醒、屏幕理解和移动端入口仍在暂缓范围。
- `TODO.md` 是当前总计划和任务清单；`TASK_LOG.md` 是推进记录；`PROJECT_CONTEXT.md` 是项目背景和架构上下文。

### 下轮优先事项

1. 做一次带演示数据的完整录屏或截图组，形成作品集展示页。
2. 继续打磨右侧日期详情：补充地点、注意事项、会议内容等结构化字段。
3. 继续打磨小猫浮窗：拖动位置记忆、靠边吸附、输入区层级。
4. 准备后续 AI adapter：规则优先，AI 兜底分类和表达。

### 协作规则沉淀

- 全局 `AGENTS.md` 已精简，只保留跨项目通用原则。
- 原 `idea-to-product-brief` skill 已重命名为 `productize`。
- 产品从想法到 SDD、原型反馈、连续推进等细规则放入 `productize`。
- 复盘和规则放置判断放入 `review` skill。

## 2026-06-07 项目待办与日程详情交互集中修正

### 已完成

- 新增项目待办数据能力：后端增加 `todo_projects.json`，任务支持 `projectId` 和 `status`，并提供项目增删改、任务新增、任务移动和状态更新 API。
- 左侧导航新增 `待办` 入口；待办页按项目分类展示，不按日期展示。
- 项目分类支持直接新增、点击项目名称原地改名、删除项目；“未归类”点击改名时会自动创建真实项目并迁移原未归类任务。
- 待办事项支持点击标题原地编辑、点击备注或“添加备注”编辑备注、失焦自动保存；标题编辑时按回车会保存当前条并开始下一条同项目待办。
- 完成待办时会进入完成状态、文字变浅灰、加删除线，并通过视图过渡动画下沉到项目最底部。
- 待办可拖到另一个项目分组中完成跨项目移动；拖动时使用自定义猫爪光标和轻量拖拽浮层。
- 右侧待办面板改为当月日历；待办拖到某一天会写入 `dueAt`，备注不再混入日期信息。
- 日期 tag 与备注分离：tag 由 `dueAt` 派生，单独一行显示，可点击清除，不可直接编辑；备注仍可单独编辑。
- 月历日期按项目色显示 deadline 色点；项目分组也使用同色系背景和边线，便于区分。
- 一周日程左上角补充小字 `一周日程`；中间周视图移除截止任务划线，右侧日期详情仍保留截止任务列表。
- 一周日程时间轴改为只显示 7:00 以后，并修复此前只显示到 14 点的问题，当前覆盖 7:00-24:00。
- 右侧日期详情默认回到只读展示，不再一进入详情就显示编辑表单；同时移除显眼的编辑按钮和“其他”噪音标签。
- 明确包含 `新增`、`新加`、`添加`、`有一个`、`待办`、`项目代办` 的语音/文本优先按新增任务链路处理，避免被前端确认卡片拦截。

### 验证

- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 本地前端 `http://127.0.0.1:5173` 返回 200，后端 `/api/bootstrap` 返回 200。
- API 已验证：语音式新增待办、项目间移动、deadline 设置/清除、备注与日期 tag 分离均能正常工作。

### 未完成和风险

- 语音转写后的 AI 改写/纠错尚未真正接入；本轮主要修复明确待办语句被误拦截的问题。
- 字体和字号仍需继续精修，尤其是中文不要显得太像默认黑体。
- 右侧日期详情的字段级点击编辑还未完整做完，只是先恢复了默认只读状态并隐藏显眼编辑按钮。
- 待办拖拽、猫爪光标、月历色点和分栏缩放还需要一次真实浏览器视觉验收。

## 2026-06-07 语音纠错、待办语义和拖拽手感修正

### 已完成

- 语音转写进入解析前会先做纠错；`项目代办` 会修为 `项目待办`，`开为` 会修为 `开会`，并在前端气泡中短暂显示修正后的转写文本。
- 前端听写中不再用实时草稿提前弹出“缺具体事项/缺时间”的追问；停顿后先进入理解，再根据 AI/规则解析结果决定是否追问。
- 修复 `明天下午有个面试` 被 AI 日期误推到错误日期的问题：本地规则会对 `今天/明天/后天/周几` 再做日期校正，当前验证为 `2026-06-08`。
- 项目待办语义抽取增强：`学校新增一个待办，周四要提交开题报告的表格版` 会把 `学校` 识别为项目，把标题清理为 `提交开题报告的表格版`，`周四` 写入 deadline tag。
- 待办包含具体时间点时，时间点写入备注，例如 `周四下午3点要提交开题报告` 的备注为 `时间：下午3点`。
- 右侧日期详情只展示带具体时间点的截止任务；只有日期、没有具体时间点的待办保留在项目待办页，通过日期 tag 和月历色点表达。
- 项目待办拖拽手感调整：移除自定义猫爪拖拽图，待办卡片长按/拖动使用系统抓取光标；完成圆圈保持点击指针。
- 待办标题/备注失焦保存改为本地乐观更新，用户输入后离开焦点会立刻在列表中看到变化。
- 空项目下提供 `写第一条待办` 入口；项目名编辑后按回车会保存并直接聚焦到该项目的新待办输入。
- 未来日程视图固定使用 7 列宽度，即使只有一天未来日程，也不会把单列拉到整屏宽。
- 右侧详情卡片颜色改为更深的暖棕层级，避免浅灰和纯黑；全站字体栈优先使用楷体/仿宋/文楷类字体，减少默认黑体感。
- 小猫反馈消息会在 10 秒后自动回落到默认提示 `还有什么安排，我听你说。`

### 验证

- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 本地前端 `http://127.0.0.1:5173` 返回 200，后端 `/api/bootstrap` 返回 200。
- API 验证：`明天下午有个面试` 返回 `date: 2026-06-08` 且继续追问具体几点；`学校新增一个代办，周四要提交开题报告的表格版` 返回 `add_task`、标题 `提交开题报告的表格版`、`dueAt` 为周四；`周四下午3点要提交开题报告` 会把 `时间：下午3点` 写入备注。

### 未完成和风险

- 本轮仍未做真实浏览器拖拽视觉验收；当前环境没有可用的 Browser 控制执行工具，仍需要后续在真实页面里检查长按拖拽、分栏缩放和月历色点。
- 语音纠错已经避免重复纠错，但仍可能发生一次纠错解析和一次提交解析，后续可继续压低延迟。

## 2026-06-08 测试用例清单与首轮回归修正

### 已完成

- 新增 `TEST_CASES.md`，按模块整理为可勾选测试清单；本轮追加了“工作阶段新增一个写PPT”、澄清后补时间、下午时间段和会议改期等回归用例。
- 修复 `工作阶段新增一个写PPT` 这类“项目名 + 新增一个 + 事项”被误判为日程的问题；当前解析为 `add_task`，标题只保留 `写PPT`。
- 语音纠错规则补充 `行政一个代码`、`新增一个代码` 等待办误识别，当前可修正为 `新增一个待办` 再进入解析。
- 补强口语时间段解析：`下午三点到三点半`、`下午的三点到三点半`、`下午3:00~4:00` 会按中国时区下午时间写入。
- 更新事件改期解析守卫：明确时间和日期会覆盖 AI 的错误结果，避免 `明天下午3:00~4:00` 落到凌晨或错误结束时间。
- 待办完成按钮增加事件隔离和乐观更新，点击圆圈应立即触发完成/恢复；卡片长按时标题和备注区域也会显示系统抓取光标。
- 日程拖动保存时保留拖拽预览直到刷新完成，减少鼠标松开后先弹回旧位置的观感。
- 小猫空闲态改为不显示气泡，头像进入睡眠/休息态；只有有消息、听写、理解、追问或确认卡片时才显示气泡。

### 验证

- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 重启本地开发服务后，前端 `http://127.0.0.1:5173` 返回 200，后端 `/api/bootstrap` 返回 200。
- API 回归通过：`工作阶段新增一个写PPT` -> `add_task / 写PPT`；`学校行政一个代码，周四要提交开题报告的表格版` -> 纠正为新增待办并生成周四 deadline；`后天下午有面试，补充信息：后天下午的三点到三点半` -> 面试 15:00-15:30；`明天下午3:00~4:00有机器人会议` 和 `把明天的机器人会议改到下午3:00~4:00` -> 下午 15:00-16:00。

### 未完成和风险

- 当前环境没有暴露 in-app Browser 的 Node 控制工具，因此本轮未能做真实浏览器截图级验收；待办圆圈点击、拖拽手势、小猫睡眠态和日程拖动观感仍建议按 `TEST_CASES.md` 在页面中逐条勾选。
- 澄清补充时间后若与已有日程冲突，系统仍会进入冲突确认，这是预期行为；关键是不再追问“这个时间段要干什么”。

## 2026-06-08 Chrome CDP 运行态补充验收

### 已完成

- 为事件卡片和待办卡片增加 `data-event-id`、`data-task-id`，便于后续自动化验收和精确定位，不改变界面展示。
- 待办完成状态增加渲染层乐观覆盖表，点击圆圈后先按本地状态显示完成/恢复，再等待后端刷新对齐，避免点击后视觉无反应。

### 验证

- 使用系统 Chrome headless + DevTools Protocol 打开 `http://127.0.0.1:5173`，确认空闲状态没有 `.cat-dialog`，小猫头像存在 `.cat-sleeping`，页面正文不再出现默认提示 `还有什么安排`。
- 临时创建待办并在真实页面点击圆圈：点击前按钮光标为 `pointer`，点击后 DOM 出现 `todo-done`，标题 `text-decoration` 为 `line-through`，后端任务状态为 `done`；测试结束后删除临时任务。
- 临时创建待办并在真实页面按住标题文字：按住前标题光标为 `text`，按住后标题和卡片光标均为 `grabbing`。
- 临时创建明天下午 17:00-18:00 日程并拖动：拖动中卡片 top 从 `58.8235%` 到 `61.7647%`，松手瞬间保持 `61.7647%`，1.5 秒后仍保持该位置；后端同步为 17:30-18:30，未出现回弹。
- `npx tsc --noEmit --pretty false` 通过，`npm run build` 通过。

### 风险

- 浏览器语音识别本身仍需用户真实麦克风环境验收；本轮已通过代码路径确认追问后会自动调用 `startVoiceInput({ silent: true })`，但无法在 headless Chrome 中模拟系统语音输入。
# 2026-06-12 桌面小猫语音实时转写与取消语义修正

## 已完成

- 桌面版 Windows 语音识别改为通过 `SpeechHypothesized` 事件实时发送转写草稿，前端继续写入小猫气泡里的转写区域。
- 听写中再次单击小猫改为“取消当前会话”：清空当前输入、追问/决策状态和修改状态，小猫回到睡觉状态。
- 修复手动取消后仍被记录为 `windows-speech-empty` 的问题；取消现在记录为 `windows-speech-cancelled`，不会再提示“刚才没听清”。
- 明确语音理解链路：原始语音实时转写 -> AI/规则纠错 rewrite -> 意图判断 -> 缺槽追问或写入。
- 回放验证 `明天上午有会要开`：解析为 `add_event`，日期为 2026-06-13，因缺少具体几点返回追问 `明天上午几点开会？`。

## 验证

- `node --check electron/main.cjs` 通过。
- `npm run build` 通过。
- `npm run desktop:pack` 通过，最新 EXE 输出到 `D:\YayaMindBuild\release\win-unpacked\YayaMind.exe`。
- 打包版真实启动后模拟单击开始、再次单击取消：日志出现 `voice-start-request`、`bubble-state:listening`、`voice-stop-request`、`bubble-state:sleeping`、`windows-speech-cancelled`。
- API 回放 `/api/input/parse`：`明天上午有会要开` 正确进入缺具体时间追问，不直接写入。

## 后续

- 仍需用户在真实麦克风环境下验证实时转写的颗粒度；当前代码已支持 partial，但 Windows 识别引擎实际输出频率取决于系统语音服务。
- 新用户教程需要覆盖：单击开始说话、再次单击取消、双击打开/关闭工作台、缺时间/缺事项时如何回答追问、听不清时重新说一遍。
