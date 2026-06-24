import Fastify from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { verifySupabaseUserId } from './auth.js';
import { getAiStatus } from './aiAdapter.js';
import {
  appendWorkLog,
  cancelEvent,
  checkConflicts,
  commitTextInput,
  createGoal,
  createManualEvent,
  deleteWorkLog,
  ensureDataFiles,
  generateMarkdownSummary,
  getBootstrapData,
  getProfileData,
  listGoals,
  parseAndEnrichTextInput,
  snoozeReminder,
  updateEvent,
  updateGoalStatus,
  updateReminderStatus,
  updateSettings,
  updateWorkLog
} from './dataStore.js';
import { enterRequestContext } from './requestContext.js';
import type { ParseResult } from './types.js';

const staticMimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

async function resolveDesktopStaticFile(staticDir: string, requestPath: string) {
  const cleanPath = requestPath.split('?')[0].split('#')[0];
  const relativePath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const resolvedRoot = resolve(staticDir);
  const resolvedFile = resolve(resolvedRoot, normalize(relativePath));
  if (!resolvedFile.startsWith(resolvedRoot)) return null;
  try {
    const fileStat = await stat(resolvedFile);
    if (fileStat.isFile()) return resolvedFile;
  } catch {
    // Fall back to index.html for client-side routes.
  }
  return join(resolvedRoot, 'index.html');
}

export function buildApp() {
const app = Fastify({ logger: true });
const requireAuth = process.env.VERCEL === '1' && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

app.addHook('onRequest', async (request, reply) => {
  if (!requireAuth) {
    enterRequestContext({ userId: null });
    return;
  }
  const userId = await verifySupabaseUserId(request.headers.authorization);
  if (!userId) {
    return reply.code(401).send({ ok: false, error: 'login required' });
  }
  enterRequestContext({ userId });
});

app.get('/api/bootstrap', async () => getBootstrapData());

app.get('/api/ai/status', async () => getAiStatus());

app.get('/api/calendar', async () => {
  const data = await getBootstrapData();
  return data.calendar;
});

app.get('/api/today', async () => {
  const data = await getBootstrapData();
  return data.today;
});

app.get('/api/goals', async () => listGoals());

app.post<{ Body: { title?: string; targetDate?: string | null } }>('/api/goals', async (request, reply) => {
  const title = request.body?.title?.trim();
  if (!title) return reply.code(400).send({ ok: false, error: 'title is required' });
  return createGoal(title, request.body?.targetDate ?? null);
});

app.post<{ Params: { id: string }; Body: { status?: 'active' | 'paused' | 'done' | 'cancelled' } }>('/api/goals/:id/status', async (request, reply) => {
  const status = request.body?.status;
  if (!status) return reply.code(400).send({ ok: false, error: 'status is required' });
  return updateGoalStatus(request.params.id, status);
});

app.get('/api/profile', async () => getProfileData());

app.patch<{ Body: Parameters<typeof updateSettings>[0] }>('/api/settings', async (request) =>
  updateSettings(request.body ?? {})
);

app.post<{ Body: { kind?: 'daily' | 'weekly' } }>('/api/summaries/generate', async (request) =>
  generateMarkdownSummary(request.body?.kind ?? 'daily')
);

app.post<{ Body: { text: string; source?: string; selectedOptionId?: string | null } }>('/api/input/commit', async (request, reply) => {
  const text = request.body?.text?.trim();
  if (!text) {
    return reply.code(400).send({ ok: false, error: 'text is required' });
  }
  const result = await commitTextInput(text, request.body.source, { selectedOptionId: request.body.selectedOptionId });
  const logResult = result as {
    ok: boolean;
    needsConfirmation?: boolean;
    resolvedBy?: string | null;
    parseResult?: ParseResult;
  };
  request.log.info({
    input: text,
    inputEscaped: escapeForLog(text),
    source: request.body.source ?? 'text',
    selectedOptionId: request.body.selectedOptionId ?? null,
    ok: logResult.ok,
    needsConfirmation: logResult.needsConfirmation ?? false,
    resolvedBy: logResult.resolvedBy ?? null,
    parse: summarizeParseResult(logResult.parseResult)
  }, 'input commit result');
  return result;
});

app.post<{ Body: { text: string; source?: string } }>('/api/input/parse', async (request) => {
  const text = request.body?.text?.trim() ?? '';
  const result = await parseAndEnrichTextInput(text, undefined, request.body?.source);
  request.log.info({
    input: text,
    inputEscaped: escapeForLog(text),
    source: request.body?.source ?? 'text',
    parse: summarizeParseResult(result)
  }, 'input parse result');
  return result;
});

app.post<{ Body: { note?: string; taskId?: string } }>('/api/work/start', async (request) =>
  appendWorkLog('start', request.body?.note?.trim() || '开始工作', request.body?.taskId ?? null)
);

app.post<{ Body: { note?: string; taskId?: string } }>('/api/work/pause', async (request) =>
  appendWorkLog('pause', request.body?.note?.trim() || '暂停工作', request.body?.taskId ?? null)
);

app.post<{ Body: { note?: string; taskId?: string } }>('/api/work/resume', async (request) =>
  appendWorkLog('resume', request.body?.note?.trim() || '继续工作', request.body?.taskId ?? null)
);

app.post<{ Body: { note?: string; taskId?: string } }>('/api/work/finish', async (request) =>
  appendWorkLog('finish', request.body?.note?.trim() || '结束工作', request.body?.taskId ?? null)
);

app.get('/api/reminders/pending', async () => {
  const data = await getBootstrapData();
  return data.today.reminders;
});

app.post<{ Params: { id: string } }>('/api/reminders/:id/done', async (request) =>
  updateReminderStatus(request.params.id, 'done')
);

app.post<{ Params: { id: string } }>('/api/reminders/:id/dismiss', async (request) =>
  updateReminderStatus(request.params.id, 'dismissed')
);

app.post<{ Params: { id: string }; Body: { minutes?: number } }>('/api/reminders/:id/snooze', async (request) =>
  snoozeReminder(request.params.id, request.body?.minutes ?? 10)
);

app.post<{ Body: { title?: string; startAt?: string; endAt?: string; date?: string } }>('/api/conflicts/check', async (request) =>
  checkConflicts(request.body ?? {})
);

app.post<{ Body: { title?: string; date?: string; startAt?: string; endAt?: string; type?: 'meeting' | 'task_block' | 'life' | 'exercise' | 'meal' | 'rest' | 'risk' | 'other'; purpose?: string; preparations?: string[]; notes?: string } }>('/api/events', async (request, reply) => {
  const result = await createManualEvent(request.body ?? {});
  return result.ok ? result : reply.code(400).send(result);
});

app.patch<{ Params: { id: string }; Body: { title?: string; notes?: string; startAt?: string; endAt?: string; date?: string; purpose?: string; preparations?: string[] } }>('/api/events/:id', async (request) =>
  updateEvent(request.params.id, request.body ?? {})
);

app.delete<{ Params: { id: string } }>('/api/events/:id', async (request) => cancelEvent(request.params.id));

app.patch<{ Params: { id: string }; Body: { note?: string; at?: string } }>('/api/work-logs/:id', async (request) =>
  updateWorkLog(request.params.id, request.body ?? {})
);

app.delete<{ Params: { id: string } }>('/api/work-logs/:id', async (request) => deleteWorkLog(request.params.id));

if (process.env.DESKTOP_STATIC_DIR) {
  app.get('/*', async (request, reply) => {
    const filePath = await resolveDesktopStaticFile(process.env.DESKTOP_STATIC_DIR as string, request.url);
    if (!filePath) return reply.code(404).send('Not found');
    const ext = extname(filePath).toLowerCase();
    reply.header('Content-Type', staticMimeTypes[ext] ?? 'application/octet-stream');
    return reply.send(createReadStream(filePath));
  });
}

return app;
}

export async function startLocalServer() {
  const app = buildApp();
  await ensureDataFiles();
  await app.listen({ port: 8787, host: '127.0.0.1' });
}

const isDirectLocalRun = process.argv[1]?.replace(/\\/g, '/').endsWith('/server/index.ts') ?? false;

if (isDirectLocalRun) {
  startLocalServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

function summarizeParseResult(result?: ParseResult) {
  if (!result) return null;
  return {
    intent: result.intent,
    confidence: result.confidence,
    needsConfirmation: result.needsConfirmation,
    rawText: result.rawText,
    rawTextEscaped: escapeForLog(result.rawText),
    correctedText: result.transcription?.correctedText,
    correctedTextEscaped: result.transcription?.correctedText ? escapeForLog(result.transcription.correctedText) : undefined,
    questions: result.questions,
    questionsEscaped: result.questions.map(escapeForLog),
    warnings: result.warnings,
    fields: {
      title: result.fields.title,
      type: result.fields.type,
      date: result.fields.date,
      startAt: result.fields.startAt,
      endAt: result.fields.endAt,
      dueAt: result.fields.dueAt,
      notes: result.fields.notes
    },
    preview: {
      needsTimeConfirmation: result.preview.needsTimeConfirmation,
      needsContentConfirmation: result.preview.needsContentConfirmation,
      options: result.preview.options
    }
  };
}

function escapeForLog(value: string) {
  return Array.from(value)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 127 ? `\\u${code.toString(16).padStart(4, '0')}` : char;
    })
    .join('');
}
