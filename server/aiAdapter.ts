import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ParseResult, ParsedIntent } from './types.js';

const allowedIntents: ParsedIntent[] = [
  'add_event',
  'update_event',
  'delete_event',
  'annotate_event',
  'add_task',
  'start_work',
  'pause_work',
  'resume_work',
  'finish_work',
  'progress_update',
  'add_reminder',
  'review_note'
];

let cachedEnv: Record<string, string> | null = null;

export async function parseTextWithAi(
  text: string,
  now: string,
  context: { projectTitles?: string[] } = {}
): Promise<ParseResult | null> {
  const env = await getEnv();
  const config = await getAiRuntimeConfig(env);
  if (!config.apiKey || !config.enabled || !text.trim()) return null;

  const { apiKey, baseUrl, model } = config;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        stream: false,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(now, context)
          },
          {
            role: 'user',
            content: text
          }
        ]
      })
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return normalizeAiResult(content, text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function correctTranscribedTextWithAi(text: string): Promise<string | null> {
  const env = await getEnv();
  const config = await getAiRuntimeConfig(env);
  const { apiKey, baseUrl, model } = config;
  const original = text.trim();
  if (!apiKey || !config.enabled || original.length < 3) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        stream: false,
        messages: [
          {
            role: 'system',
            content: [
              '你是 YayaMind 的中文语音转写纠错器，只修明显语音识别错误，不解析意图，不补充事实。',
              '不要总结、不要改写成短标题、不要删除用户说过的任务细节。',
              '保留用户原本的口语语气、时间、地点、项目名和任务内容。',
              '优先修正同音误识别，例如“项目代办”应为“项目待办”，“待办”不要写成“代办”。',
              '如果原文已经通顺，原样返回。',
              '必须只输出 JSON：{"correctedText":"..."}'
            ].join('\n')
          },
          { role: 'user', content: original }
        ]
      })
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const corrected = parseCorrectedText(payload.choices?.[0]?.message?.content ?? '');
    if (!corrected || !isSafeCorrection(original, corrected)) return null;
    return corrected;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAiStatus() {
  const env = await getEnv();
  const config = await getAiRuntimeConfig(env);
  const rawKey = env.DEEPSEEK_API_KEY || env.DEEPSIG_API_KEY || '';
  return {
    provider: config.provider,
    configured: Boolean(config.apiKey),
    enabled: config.enabled,
    keyLooksPlaceholder: Boolean(rawKey && isPlaceholderKey(rawKey)),
    baseUrl: config.baseUrl,
    model: config.model,
    source: config.source
  };
}

function parseCorrectedText(content: string) {
  const parsed = parseJsonObject(content);
  const corrected = parsed && typeof parsed.correctedText === 'string' ? parsed.correctedText.trim() : '';
  return corrected || content.trim().replace(/^["']|["']$/g, '');
}

function isSafeCorrection(original: string, corrected: string) {
  if (!corrected) return false;
  if (corrected.length > Math.max(12, original.length * 1.8)) return false;
  if (corrected.length < Math.max(1, original.length * 0.75)) return false;
  return true;
}

function getApiKey(env: Record<string, string>) {
  const value = env.DEEPSEEK_API_KEY || env.DEEPSIG_API_KEY || '';
  return value && !isPlaceholderKey(value) ? value : '';
}

async function getAiRuntimeConfig(env: Record<string, string>) {
  const settings = await readLocalAiSettings();
  const settingsKey = settings.apiKey && !isPlaceholderKey(settings.apiKey) ? settings.apiKey : '';
  return {
    provider: settings.provider || 'deepseek',
    enabled: settings.enabled !== false,
    apiKey: settingsKey || getApiKey(env),
    baseUrl: (settings.baseUrl || env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
    model: settings.model || env.DEEPSEEK_MODEL || 'deepseek-chat',
    source: settingsKey ? 'settings' : 'env'
  };
}

async function readLocalAiSettings(): Promise<{
  provider?: 'deepseek' | 'openai-compatible';
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}> {
  try {
    const dataDir = process.env.YAYAMIND_DATA_DIR || join(process.cwd(), 'personal-assistant-data');
    const content = await readFile(join(dataDir, 'settings.json'), 'utf8');
    const parsed = JSON.parse(content) as { ai?: Record<string, unknown> };
    const ai = parsed.ai ?? {};
    return {
      provider: ai.provider === 'openai-compatible' ? 'openai-compatible' : 'deepseek',
      enabled: ai.enabled !== false,
      baseUrl: typeof ai.baseUrl === 'string' ? ai.baseUrl.trim() : undefined,
      model: typeof ai.model === 'string' ? ai.model.trim() : undefined,
      apiKey: typeof ai.apiKey === 'string' ? ai.apiKey.trim() : undefined
    };
  } catch {
    return {};
  }
}

function isPlaceholderKey(value: string) {
  return /your_.*api_key|api_key_here|placeholder|sk-xxxx/i.test(value);
}

async function getEnv() {
  if (cachedEnv) return cachedEnv;
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const file of ['.env.local', '.env']) {
    try {
      const content = await readFile(join(process.cwd(), file), 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && !env[key]) env[key] = value;
      }
    } catch {
      // Local env files are optional.
    }
  }
  cachedEnv = env;
  return env;
}

function buildSystemPrompt(now: string, context: { projectTitles?: string[] } = {}) {
  const projectTitles = Array.from(new Set((context.projectTitles ?? []).map((item) => item.trim()).filter(Boolean)));
  return [
    'Before extracting fields, classify whether the user wants to create a new item or operate on an existing calendar event.',
    'Use delete_event for existing-event deletion/cancel/removal, update_event for reschedule/modify/correction, annotate_event for adding notes/preparations. Use add_event only for a new event.',
    '你是 YayaMind 的输入理解模块，只做结构化抽取，不聊天。',
    '用户在中国时区 Asia/Shanghai。当前时间 ISO：' + now + '。',
    '必须只输出 JSON，不要 Markdown，不要解释。',
    'intent 必须是以下之一：' + allowedIntents.join(', ') + '。',
    '如果是会议、面试、约见、电话、训练、吃饭、休息、明确时间块，intent 用 add_event。',
    '如果只有“下午/上午/晚上/明天上午”但没有具体几点，必须 needsConfirmation=true，并给一个短 questions。',
    '如果只有具体时间但没有说明做什么，也必须 needsConfirmation=true；不要把标题当成需要用户填写的问题。',
    '日程 title 必须由用户原话归纳成 2-3 个中文短标题，优先归纳为“开会/上课/面试/重构/改稿/提醒/任务/休息”，绝对不要机械截取原话前三个字，也不要追问用户标题。',
    '不要瞎编具体时间；没有具体几点就不要填 startAt/endAt。',
    '明确时间请用 ISO 字符串，保留 +08:00 时区，例如 2026-06-04T15:00:00+08:00。',
    '日程字段建议：title,type,date,startAt,endAt,purpose,preparations,notes,estimatedMinutes。',
    '任务字段建议：title,dueAt,estimatedMinutes,preparations,notes。',
    projectTitles.length
      ? `当前已有项目分类词表：${projectTitles.join('、')}。如果用户提到这些项目名或近似同音词，fields.projectTitle 必须使用词表里的原始项目名；不要新造项目名。`
      : '当前没有可用项目分类词表；无法确定项目时不要新造项目名。',
    '项目待办的 title 必须保留用户真正要做的完整事项内容，不要只输出“任务/待办/同步/处理”这类短泛化词。',
    '提醒字段建议：title,remindAt,relatedType。',
    '输出格式：{"intent":"add_event","confidence":0.9,"needsConfirmation":false,"fields":{},"questions":[],"warnings":[]}'
  ].join('\n');
}

function normalizeAiResult(content: string, rawText: string): ParseResult | null {
  const parsed = parseJsonObject(content);
  if (!parsed) return null;

  const intent = typeof parsed.intent === 'string' && allowedIntents.includes(parsed.intent as ParsedIntent)
    ? (parsed.intent as ParsedIntent)
    : null;
  if (!intent) return null;

  const fields = isRecord(parsed.fields) ? parsed.fields : {};
  const normalizedFields = normalizeFields(fields, rawText);
  const questions = Array.isArray(parsed.questions) ? parsed.questions.filter(isString).slice(0, 2) : [];
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter(isString).slice(0, 4) : [];
  const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.78;
  const needsConfirmation = Boolean(parsed.needsConfirmation) || questions.length > 0;

  return {
    intent,
    confidence,
    needsConfirmation,
    rawText,
    fields: normalizedFields,
    questions,
    warnings: ['ai_used', ...warnings],
    preview: {
      intent,
      parser: 'deepseek',
      ...normalizedFields
    }
  };
}

function normalizeFields(fields: Record<string, unknown>, rawText: string) {
  const normalized = { ...fields };
  if (typeof normalized.type === 'string') normalized.type = normalizeEventType(normalized.type, rawText);
  if (typeof normalized.preparations === 'string') normalized.preparations = [normalized.preparations];
  if (typeof normalized.startAt === 'string' && typeof normalized.endAt !== 'string') {
    const end = new Date(normalized.startAt);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(end.getHours() + 1);
      normalized.endAt = toOffsetIso(end);
    }
  }
  return normalized;
}

function normalizeEventType(type: string, rawText: string) {
  const value = `${type} ${rawText}`;
  if (/(会议|开会|沟通|面试|电话|约见|见面)/.test(value)) return 'meeting';
  if (/(训练|运动|健身)/.test(value)) return 'exercise';
  if (/(吃饭|午饭|晚饭|早餐|餐)/.test(value)) return 'meal';
  if (/(睡觉|休息|午休)/.test(value)) return 'rest';
  if (/(家务|洗衣|晾衣|取快递|买菜)/.test(value)) return 'life';
  if (/(风险|延期|来不及|赶不完)/.test(value)) return 'risk';
  if (/(任务|写|做|整理|完成)/.test(value)) return 'task_block';
  return 'other';
}

function toOffsetIso(date: Date) {
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}+08:00`;
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
