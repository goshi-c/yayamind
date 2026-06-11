# YayaMind 部署说明

## 当前目标

YayaMind 现在分成两种使用方式：

- **作品集预览版**：面试官打开公开网址，可以看到产品界面和核心体验。
- **真实云端可用版**：你打开同一个网址，先登录账号，然后录入日程、待办、提醒，数据保存到云端数据库。

当前代码仍保留本地优先能力：本地开发时，React/Vite 前端调用 `/api/*`，Fastify 后端写入 `personal-assistant-data/`。这个本地数据目录已经被 `.gitignore` 忽略，不会上传到 GitHub。

## 已经完成的代码能力

当前项目已经支持：

- Vercel 部署前端页面。
- Vercel `/api/*` Serverless 后端。
- Supabase 云端存储。
- Supabase 邮箱 + 密码登录。
- 退出账号和切换账号。
- 按账号隔离数据：不同账号登录后看到不同数据。
- 没配置 Supabase 时，线上继续展示演示数据，不会空白。

## Vercel 部署配置

Vercel 项目设置：

```text
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

当前公开网址：

```text
https://yayamind.vercel.app/
```

## GitHub 状态

GitHub 仓库：

```text
https://github.com/goshi-c/yayamind
```

不要提交这些内容：

- `.env`
- `.env.local`
- `personal-assistant-data/`
- `node_modules/`
- `dist/`
- `*.log`

这些已经写在 `.gitignore` 里。

## 必须手动做的事

下面这些步骤涉及你的 Supabase 账号和私钥，需要你自己在网页后台操作。我已经把代码接好了，但不能替你拿 `service_role key`。

## 第 1 步：创建 Supabase 项目

1. 打开 Supabase。
2. 新建一个 Project。
3. 项目名可以叫：

```text
yayamind
```

4. 选择数据库地区时，离你近一点即可，例如新加坡、日本、美国都可以。
5. 等项目创建完成。
## 第 2 步：创建数据表

进入 Supabase 项目后：

1. 打开左侧 `SQL Editor`。
2. 新建 Query。
3. 粘贴并运行下面这段 SQL：

```sql
create table if not exists public.yayamind_store (
  key text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);
```

这个表会保存 YayaMind 的云端数据。代码会自动按账号隔离，例如：

```text
用户A/events.jsonl
用户A/tasks.jsonl
用户B/events.jsonl
用户B/tasks.jsonl
```

你不需要手动往表里插入数据。

## 第 3 步：开启邮箱密码登录

在 Supabase 项目里：

1. 打开左侧 `Authentication`。
2. 找到 `Providers`。
3. 确认 `Email` 已开启。
4. 为了第一次部署最省事，建议先关闭邮箱验证：

```text
Authentication -> Sign In / Providers -> Email -> Confirm email
```

把 `Confirm email` 关掉。

如果你保留邮箱验证，第一次注册后必须去邮箱点确认链接，否则无法登录。

## 第 4 步：找到 Supabase 环境变量

在 Supabase 项目里打开：

```text
Project Settings -> API
```

你需要复制这些值：

```text
Project URL
anon public key
service_role key
```

注意：

- `anon public key` 可以给前端用。
- `service_role key` 是私钥，只能放到 Vercel 环境变量里，不能写进前端代码，不能公开发给别人。

## 第 5 步：配置 Vercel 环境变量

进入 Vercel：

```text
Project -> yayamind -> Settings -> Environment Variables
```

添加下面 5 个变量。

后端变量：

```text
SUPABASE_URL=你的 Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
SUPABASE_YAYAMIND_TABLE=yayamind_store
```

前端变量：

```text
VITE_SUPABASE_URL=你的 Project URL
VITE_SUPABASE_ANON_KEY=你的 anon public key
```

如果你想让线上也使用 DeepSeek，再加：

```text
DEEPSEEK_API_KEY=你的 DeepSeek key
DEEPSEEK_MODEL=deepseek-chat
```

## 第 6 步：重新部署 Vercel

环境变量添加后，需要重新部署。

在 Vercel：

```text
Deployments -> 选择最新一次部署 -> Redeploy
```

重新部署完成后，打开：

```text
https://yayamind.vercel.app/
```

预期结果：

- 页面先显示登录 / 注册。
- 第一次使用时点“第一次用，创建账号”。
- 注册后进入 YayaMind。
- 之后录入的数据会保存到 Supabase。
- 点左侧“退出”可以退出账号。
- 换另一个账号登录，会看到另一套数据。

## 如何判断是否配置成功

配置成功后：

1. 打开 `https://yayamind.vercel.app/`。
2. 能看到登录页。
3. 注册或登录后进入主界面。
4. 新增一个待办或日程。
5. 刷新页面后，这条数据仍然存在。
6. 去 Supabase 的 `Table Editor` 查看 `yayamind_store`，应该能看到对应数据行。

## 当前云端版本的边界

当前是“可真实使用的第一版云端模式”，不是完整商业化多用户系统。

已经有：

- 登录。
- 注册。
- 退出。
- 切换账号。
- 每个账号独立数据。
- 云端持久化。

暂时还没有：

- 找回密码页面。
- 邮箱验证后的完整引导。
- 用户资料页。
- 管理后台。
- 精细化数据库表结构。
- 多设备冲突合并。

这些可以后续继续迭代。

## 常见问题

### 1. 为什么没配置 Supabase 前还是演示数据？

因为 Vercel 静态网页本身不能保存你的真实数据。没有 Supabase 环境变量时，后端不会写临时文件，前端会继续展示演示数据。

### 2. 为什么要 `service_role key`？

后端需要用它读写 Supabase 表。它只存在 Vercel 的服务端环境变量里，不会打包进前端。

### 3. 为什么还需要 `anon public key`？

前端登录 / 注册需要用 Supabase 的公开 anon key。这个 key 可以放到 `VITE_SUPABASE_ANON_KEY`。

### 4. 能不能让别人也用？

可以。别人注册自己的账号后，会有自己的数据空间。

但如果要正式开放给很多人，后续最好继续加：

- 找回密码。
- 邮箱验证。
- 使用条款。
- 数据删除。
- 更细的数据库权限策略。

### 5. 本地版本还能用吗？

可以。本地不配置 Supabase 时，仍然使用：

```text
personal-assistant-data/
```

也就是你原来的本地文件模式。
