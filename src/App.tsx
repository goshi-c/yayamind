import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import catListeningAvatar from './assets/desktop/cat-listening.png';
import catSleepingAvatar from './assets/desktop/cat-sleeping.png';

type AssistantData = {
  today: {
    date: string;
    activeSession: null | { title: string; startedAt: string };
    plans: Array<{ id: string; title: string; time?: string; type: string }>;
    timeline: CalendarLog[];
    reminders: Array<{ id: string; title: string; remindAt: string; status: string }>;
    weatherAlerts: WeatherAlert[];
  };
  calendar: Array<{
    date: string;
    label: string;
    items: CalendarItem[];
    pendingItems: CalendarItem[];
    tasks: CalendarItem[];
    reminders: CalendarReminder[];
    weatherAlerts: WeatherAlert[];
    timeline: CalendarLog[];
  }>;
  todoProjects: TodoProject[];
  tasks: TaskListItem[];
  goals: GoalRecord[];
  profile: ProfileData;
  planDrafts: PlanDraft[];
  conversation?: ConversationContext;
  titleLexicon?: Array<{ canonicalTitle: string; aliases: string[]; evidenceCount: number }>;
  recurringRules?: RecurringRule[];
  settings: AppSettings;
};

type CalendarItem = {
  id: string;
  title: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string | null;
  date?: string;
  type: string;
  projectTitle?: string;
  lane?: number;
  laneCount?: number;
  conflict?: boolean;
  purpose?: string;
  preparations?: string[];
  notes?: string;
  reminderIds?: string[];
  estimatedMinutes?: number | null;
  rawText?: string;
  isDraft?: boolean;
  draftId?: string;
  tags?: string[];
};

type CalendarReminder = { id: string; title: string; remindAt: string; status: string; updatedAt?: string; relatedType?: string; relatedId?: string | null; isDraft?: boolean };

type DetailTarget = CalendarItem & { kind: 'event' | 'task' };

type CalendarLog = { id: string; at?: string; time: string; text: string; action?: string; feedbackType?: string };

type WeatherAlert = { id: string; date: string; title: string; detail: string; remindAt?: string; relatedEventId?: string; probability?: number };

type TodoProject = {
  id: string;
  title: string;
  status: 'active' | 'archived';
  order?: number;
  createdAt: string;
  updatedAt: string;
};

type TaskListItem = {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'paused' | 'done' | 'partially_done' | 'cancelled' | 'deferred';
  projectId: string;
  projectTitle: string;
  order?: number;
  dueAt: string | null;
  estimatedMinutes: number | null;
  notes?: string;
  preparations?: string[];
  createdAt: string;
  updatedAt: string;
};

type TodoTaskDraft = { title: string; notes: string; projectId: string };
type TodoEditField = 'title' | 'notes';
type TodoDragKind = 'task' | 'project';
type TodoDragReady = { kind: TodoDragKind; id: string } | null;
type TodoDropPreview =
  | { kind: 'project'; targetId: string; position: 'before' | 'after' }
  | { kind: 'task'; targetId: string; position: 'before' | 'after' }
  | { kind: 'project-end'; targetId: string }
  | { kind: 'date'; targetId: string };

function getTodoPreviewPosition(preview: TodoDropPreview | null) {
  return preview && 'position' in preview ? preview.position : null;
}

type AppSettings = {
  timezone: string;
  dataVersion: number;
  assistantName: string;
  notification: {
    browserNotificationEnabled: boolean;
    quietDuringWorking: boolean;
  };
  ui: {
    calendarDays: number;
    dayStartHour: number;
    dayEndHour: number;
  };
  habits: {
    sleepStart: string;
    wakeUp: string;
    restDayMode: 'weekend' | 'single_sunday' | 'single_saturday' | 'alternate_weekends' | 'custom';
    customRestDays: number[];
    alternateWeekendStartsOn: string;
    showLegalHolidays: boolean;
  };
  weather: {
    enabled: boolean;
    latitude: number;
    longitude: number;
    city: string;
    rainProbabilityThreshold: number;
    outdoorLeadMinutes: number;
  };
  ai: {
    provider: 'deepseek' | 'openai-compatible';
    enabled: boolean;
    baseUrl: string;
    model: string;
    apiKey: string;
  };
};

type SettingsDraft = {
  wakeUp: string;
  sleepStart: string;
  restDayMode: AppSettings['habits']['restDayMode'];
  showLegalHolidays: boolean;
  aiProvider: AppSettings['ai']['provider'];
  aiEnabled: boolean;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
};

type ManualEventDraft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: CalendarItem['type'];
  notes: string;
  preparationsText: string;
};

type DetailDraft = {
  id: string;
  title: string;
  notes: string;
  date: string;
  startTime: string;
  endTime: string;
  dueDate: string;
  dueTime: string;
  estimatedMinutes: string;
  purpose: string;
  preparationsText: string;
};

type LogDraft = { id: string; note: string; date: string; time: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: unknown) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type WindowWithDesktopBridge = Window & {
  yayaDesktop?: {
    isDesktopShell: boolean;
    onStartVoice: (callback: () => void) => () => void;
    onStopVoice: (callback: () => void) => () => void;
    onRecognizedText?: (callback: (text: string) => void) => () => void;
    onVoiceError?: (callback: (detail?: { kind?: string }) => void) => () => void;
    onNativeVoiceStart?: (callback: (detail?: { voiceSessionId?: number }) => void) => () => void;
    onNativeVoiceStop?: (callback: () => void) => () => void;
    onPrepareNativeVoiceStop?: (callback: () => void) => () => void;
    onCancelVoice?: (callback: () => void) => () => void;
    onVoicePartial?: (callback: (text: string) => void) => () => void;
    onBubbleOption?: (callback: (optionId: string) => void) => () => void;
    requestVoiceInput?: () => void;
    setCatState: (state: 'sleeping' | 'listening' | 'thinking' | 'error') => void;
    setCatMessage?: (message: string) => void;
    logVoiceEvent?: (detail: Record<string, unknown>) => void;
    notifyDictationTargetReady?: (detail: { voiceSessionId?: number | null; focused: boolean }) => void;
  };
};

type DesktopCatDialogMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'input';
  text: string;
  muted?: boolean;
};

type DesktopCatDialogOption = {
  id: string;
  label: string;
};

type DesktopCatDialogPayload = {
  type: 'cat-dialog-v1';
  messages: DesktopCatDialogMessage[];
  options?: DesktopCatDialogOption[];
  status?: string;
};

type GoalRecord = {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'done' | 'cancelled';
  startDate: string;
  targetDate: string | null;
  milestones: Array<{ id: string; title: string; status: string }>;
  linkedTaskIds: string[];
};

type ProfileData = {
  timeHabits: { highFocusWindows: string[]; lowEnergyWindows: string[]; commonDelayWindows: string[] };
  estimationPatterns: { oftenUnderestimatedTags: string[]; bufferRules: string[] };
  lifeRhythm: { regularMeals: string[]; exercisePreferences: string[]; restPatterns: string[] };
  workPreferences: { focusStyle: string; preferredTaskOrder: string; encouragementStyle: string };
  signals: string[];
  updatedAt: string;
};

type AuthSession = {
  access_token: string;
  refresh_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
};

type ParsedIntent =
  | 'add_event'
  | 'update_event'
  | 'delete_event'
  | 'annotate_event'
  | 'add_task'
  | 'start_work'
  | 'pause_work'
  | 'resume_work'
  | 'finish_work'
  | 'progress_update'
  | 'add_reminder'
  | 'review_note'
  | 'plan_draft'
  | 'batch_operation'
  | 'profile_update'
  | 'habit_rule';

type PlanDraftItem = {
  id: string;
  kind: 'event' | 'task' | 'reminder' | 'profile_update' | 'habit_rule';
  title: string;
  targetDate?: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  remindAt?: string;
  notes?: string;
  source?: string;
  risk?: string;
};

type PlanDraft = {
  id: string;
  sourceText: string;
  date: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  items: PlanDraftItem[];
  assumptions: string[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

type CandidateItem = {
  id: string;
  kind: 'event' | 'task' | 'reminder' | 'project' | 'profile' | 'habit_rule';
  title: string;
  detail?: string;
  date?: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string | null;
};

type BatchOperationPreview = {
  id: string;
  sourceText: string;
  action: 'delete' | 'update_time' | 'move_project' | 'move_date' | 'update_status';
  candidates: CandidateItem[];
  warnings: string[];
};

type ConversationContext = {
  id: string;
  state: string;
  activeDraftId?: string;
  lastUserText?: string;
};

type RecurringRule = {
  id: string;
  title: string;
  frequency: string;
  nextOccurrences: string[];
  status: string;
};

type ParseResult = {
  intent: ParsedIntent;
  confidence: number;
  needsConfirmation: boolean;
  rawText: string;
  transcription?: {
    originalText: string;
    correctedText: string;
    provider: 'deepseek' | 'rules';
  };
  fields: Record<string, unknown>;
  questions: string[];
  warnings: string[];
  preview: Record<string, unknown>;
  conversationState?: string;
  draft?: PlanDraft;
  candidates?: CandidateItem[];
  batchOperation?: BatchOperationPreview;
};

type ConflictOption = {
  id: string;
  title: string;
};

type CommitResponse = {
  ok: boolean;
  parseResult?: ParseResult;
  needsConfirmation?: boolean;
  resolvedBy?: string;
  feedback?: string;
  written?: Array<{ file: string; id: string; status?: string }>;
};

type PostCommitAction = {
  id: string;
  kind: 'event' | 'task';
  title: string;
  date?: string;
  startAt?: string;
  endAt?: string;
};

type ViewMode = 'week' | 'todos' | 'goals' | 'profile' | 'summary' | 'settings';

type TodoContextMenu =
  | { kind: 'task'; task: TaskListItem; x: number; y: number }
  | { kind: 'project'; project: TodoProject; x: number; y: number };

type DetailContextMenu = {
  item: DetailTarget;
  x: number;
  y: number;
};

const defaultSettings: AppSettings = {
  timezone: 'Asia/Shanghai',
  dataVersion: 1,
  assistantName: 'YayaMind',
  notification: {
    browserNotificationEnabled: false,
    quietDuringWorking: true
  },
  ui: {
    calendarDays: 7,
    dayStartHour: 0,
    dayEndHour: 24
  },
  habits: {
    wakeUp: '06:00',
    sleepStart: '22:00',
    restDayMode: 'weekend',
    customRestDays: [0, 6],
    alternateWeekendStartsOn: '2026-01-03',
    showLegalHolidays: true
  },
  weather: {
    enabled: true,
    latitude: 31.2304,
    longitude: 121.4737,
    city: '',
    rainProbabilityThreshold: 45,
    outdoorLeadMinutes: 30
  },
  ai: {
    provider: 'deepseek',
    enabled: true,
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    apiKey: ''
  }
};

const emptyData: AssistantData = {
  today: {
    date: toLocalDateText(new Date()),
    activeSession: null,
    plans: [],
    timeline: [],
    reminders: [],
    weatherAlerts: []
  },
  calendar: [],
  todoProjects: [],
  tasks: [],
  goals: [],
  profile: {
    timeHabits: { highFocusWindows: [], lowEnergyWindows: [], commonDelayWindows: [] },
    estimationPatterns: { oftenUnderestimatedTags: [], bufferRules: [] },
    lifeRhythm: { regularMeals: [], exercisePreferences: [], restPatterns: [] },
    workPreferences: { focusStyle: 'unknown', preferredTaskOrder: 'unknown', encouragementStyle: 'gentle' },
    signals: [],
    updatedAt: new Date().toISOString()
  },
  planDrafts: [],
  recurringRules: [],
  titleLexicon: [],
  settings: defaultSettings
};

const portfolioPreviewData = createPortfolioPreviewData();
const authStorageKey = 'yayamind.auth.session';

function getSupabaseAuthConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && anonKey ? { url: url.replace(/\/+$/, ''), anonKey } : null;
}

function isHostedApp() {
  if (typeof window === 'undefined') return false;
  return !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function readStoredAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(authStorageKey);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function storeAuthSession(session: AuthSession | null) {
  if (!session) {
    window.localStorage.removeItem(authStorageKey);
    return;
  }
  window.localStorage.setItem(authStorageKey, JSON.stringify(session));
}

async function submitSupabaseAuth(mode: 'login' | 'signup', email: string, password: string) {
  const config = getSupabaseAuthConfig();
  if (!config) throw new Error('Supabase 登录还没有配置好。');
  const endpoint = mode === 'login' ? '/auth/v1/token?grant_type=password' : '/auth/v1/signup';
  const response = await fetch(`${config.url}${endpoint}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getSupabaseAuthErrorMessage(result));
  }
  if (!result.access_token) {
    if (mode === 'signup') {
      throw new Error('账号已创建，但 Supabase 要求先验证邮箱。请去邮箱点确认链接，或在 Supabase 里关闭 Confirm email 后再注册。');
    }
    throw new Error('没有拿到登录会话。请确认邮箱已验证，或重新登录。');
  }
  return result as AuthSession;
}

function getSupabaseAuthErrorMessage(result: Record<string, unknown>) {
  const raw = [result.error_description, result.msg, result.message, result.error]
    .find((value) => typeof value === 'string' && value.trim().length > 0);
  const text = typeof raw === 'string' ? raw : '';
  if (/Invalid login credentials/i.test(text)) return '账号或密码不匹配。如果刚注册过，请先确认邮箱是否需要验证。';
  if (/Email not confirmed/i.test(text)) return '这个账号还没有完成邮箱验证。请去邮箱点确认链接，或在 Supabase 里关闭 Confirm email。';
  if (/User already registered/i.test(text)) return '这个邮箱已经注册过了，请切换到登录。';
  if (/Password should be at least/i.test(text)) return '密码长度不够，至少需要 6 位。';
  if (/signup/i.test(text) && /disabled/i.test(text)) return 'Supabase 还没有开启邮箱注册，请在 Authentication 的 Email Provider 里开启。';
  if (/security purposes/i.test(text) && /seconds/i.test(text)) return text.replace(/For security purposes, you can only request this after/i, '请求太频繁了，请等待').replace(/seconds?/i, '秒后再试');
  return text || '登录失败，请检查 Supabase 登录配置和账号密码。';
}

function createPortfolioPreviewData(): AssistantData {
  const now = new Date();
  const today = toLocalDateText(now);
  const weekStart = getWeekStart(now);
  const isoAt = (dayOffset: number, time: string) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    return `${toLocalDateText(date)}T${time}:00+08:00`;
  };
  const dateAt = (dayOffset: number) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    return toLocalDateText(date);
  };
  const calendar = Array.from({ length: 7 }, (_, index) => {
    const date = dateAt(index);
    const items: CalendarItem[] = [];
    const pendingItems: CalendarItem[] = [];
    const tasks: CalendarItem[] = [];
    const reminders: CalendarReminder[] = [];
    const timeline: CalendarLog[] = [];
    const weatherAlerts: WeatherAlert[] = [];

    if (index === 1) {
      items.push({
        id: 'demo-event-1',
        title: 'AI 产品面试复盘',
        date,
        startAt: isoAt(index, '10:00'),
        endAt: isoAt(index, '11:00'),
        type: 'meeting',
        purpose: '梳理 YayaMind 的 PRD、SDD 和 MVP 取舍',
        preparations: ['准备项目讲解顺序', '整理高频追问回答']
      });
      tasks.push({
        id: 'demo-task-1',
        title: '完善作品集部署说明',
        date,
        dueAt: isoAt(index, '21:00'),
        type: 'task',
        estimatedMinutes: 60,
        notes: '把 GitHub、Vercel、真实可用版架构讲清楚'
      });
    }

    if (index === 2) {
      items.push({
        id: 'demo-event-2',
        title: '开题报告修改',
        date,
        startAt: isoAt(index, '14:30'),
        endAt: isoAt(index, '16:00'),
        type: 'task_block',
        purpose: '根据导师意见修改研究问题和技术路线',
        preparations: ['对照主稿冻结内容', '检查 DOCX/PPT 文本一致性']
      });
      reminders.push({ id: 'demo-reminder-1', title: '出门前带电脑和资料', remindAt: isoAt(index, '13:40'), status: 'pending' });
      weatherAlerts.push({
        id: 'demo-weather-1',
        date,
        title: '出门提醒',
        detail: '下午可能有雨，出门前记得带伞和电脑。',
        remindAt: isoAt(index, '13:30'),
        probability: 68
      });
    }

    if (index === 4) {
      pendingItems.push({
        id: 'demo-pending-1',
        title: '补充 Paper Pilot 面试案例',
        date,
        type: 'task',
        notes: '还需要补清楚具体讲哪个用户流程'
      });
      timeline.push({
        id: 'demo-log-1',
        at: isoAt(index, '18:20'),
        time: '18:20',
        text: '完成一轮项目待办梳理，估时比预期多 20 分钟。',
        action: 'progress',
        feedbackType: 'progress'
      });
    }

    return {
      date,
      label: formatWeekLabel(new Date(`${date}T12:00:00`)),
      items,
      pendingItems,
      tasks,
      reminders,
      weatherAlerts,
      timeline
    };
  });

  const todayData = calendar.find((day) => day.date === today) ?? calendar[0];
  const createdAt = now.toISOString();
  return {
    today: {
      date: todayData.date,
      activeSession: { title: '作品集包装与部署', startedAt: isoAt(1, '09:30') },
      plans: todayData.items.map((item) => ({ id: item.id, title: item.title, time: item.startAt, type: item.type })),
      timeline: todayData.timeline,
      reminders: todayData.reminders,
      weatherAlerts: todayData.weatherAlerts
    },
    calendar,
    todoProjects: [
      { id: 'work', title: '工作', status: 'active', createdAt, updatedAt: createdAt },
      { id: 'school', title: '学校', status: 'active', createdAt, updatedAt: createdAt },
      { id: 'life', title: '生活', status: 'active', createdAt, updatedAt: createdAt }
    ],
    tasks: [
      {
        id: 'demo-todo-1',
        title: '把 YayaMind 发布到 GitHub',
        status: 'in_progress',
        projectId: 'work',
        projectTitle: '工作',
        dueAt: isoAt(1, '22:00'),
        estimatedMinutes: 45,
        notes: '排除个人数据和 API Key，只提交作品集代码。',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'demo-todo-2',
        title: '准备 Vercel 作品集链接',
        status: 'todo',
        projectId: 'work',
        projectTitle: '工作',
        dueAt: isoAt(2, '20:00'),
        estimatedMinutes: 60,
        notes: '先上线只读预览，后续再接云端真实数据。',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'demo-todo-3',
        title: '整理开题材料主稿',
        status: 'todo',
        projectId: 'school',
        projectTitle: '学校',
        dueAt: isoAt(4, '18:00'),
        estimatedMinutes: 120,
        notes: '保持研究主题和创新点不漂移。',
        createdAt,
        updatedAt: createdAt
      }
    ],
    goals: [
      {
        id: 'demo-goal-1',
        title: '把个人助手包装成 AI PM 作品集',
        status: 'active',
        startDate: today,
        targetDate: dateAt(6),
        milestones: [
          { id: 'demo-milestone-1', title: '完成 MVP 功能对齐', status: 'done' },
          { id: 'demo-milestone-2', title: '上线可访问作品集链接', status: 'in_progress' },
          { id: 'demo-milestone-3', title: '规划真实多人可用架构', status: 'todo' }
        ],
        linkedTaskIds: ['demo-todo-1', 'demo-todo-2']
      }
    ],
    profile: {
      timeHabits: {
        highFocusWindows: ['上午 9:30-11:30 适合做结构化文档'],
        lowEnergyWindows: ['晚饭后容易切换任务变慢'],
        commonDelayWindows: ['临近截止前需要提前拆小块']
      },
      estimationPatterns: {
        oftenUnderestimatedTags: ['文档同步', '部署配置'],
        bufferRules: ['面试材料类任务默认加 20% 缓冲']
      },
      lifeRhythm: {
        regularMeals: ['午饭后适合安排轻量整理'],
        exercisePreferences: ['晚上适合放短训练块'],
        restPatterns: ['连续两小时后需要短休息']
      },
      workPreferences: {
        focusStyle: '语音快速记录，右侧再精修',
        preferredTaskOrder: '先完成可验收闭环，再补细节',
        encouragementStyle: '轻提醒，不催促'
      },
      signals: ['最近在同时推进求职材料、开题报告和作品集部署。'],
      updatedAt: createdAt
    },
    planDrafts: [],
    recurringRules: [],
    titleLexicon: [],
    settings: defaultSettings
  };
}

export function App() {
  const authConfig = getSupabaseAuthConfig();
  const authRequired = isHostedApp() && Boolean(authConfig);
  const isDesktopShell = Boolean((window as WindowWithDesktopBridge).yayaDesktop?.isDesktopShell);
  const [data, setData] = useState<AssistantData>(emptyData);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => readStoredAuthSession());
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [parsePreview, setParsePreview] = useState<ParseResult | null>(null);
  const [pendingClarification, setPendingClarification] = useState<ParseResult | null>(null);
  const [pendingDecision, setPendingDecision] = useState<ParseResult | null>(null);
  const [pendingPostCommit, setPendingPostCommit] = useState<PostCommitAction | null>(null);
  const [pendingModification, setPendingModification] = useState<PostCommitAction | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<DetailTarget | null>(null);
  const [detailDraft, setDetailDraft] = useState<DetailDraft | null>(null);
  const [selectedLog, setSelectedLog] = useState<CalendarLog | null>(null);
  const [logDraft, setLogDraft] = useState<LogDraft | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateText(new Date()));
  const [now, setNow] = useState(() => new Date());
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [catPosition, setCatPosition] = useState<null | { left: number; top: number }>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectTitleDraft, setProjectTitleDraft] = useState('');
  const [newTaskDraftByProject, setNewTaskDraftByProject] = useState<Record<string, TodoTaskDraft>>({});
  const [activeNewTaskProjectId, setActiveNewTaskProjectId] = useState<string | null>(null);
  const [editingTodoTaskId, setEditingTodoTaskId] = useState<string | null>(null);
  const [editingTodoField, setEditingTodoField] = useState<TodoEditField>('title');
  const [todoTaskDraft, setTodoTaskDraft] = useState<TodoTaskDraft>({ title: '', notes: '', projectId: 'uncategorized' });
  const [draggedTodoTaskId, setDraggedTodoTaskId] = useState<string | null>(null);
  const [draggedTodoProjectId, setDraggedTodoProjectId] = useState<string | null>(null);
  const [todoDragReady, setTodoDragReady] = useState<TodoDragReady>(null);
  const [todoDropPreview, setTodoDropPreview] = useState<TodoDropPreview | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [voiceDisplayText, setVoiceDisplayText] = useState('');
  const [catProcessStatus, setCatProcessStatus] = useState('');
  const [desktopDialogMessages, setDesktopDialogMessages] = useState<DesktopCatDialogMessage[]>([]);
  const [todoContextMenu, setTodoContextMenu] = useState<TodoContextMenu | null>(null);
  const [detailContextMenu, setDetailContextMenu] = useState<DetailContextMenu | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(340);
  const [dragPreview, setDragPreview] = useState<null | { id: string; startAt: string; endAt: string }>(null);
  const savingNewTaskProjectIds = useRef<Set<string>>(new Set());
  const [calendarFocusMode, setCalendarFocusMode] = useState<'week' | 'future'>('week');
  const [optimisticTodoStatuses, setOptimisticTodoStatuses] = useState<Record<string, TaskListItem['status']>>({});
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => createSettingsDraft(defaultSettings));
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [manualEventDraft, setManualEventDraft] = useState<ManualEventDraft | null>(null);
  const inputRef = useRef('');
  const systemDictationInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingClarificationRef = useRef<ParseResult | null>(null);
  const pendingDecisionRef = useRef<ParseResult | null>(null);
  const parsePreviewRef = useRef<ParseResult | null>(null);
  const isListeningRef = useRef(false);
  const hasSyncedDesktopVoiceSession = useRef(false);
  const voiceSilenceTimer = useRef<number | null>(null);
  const voiceNoSpeechTimer = useRef<number | null>(null);
  const voiceSessionIdRef = useRef(0);
  const voiceStopReasonRef = useRef<'manual' | 'submit' | 'idle-timeout' | 'error' | null>(null);
  const voiceRecoverUntilRef = useRef(0);
  const detailSaveInFlightRef = useRef(false);
  const todoLongPressTimerRef = useRef<number | null>(null);
  const isNativeTodoDraggingRef = useRef(false);
  const todoDropPreviewRef = useRef<TodoDropPreview | null>(null);
  const voiceRecoverAttemptsRef = useRef(0);
  const voiceRestartPendingRef = useRef(false);
  const catStatusClearTimerRef = useRef<number | null>(null);
  const desktopDialogMessageIdRef = useRef(0);
  const lastNoSpeechMessageAt = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const seenTriggeredReminderIds = useRef(new Set<string>());
  const greetedPeriodRef = useRef('');

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (resource, options = {}) => {
      const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.toString() : resource.url;
      if (!url.startsWith('/api') || !authSession?.access_token) return nativeFetch(resource, options);
      const headers = new Headers(options.headers ?? (resource instanceof Request ? resource.headers : undefined));
      headers.set('Authorization', `Bearer ${authSession.access_token}`);
      return nativeFetch(resource, { ...options, headers });
    };
    return () => {
      window.fetch = nativeFetch;
    };
  }, [authSession?.access_token]);

  useEffect(() => {
    if (authRequired && !authSession) return;
    refreshData().catch(() => {
      if (authRequired) {
        logout();
        return;
      }
      setData(portfolioPreviewData);
    });
  }, [authRequired, authSession?.access_token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSettingsDraft(createSettingsDraft(data.settings ?? defaultSettings));
  }, [data.settings]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    pendingClarificationRef.current = pendingClarification;
  }, [pendingClarification]);

  useEffect(() => {
    const desktopBridge = (window as WindowWithDesktopBridge).yayaDesktop;
    const removeStartListener = desktopBridge?.onStartVoice(() => {
      startVoiceInput();
    });
    const removeStopListener = desktopBridge?.onStopVoice(() => {
      submitCurrentVoiceInput();
    });
    const removeRecognizedTextListener = desktopBridge?.onRecognizedText?.((text) => {
      handleDesktopRecognizedText(text);
    });
    const removeVoiceErrorListener = desktopBridge?.onVoiceError?.(() => {
      setIsListening(false);
      setMessage('刚才没听到声音，你准备好再点我。');
    });
    const removeNativeVoiceStartListener = desktopBridge?.onNativeVoiceStart?.((detail) => {
      desktopBridge.logVoiceEvent?.({ type: 'native-voice-start', voiceSessionId: detail?.voiceSessionId ?? null });
      setIsListening(true);
      isListeningRef.current = true;
      prepareNewVoiceSession();
      focusSystemDictationInput({ clear: true, retry: true });
      setMessage('我在听，你可以一直说；说完再点我一下。');
    });
    const removeNativeVoiceStopListener = desktopBridge?.onNativeVoiceStop?.(() => {
      const dictatedText = systemDictationInputRef.current?.value.trim() || inputRef.current.trim();
      desktopBridge.logVoiceEvent?.({
        type: 'native-voice-stop',
        capturedLength: dictatedText.length,
        capturePreview: dictatedText.slice(0, 36),
        hasSystemCapture: Boolean(systemDictationInputRef.current?.value.trim()),
        hasInputRef: Boolean(inputRef.current.trim())
      });
      setIsListening(false);
      isListeningRef.current = false;
      setMessage((current) => current || '我在整理刚才这句话。');
      if (dictatedText) {
        void handleDesktopRecognizedText(dictatedText);
      } else {
        setMessage('刚才没听到文字，你准备好再点我。');
      }
    });
    const removePrepareNativeVoiceStopListener = desktopBridge?.onPrepareNativeVoiceStop?.(() => {
      desktopBridge.logVoiceEvent?.({
        type: 'native-voice-stop-prepare',
        captureLength: systemDictationInputRef.current?.value.trim().length ?? 0,
        inputLength: inputRef.current.trim().length
      });
      focusSystemDictationInput({ notify: false });
      setMessage('我在整理刚才这句话。');
    });
    const removeCancelVoiceListener = desktopBridge?.onCancelVoice?.(() => {
      desktopBridge.logVoiceEvent?.({ type: 'renderer-cancel-voice' });
      cancelVoiceInteraction('');
    });
    const removeVoicePartialListener = desktopBridge?.onVoicePartial?.((text) => {
      const nextText = text.trim();
      if (!nextText) return;
      desktopBridge.logVoiceEvent?.({
        type: 'renderer-partial-received',
        text: nextText,
        length: nextText.length
      });
      updateVoiceText(nextText);
    });
    const removeBubbleOptionListener = desktopBridge?.onBubbleOption?.((optionId) => {
      handleDesktopBubbleOption(optionId);
    });
    return () => {
      removeStartListener?.();
      removeStopListener?.();
      removeRecognizedTextListener?.();
      removeVoiceErrorListener?.();
      removeNativeVoiceStartListener?.();
      removeNativeVoiceStopListener?.();
      removePrepareNativeVoiceStopListener?.();
      removeCancelVoiceListener?.();
      removeVoicePartialListener?.();
      removeBubbleOptionListener?.();
    };
  }, []);

  useEffect(() => {
    pendingDecisionRef.current = pendingDecision;
  }, [pendingDecision]);

  useEffect(() => {
    parsePreviewRef.current = parsePreview;
  }, [parsePreview]);

  useEffect(() => {
    todoDropPreviewRef.current = todoDropPreview;
  }, [todoDropPreview]);

  useEffect(() => {
    function closeContextMenu() {
      setTodoContextMenu(null);
      setDetailContextMenu(null);
    }
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('resize', closeContextMenu);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('scroll', closeContextMenu, true);
      window.removeEventListener('resize', closeContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!draggedTodoTaskId && !draggedTodoProjectId) return;

    function handleTodoPointerMove(event: MouseEvent) {
      if ((event.buttons & 1) !== 1) {
        clearTodoDragState();
        return;
      }
      window.getSelection()?.removeAllRanges();
      const nextPreview = getTodoDropPreviewFromPoint(event.clientX, event.clientY);
      setTodoDropPreview((current) => {
        if (
          current?.kind === nextPreview?.kind &&
          current?.targetId === nextPreview?.targetId &&
          getTodoPreviewPosition(current) === getTodoPreviewPosition(nextPreview)
        ) {
          return current;
        }
        return nextPreview;
      });
    }

    function handleTodoPointerUp() {
      const preview = todoDropPreviewRef.current;
      void commitTodoDropPreview(preview);
    }

    window.addEventListener('mousemove', handleTodoPointerMove);
    window.addEventListener('mouseup', handleTodoPointerUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', handleTodoPointerMove);
      window.removeEventListener('mouseup', handleTodoPointerUp);
    };
  }, [draggedTodoTaskId, draggedTodoProjectId, data.tasks, data.todoProjects]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const desktopBridge = (window as WindowWithDesktopBridge).yayaDesktop;
    if (!desktopBridge) return;
    const shouldStand =
      isListening ||
      isThinking ||
      Boolean(pendingClarification || pendingDecision || pendingPostCommit || pendingModification || parsePreview || catProcessStatus);
    if (shouldStand) {
      hasSyncedDesktopVoiceSession.current = true;
      desktopBridge.setCatState(isListening ? 'listening' : 'thinking');
      return;
    }
    if (hasSyncedDesktopVoiceSession.current) {
      desktopBridge.setCatState('sleeping');
    }
  }, [isListening, isThinking, pendingClarification, pendingDecision, pendingPostCommit, pendingModification, parsePreview, catProcessStatus, message]);

  useEffect(() => {
    const desktopBridge = (window as WindowWithDesktopBridge).yayaDesktop;
    if (!desktopBridge?.setCatMessage) return;
    desktopBridge.setCatMessage(JSON.stringify(getDesktopCatDialogPayload({
      message,
      dialogMessages: desktopDialogMessages,
      pendingClarification,
      pendingDecision,
      pendingPostCommit,
      pendingModification,
      parsePreview,
      input,
      voiceDisplayText,
      catProcessStatus,
      isListening,
      isThinking
    })));
  }, [message, desktopDialogMessages, pendingClarification, pendingDecision, pendingPostCommit, pendingModification, parsePreview, input, voiceDisplayText, catProcessStatus, isListening, isThinking]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (authRequired && !authSession) return;
      refreshData().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [authRequired, authSession?.access_token]);

  useEffect(() => {
    const freshTriggered = data.today.reminders.find(
      (reminder) =>
        reminder.status === 'triggered' &&
        !seenTriggeredReminderIds.current.has(reminder.id) &&
        isFreshReminderTrigger(reminder, now)
    );
    if (!freshTriggered) return;

    seenTriggeredReminderIds.current.add(freshTriggered.id);
    setMessage(`提醒到点了：${freshTriggered.title}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('YayaMind 提醒', { body: freshTriggered.title });
    }
  }, [data.today.reminders, now]);

  useEffect(() => {
    const nextWeatherAlert = data.today.weatherAlerts.find((alert) => {
      if (!alert.remindAt) return true;
      return new Date(alert.remindAt).getTime() <= Date.now() + 60 * 60_000;
    });
    if (nextWeatherAlert) {
      setMessage(nextWeatherAlert.detail);
    }
  }, [data.today.weatherAlerts]);

  useEffect(() => {
    if (hasActiveInteractionState({ message, pendingClarification, pendingDecision, pendingPostCommit, pendingModification, input, voiceDisplayText, catProcessStatus, isListening, isThinking })) return;
    const greetingPeriod = getGreetingPeriod(now);
    if (greetedPeriodRef.current === greetingPeriod) return;
    const timer = window.setTimeout(() => {
      greetedPeriodRef.current = greetingPeriod;
      setMessage(getTimeGreeting(now, data.settings ?? defaultSettings));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [data.today.reminders.length, data.today.weatherAlerts.length, message, pendingClarification, pendingDecision, pendingPostCommit, pendingModification, input, voiceDisplayText, catProcessStatus, isListening, isThinking, now, data.settings]);

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      setMessage('这个浏览器暂时不支持通知，我会先在页面里提醒你。');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setMessage(permission === 'granted' ? '浏览器通知已开启。' : '没关系，我先在页面里提醒你。');
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthSubmitting(true);
    setAuthMessage('');
    try {
      const session = await submitSupabaseAuth(authMode, authEmail.trim(), authPassword);
      setAuthSession(session);
      storeAuthSession(session);
      setAuthPassword('');
      setData(emptyData);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : '登录失败，请稍后再试。');
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  function logout() {
    setAuthSession(null);
    storeAuthSession(null);
    setData(portfolioPreviewData);
    setAuthMode('login');
    setAuthPassword('');
    setMessage('');
  }

  async function refreshData() {
    const nextData = await fetch('/api/bootstrap').then((res) => {
      if (!res.ok) throw new Error('bootstrap failed');
      return res.json();
    });
    setData(nextData);
    return nextData as AssistantData;
  }

  function patchTodoTaskInView(taskId: string, patch: Partial<TaskListItem>) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task))
    }));
  }

  function patchTodoProjectInView(projectId: string, patch: Partial<TodoProject>) {
    setData((current) => ({
      ...current,
      todoProjects: current.todoProjects.map((project) => (project.id === projectId ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project))
    }));
  }

  function removeEventFromView(eventId: string) {
    setData((current) => ({
      ...current,
      today: {
        ...current.today,
        plans: current.today.plans.filter((plan) => plan.id !== eventId)
      },
      calendar: current.calendar.map((day) => ({
        ...day,
        items: day.items.filter((item) => item.id !== eventId),
        pendingItems: day.pendingItems.filter((item) => item.id !== eventId)
      }))
    }));
  }

  function removeDraftFromView(draftId: string) {
    setData((current) => ({
      ...current,
      planDrafts: current.planDrafts.filter((draft) => draft.id !== draftId),
      calendar: current.calendar.map((day) => ({
        ...day,
        items: day.items.filter((item) => item.draftId !== draftId),
        pendingItems: day.pendingItems.filter((item) => item.draftId !== draftId),
        tasks: day.tasks.filter((task) => task.draftId !== draftId),
        reminders: day.reminders.filter((reminder) => reminder.relatedId !== draftId)
      }))
    }));
  }

  function removeTaskFromView(taskId: string) {
    setData((current) => ({
      ...current,
      today: {
        ...current.today,
        plans: current.today.plans.filter((plan) => plan.id !== taskId)
      },
      tasks: current.tasks.filter((task) => task.id !== taskId),
      calendar: current.calendar.map((day) => ({
        ...day,
        tasks: day.tasks.filter((task) => task.id !== taskId),
        pendingItems: day.pendingItems.filter((item) => item.id !== taskId)
      }))
    }));
  }

  function removeLogFromView(logId: string) {
    setData((current) => ({
      ...current,
      today: {
        ...current.today,
        timeline: current.today.timeline.filter((log) => log.id !== logId)
      },
      calendar: current.calendar.map((day) => ({
        ...day,
        timeline: day.timeline.filter((log) => log.id !== logId)
      }))
    }));
  }

  function removeTodoProjectFromView(projectId: string) {
    setData((current) => ({
      ...current,
      todoProjects: current.todoProjects.filter((project) => project.id !== projectId),
      tasks: current.tasks.map((task) => (task.projectId === projectId ? { ...task, projectId: 'uncategorized' } : task))
    }));
  }

  function reorderTodoProjectsInView(projectId: string, targetProjectId: string, position: 'before' | 'after' = 'before') {
    if (projectId === targetProjectId || projectId === 'uncategorized' || targetProjectId === 'uncategorized') return;
    setData((current) => {
      const projects = [...current.todoProjects].sort(compareTodoProjects);
      const fromIndex = projects.findIndex((project) => project.id === projectId);
      const toIndex = projects.findIndex((project) => project.id === targetProjectId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [moved] = projects.splice(fromIndex, 1);
      const adjustedTargetIndex = projects.findIndex((project) => project.id === targetProjectId);
      projects.splice(position === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex, 0, moved);
      return {
        ...current,
        todoProjects: projects.map((project, index) => ({ ...project, order: index + 1, updatedAt: new Date().toISOString() }))
      };
    });
  }

  function reorderTodoTasksInView(taskId: string, targetTaskId: string, targetProjectId: string, position: 'before' | 'after' = 'before') {
    if (taskId === targetTaskId) return;
    setData((current) => {
      const draggedTask = current.tasks.find((task) => task.id === taskId);
      if (!draggedTask) return current;
      const nextProjectId = targetProjectId === 'uncategorized' ? 'uncategorized' : targetProjectId;
      const siblingTasks = current.tasks
        .filter((task) => task.id !== taskId && (task.projectId || 'uncategorized') === nextProjectId && task.status !== 'cancelled')
        .sort(compareTodoTasks);
      const targetIndex = Math.max(0, siblingTasks.findIndex((task) => task.id === targetTaskId));
      siblingTasks.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, { ...draggedTask, projectId: nextProjectId });
      const orderById = new Map(siblingTasks.map((task, index) => [task.id, index + 1]));
      return {
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id === taskId) return { ...task, projectId: nextProjectId, order: orderById.get(task.id), updatedAt: new Date().toISOString() };
          if (orderById.has(task.id)) return { ...task, order: orderById.get(task.id), updatedAt: new Date().toISOString() };
          return task;
        })
      };
    });
  }

  function clearTodoDragState() {
    isNativeTodoDraggingRef.current = false;
    if (todoLongPressTimerRef.current) {
      window.clearTimeout(todoLongPressTimerRef.current);
      todoLongPressTimerRef.current = null;
    }
    setDraggedTodoTaskId(null);
    setDraggedTodoProjectId(null);
    setTodoDragReady(null);
    setTodoDropPreview(null);
  }

  function selectCalendarDate(date: string) {
    setSelectedDate(date);
    setSelectedDetail(null);
    setDetailDraft(null);
  }

  function scrollScheduleToTime(date: string, isoTime?: string) {
    window.setTimeout(() => {
      const schedule = document.querySelector<HTMLElement>(`[data-date="${date}"] .day-schedule`);
      if (!schedule) return;
      const targetDate = isoTime ? new Date(isoTime) : new Date(`${date}T12:00:00`);
      const targetRatio = clampPercent((getMinutesFromDayStart(targetDate, scheduleRange) / scheduleRange.dayMinutes) * 100) / 100;
      const targetTop = schedule.scrollHeight * targetRatio - schedule.clientHeight / 3;
      schedule.scrollTop = Math.max(0, targetTop);
    }, 120);
  }

  function focusWrittenAction(action: PostCommitAction) {
    if (!action.date) return;
    setSelectedDate(action.date);
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const endText = toLocalDateText(weekEnd);
    setCalendarFocusMode(action.date > endText ? 'future' : 'week');
    scrollScheduleToTime(action.date, action.startAt);
  }

  function createPostCommitAction(result: CommitResponse): PostCommitAction | null {
    const written = result.written?.find((item) => item.file === 'events.jsonl' || item.file === 'tasks.jsonl');
    if (!written || written.status === 'moved') return null;
    const fields = result.parseResult?.fields ?? {};
    const startAt = typeof fields.startAt === 'string' ? fields.startAt : undefined;
    const endAt = typeof fields.endAt === 'string' ? fields.endAt : undefined;
    const dueAt = typeof fields.dueAt === 'string' ? fields.dueAt : undefined;
    const date =
      typeof fields.date === 'string'
        ? fields.date
        : startAt
          ? toLocalDateText(new Date(startAt))
          : dueAt
            ? toLocalDateText(new Date(dueAt))
            : undefined;
    return {
      id: written.id,
      kind: written.file === 'events.jsonl' ? 'event' : 'task',
      title: String(fields.title ?? result.parseResult?.rawText ?? '新安排'),
      date,
      startAt: startAt ?? dueAt,
      endAt
    };
  }

  async function deletePostCommitAction(action: PostCommitAction) {
    const path = action.kind === 'task' ? `/api/tasks/${action.id}` : `/api/events/${action.id}`;
    const response = await fetch(path, { method: 'DELETE' });
    if (response.ok) {
      setPendingPostCommit(null);
      setPendingModification(null);
      setMessage('');
      await refreshData();
    } else {
      setMessage('这条没有取消成功，可以再试一次。');
    }
  }

  async function applyPostCommitModification(action: PostCommitAction, text: string) {
    setIsThinking(true);
    const parsed = await fetch('/api/input/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'voice' })
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null) as ParseResult | null;
    const body = buildModificationBody(action, text, parsed, action.date);
    if (Object.keys(body).length === 0) {
      setIsThinking(false);
      setMessage('我没听清要改哪里，你可以直接说“不是周五，是周六”或者“加备注：带电脑”。');
      restartVoiceInputSoon(220);
      return;
    }
    const path = action.kind === 'task' ? `/api/tasks/${action.id}` : `/api/events/${action.id}`;
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setIsThinking(false);
    if (response.ok) {
      setInput('');
      inputRef.current = '';
      setPendingModification(null);
      setPendingPostCommit(null);
      setMessage('');
      await refreshData();
      const nextDate = typeof body.date === 'string'
        ? body.date
        : typeof body.startAt === 'string'
          ? toLocalDateText(new Date(body.startAt))
          : action.date;
      if (nextDate) scrollScheduleToTime(nextDate, typeof body.startAt === 'string' ? body.startAt : action.startAt);
    } else {
      setMessage('修改没有保存成功，可以再试一次。');
    }
  }

  function findExistingEventTarget(text: string, parsed?: ParseResult | null) {
    const fields = parsed?.fields ?? {};
    const parsedStartAt = typeof fields.startAt === 'string' ? fields.startAt : undefined;
    const parsedDate = typeof fields.date === 'string' ? fields.date : undefined;
    const targetDate = parsedStartAt ? toLocalDateText(new Date(parsedStartAt)) : parsedDate ?? inferCorrectionDate(text, selectedDate) ?? selectedDate;
    const primaryDay = calendarDays.find((item) => item.date === targetDate);
    const fallbackDay = calendarDays.find((item) => item.date === selectedDate);
    const candidateDays = [primaryDay, fallbackDay].filter(Boolean) as AssistantData['calendar'];
    const timeMinutes = parsedStartAt ? getMinutesFromDayStart(new Date(parsedStartAt)) : inferSpokenTimeMinutes(text);
    const wantsEventLike = /(会|会议|开会|面试|上课|课程)/.test(text);
    const candidates = candidateDays
      .flatMap((day) => day.items.map((item) => ({ ...item, date: item.date ?? day.date })))
      .filter((item) => !wantsEventLike || isMeetingLikeItem(item));
    if (candidates.length === 0) return null;

    return candidates
      .map((item) => ({ item, score: scoreEventCandidate(item, text, timeMinutes, targetDate) }))
      .filter((entry) => entry.score > -1000)
      .sort((a, b) => b.score - a.score || (b.item.startAt ?? '').localeCompare(a.item.startAt ?? ''))[0]?.item ?? null;
  }

  async function applyExistingEventNote(text: string, parsed?: ParseResult | null, targetOverride?: CalendarItem) {
    if (!/(备注|带上|带|准备|补充)/.test(text) || !/(会|会议|开会|面试|上课|课程|安排|日程)/.test(text)) return false;
    const target = targetOverride ?? findExistingEventTarget(text, parsed);
    if (!target) return false;
    const targetDate = target.date ?? inferCorrectionDate(text, selectedDate) ?? selectedDate;
    const preparations = extractSimplePreparations(text);
    const note = extractSimpleNote(text);
    const response = await fetch(`/api/events/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: note ? mergeText(target.notes, note) : target.notes,
        preparations: mergeList(target.preparations ?? [], preparations)
      })
    });
    if (!response.ok) return false;
    setInput('');
    inputRef.current = '';
    setMessage('');
    setSelectedDate(targetDate);
    await refreshData();
    scrollScheduleToTime(targetDate, target.startAt);
    return true;
  }

  async function applyExistingEventChange(text: string) {
    if (!/(删|删除|取消|撤掉|去掉|改|修改|重新安排|不是|补充|备注|带上|带|准备)/.test(text)) return false;
    const parsed = await fetch('/api/input/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'voice' })
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null) as ParseResult | null;
    const intent = getEventOperationIntent(text, parsed);
    if (!intent) return false;
    const target = findExistingEventTarget(text, parsed);
    if (!target) {
      setMessage('我没找到要操作的那条会议，可以补一句日期或几点。');
      return true;
    }

    if (intent === 'delete_event') {
      const response = await fetch(`/api/events/${target.id}`, { method: 'DELETE' });
      if (!response.ok) return false;
      setInput('');
      inputRef.current = '';
      setMessage('');
      const nextDate = target.date ?? selectedDate;
      setSelectedDate(nextDate);
      await refreshData();
      scrollScheduleToTime(nextDate, target.startAt);
      return true;
    }

    if (intent === 'annotate_event') {
      return applyExistingEventNote(text, parsed, target);
    }

    const targetDate = target.date ?? inferCorrectionDate(text, selectedDate) ?? selectedDate;
    const body = buildModificationBody(
      { id: target.id, kind: 'event', title: target.title, date: target.date ?? targetDate, startAt: target.startAt, endAt: target.endAt },
      text,
      parsed,
      target.date ?? targetDate
    );
    if (Object.keys(body).length === 0) return false;

    const response = await fetch(`/api/events/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) return false;
    setInput('');
    inputRef.current = '';
    setMessage('');
    const nextDate = typeof body.date === 'string' ? body.date : target.date ?? targetDate;
    setSelectedDate(nextDate);
    await refreshData();
    scrollScheduleToTime(nextDate, typeof body.startAt === 'string' ? body.startAt : target.startAt);
    return true;
  }

  useEffect(() => {
    const text = input.trim();
    if (!text || pendingClarification || pendingDecision || isListening || isThinking) {
      setParsePreview(null);
      return;
    }

    const timer = window.setTimeout(() => {
      fetch('/api/input/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'text' })
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((result: ParseResult | null) => {
          setParsePreview(result);
        })
        .catch(() => {
          setParsePreview(null);
        });
    }, 260);

    return () => window.clearTimeout(timer);
  }, [input, pendingClarification, pendingDecision, isListening, isThinking]);

  useEffect(() => {
    if (!message || pendingClarification || pendingDecision || pendingPostCommit || pendingModification || catProcessStatus || isListening || isThinking) return;
    const timer = window.setTimeout(() => setMessage(''), 5_000);
    return () => window.clearTimeout(timer);
  }, [message, pendingClarification, pendingDecision, pendingPostCommit, pendingModification, catProcessStatus, isListening, isThinking]);

  useEffect(() => {
    if (!pendingPostCommit || pendingModification || pendingClarification || pendingDecision || input || isListening || isThinking) return;
    const timer = window.setTimeout(() => {
      setPendingPostCommit(null);
      setMessage('');
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [pendingPostCommit, pendingModification, pendingClarification, pendingDecision, input, isListening, isThinking]);

  const calendarDays = useMemo(() => {
    if (data.calendar.length > 0) return data.calendar;
    const weekStart = getWeekStart(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return {
        date: toLocalDateText(date),
        label: formatWeekLabel(date),
        items: [],
        pendingItems: [],
        tasks: [],
        reminders: [],
        weatherAlerts: [],
        timeline: []
      };
    });
  }, [data.calendar]);
  const currentWeekDays = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startText = toLocalDateText(weekStart);
    const endText = toLocalDateText(weekEnd);
    return calendarDays.filter((day) => day.date >= startText && day.date <= endText).slice(0, 7);
  }, [calendarDays]);
  const futureCalendarDays = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const futureEnd = new Date(weekEnd);
    futureEnd.setDate(weekEnd.getDate() + 14);
    const endText = toLocalDateText(weekEnd);
    const futureEndText = toLocalDateText(futureEnd);
    return calendarDays.filter((day) => day.date > endText && day.date <= futureEndText && getDayPlanCount(day) > 0);
  }, [calendarDays]);
  const selectedDay = calendarDays.find((day) => day.date === selectedDate) ?? currentWeekDays[0] ?? calendarDays[0];
  const visibleCalendarDays = useMemo(() => {
    if (calendarFocusMode !== 'future') return currentWeekDays;
    return futureCalendarDays.length > 0 ? futureCalendarDays : [];
  }, [calendarFocusMode, currentWeekDays, futureCalendarDays]);
  const futurePlanCount = useMemo(() => {
    return futureCalendarDays.reduce((sum, day) => sum + getDayPlanCount(day), 0);
  }, [futureCalendarDays]);
  const visibleTodoTasks = useMemo(
    () => data.tasks.map((task) => optimisticTodoStatuses[task.id] ? { ...task, status: optimisticTodoStatuses[task.id] } : task),
    [data.tasks, optimisticTodoStatuses]
  );
  const projectTodoGroups = useMemo(() => buildProjectTodoGroups(data.todoProjects, visibleTodoTasks), [data.todoProjects, visibleTodoTasks]);
  const visibleProjectTodoGroups = projectTodoGroups;
  const monthCalendarDays = useMemo(() => buildMonthCalendarDays(now), [now]);
  const todoDeadlineDates = useMemo(() => new Set(visibleTodoTasks.map((task) => task.dueAt?.slice(0, 10)).filter(Boolean) as string[]), [visibleTodoTasks]);
  const todoDeadlineDots = useMemo(() => buildTodoDeadlineDots(visibleTodoTasks), [visibleTodoTasks]);
  const scheduleRange = useMemo(() => getScheduleRange(data.settings ?? defaultSettings), [data.settings]);

  useEffect(() => {
    window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.day-schedule').forEach((schedule) => {
        const nowLine = schedule.querySelector<HTMLElement>('.now-line');
        const targetTop = nowLine
          ? nowLine.offsetTop - schedule.clientHeight / 3
        : ((Math.max(0, 7 - scheduleRange.startHour) * 60) / scheduleRange.dayMinutes) * schedule.scrollHeight - 24;
        schedule.scrollTop = Math.max(0, targetTop);
      });
    }, 80);
  }, [visibleCalendarDays.length, calendarFocusMode, now]);

  async function submitInput() {
    await commitInput();
  }

  function setDesktopCatState(state: 'sleeping' | 'listening' | 'thinking' | 'error') {
    (window as WindowWithDesktopBridge).yayaDesktop?.setCatState(state);
  }

  function logDesktopVoiceEvent(detail: Record<string, unknown>) {
    (window as WindowWithDesktopBridge).yayaDesktop?.logVoiceEvent?.(detail);
  }

  function createDesktopDialogMessage(role: DesktopCatDialogMessage['role'], text: string, muted = false): DesktopCatDialogMessage | null {
    const value = text.trim();
    if (!value) return null;
    desktopDialogMessageIdRef.current += 1;
    return { id: `desktop-dialog-${desktopDialogMessageIdRef.current}`, role, text: value, muted };
  }

  function resetDesktopDialogMessages(nextMessages: Array<DesktopCatDialogMessage | null> = []) {
    setDesktopDialogMessages(nextMessages.filter((item): item is DesktopCatDialogMessage => Boolean(item)));
  }

  function appendDesktopDialogMessage(role: DesktopCatDialogMessage['role'], text: string, muted = false) {
    const nextMessage = createDesktopDialogMessage(role, text, muted);
    if (!nextMessage) return;
    setDesktopDialogMessages((current) => {
      const last = current[current.length - 1];
      if (last?.role === nextMessage.role && last.text === nextMessage.text) return current;
      return [...current, nextMessage].slice(-12);
    });
  }

  function appendDesktopParseResult(result: ParseResult, fallbackText: string) {
    const rewrittenText = result.transcription?.correctedText?.trim() || fallbackText.trim();
    const assistantText = result.questions[0] || getDesktopParsePreviewMessage(result);
    const hasActiveConversation = Boolean(pendingClarificationRef.current || pendingDecisionRef.current || parsePreviewRef.current);
    const userMessage = createDesktopDialogMessage('user', rewrittenText);
    const assistantMessage = createDesktopDialogMessage('assistant', assistantText);
    if (hasActiveConversation) {
      if (userMessage) appendDesktopDialogMessage(userMessage.role, userMessage.text, userMessage.muted);
      if (assistantMessage) appendDesktopDialogMessage(assistantMessage.role, assistantMessage.text, assistantMessage.muted);
      return;
    }
    resetDesktopDialogMessages([userMessage, assistantMessage]);
  }

  function getSpeechErrorName(error: unknown) {
    return typeof error === 'object' && error !== null && 'error' in error ? String((error as { error?: unknown }).error ?? '') : '';
  }

  function clearVoiceTimers() {
    if (voiceSilenceTimer.current) {
      window.clearTimeout(voiceSilenceTimer.current);
      voiceSilenceTimer.current = null;
    }
    if (voiceNoSpeechTimer.current) {
      window.clearTimeout(voiceNoSpeechTimer.current);
      voiceNoSpeechTimer.current = null;
    }
  }

  function prepareNewVoiceSession() {
    if (catStatusClearTimerRef.current) {
      window.clearTimeout(catStatusClearTimerRef.current);
      catStatusClearTimerRef.current = null;
    }
    setInput('');
    inputRef.current = '';
    setVoiceDisplayText('');
    setCatProcessStatus('');
    setMessage('');
    setParsePreview(null);
    setPendingPostCommit(null);
  }

  function updateVoiceText(text: string) {
    const nextText = text.trim();
    setInput(nextText);
    setVoiceDisplayText(nextText);
    inputRef.current = nextText;
  }

  function setCatStatus(status: string, autoClearMs?: number) {
    if (catStatusClearTimerRef.current) {
      window.clearTimeout(catStatusClearTimerRef.current);
      catStatusClearTimerRef.current = null;
    }
    setCatProcessStatus(status);
    if (autoClearMs) {
      catStatusClearTimerRef.current = window.setTimeout(() => {
        setCatProcessStatus('');
        setVoiceDisplayText('');
        catStatusClearTimerRef.current = null;
      }, autoClearMs);
    }
  }

  function focusSystemDictationInput(options: { clear?: boolean; retry?: boolean; notify?: boolean } = {}) {
    const target = systemDictationInputRef.current;
    const desktopBridge = (window as WindowWithDesktopBridge).yayaDesktop;
    const shouldNotify = options.notify !== false;
    if (!target) {
      desktopBridge?.logVoiceEvent?.({ type: 'system-dictation-target-missing' });
      if (shouldNotify) desktopBridge?.notifyDictationTargetReady?.({ voiceSessionId: voiceSessionIdRef.current, focused: false });
      return false;
    }

    if (options.clear) target.value = '';
    target.removeAttribute('tabindex');
    target.focus({ preventScroll: true });
    target.select();

    const reportReady = () => {
      const focused = document.activeElement === target;
      desktopBridge?.logVoiceEvent?.({
        type: 'system-dictation-target-ready',
        focused,
        activeTag: document.activeElement?.tagName ?? null
      });
      if (shouldNotify) desktopBridge?.notifyDictationTargetReady?.({ voiceSessionId: voiceSessionIdRef.current, focused });
      return focused;
    };

    if (reportReady()) return true;
    if (options.retry) {
      window.setTimeout(() => {
        target.focus({ preventScroll: true });
        target.select();
        reportReady();
      }, 120);
    }
    return false;
  }

  function startVoiceInput(options: { silent?: boolean } = {}) {
    if (isListeningRef.current) {
      submitCurrentVoiceInput();
      return;
    }
    const SpeechRecognition = (window as WindowWithSpeech).SpeechRecognition ?? (window as WindowWithSpeech).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      logDesktopVoiceEvent({
        type: 'speech-api-unavailable',
        hasSpeechRecognition: Boolean((window as WindowWithSpeech).SpeechRecognition),
        hasWebkitSpeechRecognition: Boolean((window as WindowWithSpeech).webkitSpeechRecognition)
      });
      setMessage('这个浏览器暂时没有语音识别，先用输入框记录。');
      setDesktopCatState('error');
      window.setTimeout(() => setDesktopCatState('sleeping'), 1800);
      return;
    }
    clearVoiceTimers();
    voiceStopReasonRef.current = 'manual';
    recognitionRef.current?.stop();
    const sessionId = voiceSessionIdRef.current + 1;
    voiceSessionIdRef.current = sessionId;
    voiceStopReasonRef.current = null;
    voiceRecoverUntilRef.current = Date.now() + 10_000;
    voiceRecoverAttemptsRef.current = 0;
    voiceRestartPendingRef.current = false;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      if (sessionId !== voiceSessionIdRef.current) return;
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      const nextTranscript = transcript.trim();
      if (!nextTranscript) return;
      if (voiceNoSpeechTimer.current) {
        window.clearTimeout(voiceNoSpeechTimer.current);
        voiceNoSpeechTimer.current = null;
      }
      updateVoiceText(nextTranscript);
      logDesktopVoiceEvent({
        type: 'result',
        sessionId,
        transcriptLength: nextTranscript.length,
        isFinal: Array.from(event.results).some((result) => result.isFinal)
      });
    };
    recognition.onend = () => {
      if (sessionId !== voiceSessionIdRef.current) return;
      const reason = voiceStopReasonRef.current;
      logDesktopVoiceEvent({
        type: 'end',
        sessionId,
        reason: reason ?? 'unexpected',
        hasInput: Boolean(inputRef.current.trim())
      });
      if (!reason && isListeningRef.current && !inputRef.current.trim() && !voiceRestartPendingRef.current) {
        voiceRestartPendingRef.current = true;
        window.setTimeout(() => {
          voiceRestartPendingRef.current = false;
          if (sessionId !== voiceSessionIdRef.current || voiceStopReasonRef.current || inputRef.current.trim()) return;
          try {
            recognition.start();
            logDesktopVoiceEvent({ type: 'restart-after-end', sessionId });
          } catch {
            stopVoiceInput('error');
          }
        }, 220);
        return;
      }
      setIsListening(false);
      setDesktopCatState(reason === 'error' ? 'error' : 'sleeping');
    };
    recognition.onerror = (error) => {
      if (sessionId !== voiceSessionIdRef.current) return;
      const errorName = getSpeechErrorName(error);
      console.warn('voice recognition error', error);
      logDesktopVoiceEvent({
        type: 'error',
        sessionId,
        errorName,
        hasInput: Boolean(inputRef.current.trim())
      });
      if ((errorName === 'no-speech' || errorName === 'aborted') && !inputRef.current.trim()) return;
      if (errorName === 'network' && !inputRef.current.trim() && Date.now() < voiceRecoverUntilRef.current && voiceRecoverAttemptsRef.current < 3) {
        voiceRecoverAttemptsRef.current += 1;
        voiceRestartPendingRef.current = true;
        window.setTimeout(() => {
          voiceRestartPendingRef.current = false;
          if (sessionId !== voiceSessionIdRef.current || voiceStopReasonRef.current || inputRef.current.trim()) return;
          try {
            recognition.start();
            logDesktopVoiceEvent({ type: 'restart-after-network', sessionId, attempt: voiceRecoverAttemptsRef.current });
          } catch (retryError) {
            logDesktopVoiceEvent({ type: 'restart-failed', sessionId, errorName: getSpeechErrorName(retryError) });
            stopVoiceInput('error');
          }
        }, 420);
        return;
      }
      stopVoiceInput('error');
      if (errorName === 'not-allowed' || errorName === 'service-not-allowed') {
        setMessage('麦克风权限没有打开，可以允许后再点小猫。');
      } else if (errorName === 'audio-capture') {
        setMessage('没有找到可用麦克风，检查一下设备再试。');
      } else {
        setMessage('刚才听写出错了，可以再点一下小猫。');
      }
      window.setTimeout(() => setDesktopCatState('sleeping'), 1800);
    };
    recognitionRef.current = recognition;
    prepareNewVoiceSession();
    setIsListening(true);
    setDesktopCatState('listening');
    logDesktopVoiceEvent({
      type: 'ready',
      sessionId,
      hasSpeechRecognition: Boolean((window as WindowWithSpeech).SpeechRecognition),
      hasWebkitSpeechRecognition: Boolean((window as WindowWithSpeech).webkitSpeechRecognition)
    });
    if (!options.silent) setMessage('我在听，你可以直接说。');
    voiceNoSpeechTimer.current = window.setTimeout(() => {
      if (sessionId !== voiceSessionIdRef.current || inputRef.current.trim()) return;
      stopVoiceInput('idle-timeout');
      const nowMs = Date.now();
      if (nowMs - lastNoSpeechMessageAt.current > 8000) {
        lastNoSpeechMessageAt.current = nowMs;
        setMessage('刚才没听到声音，你准备好再点我。');
      }
    }, 12_000);
    try {
      recognition.start();
      logDesktopVoiceEvent({ type: 'start', sessionId });
    } catch (error) {
      stopVoiceInput('error');
      logDesktopVoiceEvent({ type: 'start-failed', sessionId, errorName: getSpeechErrorName(error) });
      console.warn('voice recognition start failed', error);
      if (!options.silent) setMessage('刚才没有打开听写，可以再点一下小猫。');
      window.setTimeout(() => setDesktopCatState('sleeping'), 1800);
    }
  }

  function restartVoiceInputSoon(delay = 220) {
    window.setTimeout(() => {
      const desktopBridge = (window as WindowWithDesktopBridge).yayaDesktop;
      if (desktopBridge?.isDesktopShell && desktopBridge.requestVoiceInput) {
        desktopBridge.requestVoiceInput();
        return;
      }
      startVoiceInput({ silent: true });
      window.setTimeout(() => {
        if (!isListeningRef.current) startVoiceInput({ silent: true });
      }, 700);
    }, delay);
  }

  function stopVoiceInput(reason: 'manual' | 'submit' | 'idle-timeout' | 'error' = 'manual') {
    voiceStopReasonRef.current = reason;
    clearVoiceTimers();
    if (reason === 'manual') recognitionRef.current?.abort?.();
    else recognitionRef.current?.stop();
    setIsListening(false);
    setDesktopCatState(reason === 'error' ? 'error' : 'sleeping');
  }

  function cancelVoiceInteraction(nextMessage = '好，这次先取消。') {
    stopVoiceInput('manual');
    setIsThinking(false);
    setInput('');
    inputRef.current = '';
    if (systemDictationInputRef.current) systemDictationInputRef.current.value = '';
    setVoiceDisplayText('');
    setCatProcessStatus('');
    setParsePreview(null);
    setPendingClarification(null);
    setPendingDecision(null);
    setPendingPostCommit(null);
    setPendingModification(null);
    resetDesktopDialogMessages();
    setMessage(nextMessage);
    setDesktopCatState('sleeping');
    (window as WindowWithDesktopBridge).yayaDesktop?.setCatMessage?.(nextMessage);
  }

  async function submitCurrentVoiceInput() {
    const text = inputRef.current.trim();
    if (!text) {
      stopVoiceInput('idle-timeout');
      setMessage('刚才没听到声音，你准备好再点我。');
      return;
    }
    stopVoiceInput('submit');
    await parseVoiceInputForPreview(text);
  }

  function queueVoiceAutoSubmit() {
    if (voiceSilenceTimer.current) window.clearTimeout(voiceSilenceTimer.current);
    voiceSilenceTimer.current = window.setTimeout(async () => {
      const text = inputRef.current.trim();
      if (!text) {
        stopVoiceInput('idle-timeout');
        return;
      }
      await submitCurrentVoiceInput();
    }, 1800);
  }

  async function parseVoiceInputForPreview(text: string) {
    logDesktopVoiceEvent({
      type: 'parse-preview-start',
      length: text.trim().length,
      preview: text.trim().slice(0, 36)
    });
    setIsThinking(true);
    setParsePreview(null);
    setCatStatus('文字整理中');
    setMessage('');
    try {
      const response = await fetch('/api/input/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'voice' })
      });
      setIsThinking(false);
      if (!response.ok) {
        logDesktopVoiceEvent({
          type: 'parse-preview-http-error',
          status: response.status,
          statusText: response.statusText
        });
        setMessage('这句还没理解出来，可以再说一遍。');
        return null;
      }
      const result = (await response.json()) as ParseResult;
      const rewrittenText = result.transcription?.correctedText?.trim() || text;
      logDesktopVoiceEvent({
        type: 'parse-preview-success',
        intent: result.intent,
        confidence: result.confidence,
        rewrittenLength: rewrittenText.length,
        rewrittenPreview: rewrittenText.slice(0, 36),
        hasQuestions: result.questions.length > 0
      });
      updateVoiceText(rewrittenText);
      appendDesktopParseResult(result, rewrittenText);
      setCatStatus(result.needsConfirmation || result.questions.length ? '' : '安排事项中');
      if (result.questions.length && getConflictOptions(result).length === 0) {
        setPendingClarification(result);
        setParsePreview(null);
      } else {
        setPendingClarification(null);
        setParsePreview(result);
      }
      setMessage(result.needsConfirmation || result.questions.length ? '' : '我整理好了，你看一下确认卡片。');
      if (isDesktopShell && shouldAutoCommitDesktopVoicePreview(result)) {
        logDesktopVoiceEvent({
          type: 'desktop-auto-commit-start',
          intent: result.intent,
          textLength: rewrittenText.length,
          preview: rewrittenText.slice(0, 36)
        });
        setCatStatus('安排事项中');
        setMessage('');
        await commitInput(undefined, rewrittenText, 'voice');
      } else if (isDesktopShell && (result.needsConfirmation || result.questions.length)) {
        restartVoiceInputSoon(120);
      }
      return result;
    } catch (error) {
      setIsThinking(false);
      logDesktopVoiceEvent({
        type: 'parse-preview-error',
        message: error instanceof Error ? error.message : String(error)
      });
      setMessage('这句还没理解出来，可以再说一遍。');
      return null;
    }
  }

  async function handleDesktopRecognizedText(text: string) {
    const rawText = text.trim();
    logDesktopVoiceEvent({
      type: 'desktop-recognized-text',
      length: rawText.length,
      preview: rawText.slice(0, 36)
    });
    if (!rawText) {
      setMessage('刚才没听到声音，你准备好再点我。');
      return;
    }
    updateVoiceText(rawText);
    setMessage('');
    const activeClarification = pendingClarificationRef.current;
    const activePreview = parsePreviewRef.current;
    if (activeClarification || activePreview?.questions.length) {
      appendDesktopDialogMessage('user', rawText);
      await commitInput(undefined, rawText, 'voice');
      return;
    }
    await parseVoiceInputForPreview(rawText);
  }

  async function commitInput(selectedOptionId?: string, inputOverride?: string, sourceOverride: 'voice' | 'text' | 'manual' = 'voice') {
    const activeClarification = pendingClarificationRef.current;
    const activeDecision = selectedOptionId ? pendingDecisionRef.current : null;
    const text = buildInputForCommit((inputOverride ?? input).trim(), activeClarification, activeDecision);
    if (!text) return;
    logDesktopVoiceEvent({
      type: 'commit-start',
      source: sourceOverride,
      selectedOptionId: selectedOptionId ?? null,
      textLength: text.length,
      preview: text.slice(0, 36)
    });
    setIsThinking(true);
    setCatStatus('安排事项中');
    setMessage('');

    if (!activeClarification && !activeDecision && !selectedOptionId && pendingModification) {
      await applyPostCommitModification(pendingModification, text);
      return;
    }

    if (!activeClarification && !activeDecision && !selectedOptionId && await applyExistingEventChange(text)) {
      setIsThinking(false);
      return;
    }

    if (!activeClarification && !activeDecision && !selectedOptionId && needsIntentCheck(text)) {
      setIsThinking(false);
      setInput('');
      inputRef.current = '';
      setMessage('刚刚这句是要新增安排或任务吗？');
      restartVoiceInputSoon();
      return;
    }

    const response = await fetch('/api/input/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: sourceOverride, selectedOptionId })
    });
    const result = response.ok ? ((await response.json()) as CommitResponse) : null;

    if (response.ok && result?.ok) {
      logDesktopVoiceEvent({
        type: 'commit-success',
        intent: result.parseResult?.intent ?? null,
        resolvedBy: result.resolvedBy ?? null,
        feedback: result.feedback ?? null
      });
      setInput('');
      inputRef.current = '';
      setParsePreview(null);
      setPendingClarification(null);
      setPendingDecision(null);
      resetDesktopDialogMessages();
      const nextAction = createPostCommitAction(result);
      setPendingPostCommit(nextAction);
      setMessage(nextAction ? '' : getCommitMessage(result.parseResult, result.resolvedBy, result.feedback));
      await refreshData();
      if (nextAction) focusWrittenAction(nextAction);
      setIsThinking(false);
      setCatStatus('完成了', 5000);
    } else if (result?.needsConfirmation) {
      logDesktopVoiceEvent({
        type: 'commit-needs-confirmation',
        intent: result.parseResult?.intent ?? null,
        feedback: result.feedback ?? null,
        optionCount: result.parseResult ? getConflictOptions(result.parseResult).length : 0
      });
      setIsThinking(false);
      const nextParse = result.parseResult ?? null;
      if (nextParse && getConflictOptions(nextParse).length === 0) {
        setPendingClarification(nextParse);
        setParsePreview(null);
        setInput('');
        inputRef.current = '';
        appendDesktopDialogMessage('assistant', nextParse.questions[0] || getCommitMessage(result.parseResult, undefined, result.feedback));
        restartVoiceInputSoon();
      } else {
        setPendingClarification(null);
        setPendingDecision(nextParse);
        setParsePreview(null);
        setInput('');
        appendDesktopDialogMessage('assistant', getCommitMessage(result.parseResult, undefined, result.feedback));
      }
      setMessage(getCommitMessage(result.parseResult, undefined, result.feedback));
    } else {
      logDesktopVoiceEvent({
        type: 'commit-failed',
        httpOk: response.ok,
        feedback: result?.feedback ?? null
      });
      setIsThinking(false);
      setMessage('这条还没记上，等下再试一次。');
    }
  }

  function handleDecisionOption(optionId: string) {
    if (optionId === 'edit-input') {
      const originalText = pendingDecision?.rawText ?? '';
      setPendingDecision(null);
      setInput(originalText);
      inputRef.current = originalText;
      setMessage('');
      restartVoiceInputSoon(160);
      return;
    }
    void commitInput(optionId);
  }

  function handleDesktopBubbleOption(optionId: string) {
    const activeDecision = pendingDecisionRef.current;
    const activePreview = activeDecision ?? parsePreviewRef.current ?? pendingClarificationRef.current;
    const fallbackText = activePreview?.rawText || inputRef.current.trim() || '确认当前草稿';
    logDesktopVoiceEvent({
      type: 'bubble-option',
      optionId,
      hasActiveDecision: Boolean(activeDecision),
      hasActivePreview: Boolean(activePreview)
    });
    void commitInput(optionId, fallbackText, 'manual');
  }

  async function commitQuickProgress(text: string) {
    const response = await fetch('/api/input/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'manual' })
    });
    const result = response.ok ? ((await response.json()) as CommitResponse) : null;

    if (response.ok && result?.ok) {
      setMessage(getCommitMessage(result.parseResult, undefined, result.feedback));
      await refreshData();
    } else {
      setMessage('这条进度还没记上，等下再试一次。');
    }
  }

  async function callAction(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (response.ok) {
      await refreshData();
      setMessage('状态更新好了。');
    } else {
      setMessage('这一步没有成功，稍后再试。');
    }
  }

  function openDetail(item: DetailTarget) {
    setSelectedDetail(item);
    setSelectedLog(null);
    setLogDraft(null);
    setDetailDraft(createDetailDraft(item, selectedDate));
  }

  function openDetailFromRow(event: ReactMouseEvent<HTMLElement>, item: DetailTarget) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('button, input, textarea, select, .detail-editor, .detail-actions')
    ) {
      return;
    }
    setSelectedDetail(item);
    setSelectedLog(null);
    setLogDraft(null);
  }

  function editDetailFromRow(event: ReactMouseEvent<HTMLElement>, item: DetailTarget) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('button, input, textarea, select, .detail-editor, .detail-actions')
    ) {
      return;
    }
    openDetail(item);
  }

  async function deleteItem(item: DetailTarget) {
    if (item.isDraft && item.draftId) {
      removeDraftFromView(item.draftId);
      setSelectedDetail(null);
      setDetailDraft(null);
      setMessage('草稿已取消，没有写入正式数据。');
      const response = await fetch('/api/input/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.rawText || item.title, source: 'manual', selectedOptionId: `cancel-draft:${item.draftId}` })
      });
      if (response.ok) {
        void refreshData();
      } else {
        setMessage('草稿取消没有成功，等下再试一次。');
        await refreshData();
      }
      return;
    }

    if (item.kind === 'task') removeTaskFromView(item.id);
    else removeEventFromView(item.id);
    setSelectedDetail(null);
    setDetailDraft(null);
    setMessage('已删除，这条不会再出现在安排里。');
    const path = item.kind === 'task' ? `/api/tasks/${item.id}` : `/api/events/${item.id}`;
    const response = await fetch(path, { method: 'DELETE' });
    if (response.ok) {
      void refreshData();
    } else {
      setMessage('删除没有成功，等下再试一次。');
      await refreshData();
    }
  }

  async function saveItemDraft() {
    if (!selectedDetail || !detailDraft) return;
    if (detailSaveInFlightRef.current) return;
    detailSaveInFlightRef.current = true;
    const activeDetail = selectedDetail;
    const draft = detailDraft;
    const path = activeDetail.kind === 'task' ? `/api/tasks/${activeDetail.id}` : `/api/events/${activeDetail.id}`;
    const body =
      activeDetail.kind === 'task'
        ? {
            title: draft.title,
            notes: draft.notes,
            dueAt: combineLocalDateTime(draft.dueDate, draft.dueTime),
            estimatedMinutes: draft.estimatedMinutes ? Number(draft.estimatedMinutes) : null,
            preparations: splitPreparations(draft.preparationsText)
          }
        : {
            title: draft.title,
            notes: draft.notes,
            purpose: draft.purpose,
            preparations: splitPreparations(draft.preparationsText),
            date: draft.date,
            startAt: combineLocalDateTime(draft.date, draft.startTime),
            endAt: combineLocalDateTime(draft.date, draft.endTime)
          };
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (response.ok) {
      setSelectedDetail(null);
      setDetailDraft(null);
      setMessage('修改好了。');
      await refreshData();
    } else {
      setMessage('修改没有成功，等下再试一次。');
    }
    detailSaveInFlightRef.current = false;
  }

  function openLog(log: CalendarLog) {
    setSelectedLog(log);
    setSelectedDetail(null);
    setDetailDraft(null);
    setLogDraft(createLogDraft(log, selectedDate));
  }

  async function saveLogDraft() {
    if (!selectedLog || !logDraft) return;
    const response = await fetch(`/api/work-logs/${selectedLog.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: logDraft.note, at: combineLocalDateTime(logDraft.date, logDraft.time) })
    });
    if (response.ok) {
      setSelectedLog(null);
      setLogDraft(null);
      setMessage('执行记录改好了。');
      await refreshData();
    } else {
      setMessage('执行记录没有改成功，等下再试一次。');
    }
  }

  async function deleteLog(log: CalendarLog) {
    removeLogFromView(log.id);
    setSelectedLog(null);
    setLogDraft(null);
    setMessage('执行记录已删除。');
    const response = await fetch(`/api/work-logs/${log.id}`, { method: 'DELETE' });
    if (response.ok) {
      void refreshData();
    } else {
      setMessage('执行记录没有删掉，等下再试一次。');
      await refreshData();
    }
  }

  async function createGoalFromForm() {
    const title = goalTitle.trim();
    if (!title) {
      setMessage('目标标题还空着。');
      return;
    }
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, targetDate: goalTargetDate || null })
    });
    if (response.ok) {
      setGoalTitle('');
      setGoalTargetDate('');
      setMessage('阶段性目标已加入。');
      await refreshData();
    } else {
      setMessage('目标还没加上，稍后再试。');
    }
  }

  async function updateGoal(id: string, status: GoalRecord['status']) {
    const response = await fetch(`/api/goals/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (response.ok) {
      setMessage(status === 'done' ? '目标完成记录好了。' : '目标状态已更新。');
      await refreshData();
    }
  }

  async function refreshDataWithTransition() {
    const startViewTransition = (document as Document & { startViewTransition?: (callback: () => Promise<void>) => void }).startViewTransition;
    if (startViewTransition) {
      startViewTransition(async () => {
        await refreshData();
      });
      return;
    }
    await refreshData();
  }

  async function updateTodoTaskStatus(task: TaskListItem, status: TaskListItem['status']) {
    setOptimisticTodoStatuses((current) => ({ ...current, [task.id]: status }));
    patchTodoTaskInView(task.id, { status });
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (response.ok) {
      setMessage(status === 'done' ? '这条待办完成了，已收到底部。' : '这条待办已恢复。');
      await refreshDataWithTransition();
      setOptimisticTodoStatuses((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
    } else {
      setMessage('待办状态没有更新成功，稍后再试。');
      setOptimisticTodoStatuses((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      await refreshData();
    }
  }

  async function createBlankTodoProject() {
    const response = await fetch('/api/todo-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新项目' })
    });
    if (response.ok) {
      const result = (await response.json()) as { project?: TodoProject };
      if (result.project) {
        setEditingProjectId(result.project.id);
        setProjectTitleDraft(result.project.title);
      }
      setMessage('项目分类加好了，可以直接改标题。');
      await refreshData();
    } else {
      setMessage('项目分类没有加上，稍后再试。');
    }
  }

  function startEditTodoProject(project: TodoProject) {
    setEditingProjectId(project.id);
    setProjectTitleDraft(project.title);
  }

  async function saveTodoProjectTitle(projectId: string, options: { focusNewTask?: boolean } = {}) {
    const title = projectTitleDraft.trim();
    if (!title) {
      setMessage('项目分类名称还空着。');
      return;
    }
    if (projectId === 'uncategorized') {
      const response = await fetch('/api/todo-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (response.ok) {
        const result = (await response.json()) as { project?: TodoProject };
        if (result.project) {
          const uncategorizedTasks = data.tasks.filter((task) => task.projectId === 'uncategorized');
          await Promise.all(
            uncategorizedTasks.map((task) =>
              fetch(`/api/tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: result.project!.id })
              })
            )
          );
        }
        setEditingProjectId(null);
        setProjectTitleDraft('');
        setMessage('未归类已经改成新的项目分类。');
        await refreshData();
        if (options.focusNewTask && result.project) startNewTodoTask(result.project.id);
      }
      return;
    }

    patchTodoProjectInView(projectId, { title });
    setEditingProjectId(null);
    setProjectTitleDraft('');
    if (options.focusNewTask) startNewTodoTask(projectId);
    const response = await fetch(`/api/todo-projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (response.ok) {
      setMessage('项目分类已更新。');
      void refreshData();
    } else {
      setMessage('项目分类没有改成功，稍后再试。');
      await refreshData();
    }
  }

  async function deleteTodoProject(project: TodoProject) {
    setTodoContextMenu(null);
    if (isUncategorizedTodoProject(project)) {
      setMessage('未归类是兜底收纳区，不能删除。');
      return;
    }
    removeTodoProjectFromView(project.id);
    setMessage('项目分类已删除，原有待办已移到未归类。');
    const response = await fetch(`/api/todo-projects/${project.id}`, { method: 'DELETE' });
    if (response.ok) {
      void refreshData();
    } else {
      setMessage('项目分类没有删掉，稍后再试。');
      await refreshData();
    }
  }

  function updateNewTodoTaskDraft(projectId: string, patch: Partial<TodoTaskDraft>) {
    setNewTaskDraftByProject((drafts) => ({
      ...drafts,
      [projectId]: { ...(drafts[projectId] ?? { title: '', notes: '', projectId }), ...patch }
    }));
  }

  function startNewTodoTask(projectId: string) {
    setActiveNewTaskProjectId(projectId);
    updateNewTodoTaskDraft(projectId, { projectId });
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-new-task-project="${projectId}"]`)?.focus();
    }, 60);
  }

  function cancelBlankNewTodoTask(projectId: string) {
    const draft = newTaskDraftByProject[projectId];
    if (draft?.title.trim() || draft?.notes.trim()) return;
    setActiveNewTaskProjectId((current) => (current === projectId ? null : current));
    setNewTaskDraftByProject((drafts) => {
      const next = { ...drafts };
      delete next[projectId];
      return next;
    });
  }

  async function finishNewTodoTaskDraft(projectId: string) {
    const draft = newTaskDraftByProject[projectId];
    if (!draft?.title.trim()) {
      cancelBlankNewTodoTask(projectId);
      return;
    }
    await createTodoTaskFromProject(projectId);
  }

  async function createTodoTaskFromProject(projectId: string) {
    if (savingNewTaskProjectIds.current.has(projectId)) return;
    const draft = newTaskDraftByProject[projectId] ?? { title: '', notes: '', projectId };
    const title = draft.title.trim();
    if (!title) {
      cancelBlankNewTodoTask(projectId);
      return;
    }
    savingNewTaskProjectIds.current.add(projectId);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes: draft.notes.trim() || undefined,
          projectId: projectId === 'uncategorized' ? null : projectId
        })
      });
      if (response.ok) {
        setNewTaskDraftByProject((drafts) => ({ ...drafts, [projectId]: { title: '', notes: '', projectId } }));
        setActiveNewTaskProjectId(null);
        setMessage('待办加好了。');
        await refreshData();
      } else {
        setMessage('待办没有加上，稍后再试。');
      }
    } finally {
      savingNewTaskProjectIds.current.delete(projectId);
    }
  }

  function startEditTodoTask(task: TaskListItem, field: TodoEditField) {
    setEditingTodoTaskId(task.id);
    setEditingTodoField(field);
    setTodoTaskDraft({
      title: task.title,
      notes: stripTodoDateTags(task.notes ?? ''),
      projectId: task.projectId
    });
  }

  async function saveTodoTaskDraft(taskId: string) {
    const title = todoTaskDraft.title.trim();
    if (!title) {
      setMessage('待办内容还空着。');
      return;
    }
    const notes = todoTaskDraft.notes.trim() || '';
    const projectId = todoTaskDraft.projectId === 'uncategorized' ? 'uncategorized' : todoTaskDraft.projectId;
    patchTodoTaskInView(taskId, { title, notes, projectId });
    setEditingTodoTaskId(null);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes,
        projectId: todoTaskDraft.projectId === 'uncategorized' ? null : todoTaskDraft.projectId
      })
    });
    if (response.ok) {
      setMessage('待办已更新。');
      void refreshData();
    } else {
      setMessage('待办没有改成功，稍后再试。');
      await refreshData();
    }
  }

  async function deleteTodoTask(task: TaskListItem) {
    setTodoContextMenu(null);
    removeTaskFromView(task.id);
    setEditingTodoTaskId((current) => (current === task.id ? null : current));
    setMessage('待办已删除。');
    const response = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    if (response.ok) {
      void refreshData();
    } else {
      setMessage('待办没有删掉，稍后再试。');
      await refreshData();
    }
  }

  function openTodoProjectContextMenu(event: ReactMouseEvent<HTMLElement>, project: TodoProject) {
    event.preventDefault();
    event.stopPropagation();
    if (isUncategorizedTodoProject(project)) {
      setMessage('未归类是兜底收纳区，不能删除。');
      setTodoContextMenu(null);
      return;
    }
    setTodoContextMenu({ kind: 'project', project, x: event.clientX, y: event.clientY });
  }

  function openTodoTaskContextMenu(event: ReactMouseEvent<HTMLElement>, task: TaskListItem) {
    event.preventDefault();
    event.stopPropagation();
    setTodoContextMenu({ kind: 'task', task, x: event.clientX, y: event.clientY });
  }

  function openDetailContextMenu(event: ReactMouseEvent<HTMLElement>, item: DetailTarget) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedDetail(item);
    setSelectedLog(null);
    setDetailDraft(null);
    setDetailContextMenu({ item, x: event.clientX, y: event.clientY });
  }

  async function moveTodoTaskToProject(task: TaskListItem, projectId: string) {
    if ((task.projectId || 'uncategorized') === projectId) {
      clearTodoDragState();
      return;
    }
    const targetTasks = visibleTodoTasks.filter((item) => (item.projectId || 'uncategorized') === projectId && item.status !== 'cancelled');
    patchTodoTaskInView(task.id, { projectId });
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectId === 'uncategorized' ? null : projectId, order: targetTasks.length + 1 })
    });
    if (response.ok) {
      clearTodoDragState();
      setMessage('待办已移动到新的项目。');
      await refreshDataWithTransition();
    } else {
      setMessage('待办没有移动成功，稍后再试。');
    }
  }

  async function assignTodoDeadline(task: TaskListItem, date: string) {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueAt: `${date}T15:59:00.000Z` })
    });
    if (response.ok) {
      setDraggedTodoTaskId(null);
      setMessage(`已把“${task.title}”链接到 ${date} 截止。`);
      await refreshData();
    } else {
      setMessage('截止日期没有更新成功，稍后再试。');
    }
  }

  async function clearTodoDeadline(task: TaskListItem) {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueAt: null })
    });
    if (response.ok) {
      setMessage('截止日期已移除。');
      await refreshData();
    } else {
      setMessage('截止日期没有删掉，稍后再试。');
    }
  }

  function shouldIgnoreTodoDragTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest('button, input, textarea, select, [contenteditable="true"]'));
  }

  function armTodoDrag(event: ReactMouseEvent<HTMLElement>, kind: TodoDragKind, id: string) {
    if (event.button !== 0) return;
    if (shouldIgnoreTodoDragTarget(event.target)) return;
    window.getSelection()?.removeAllRanges();
    if (todoLongPressTimerRef.current) window.clearTimeout(todoLongPressTimerRef.current);
    window.addEventListener(
      'mouseup',
      () => {
        if (!todoLongPressTimerRef.current) return;
        window.clearTimeout(todoLongPressTimerRef.current);
        todoLongPressTimerRef.current = null;
      },
      { once: true }
    );
    todoLongPressTimerRef.current = window.setTimeout(() => {
      todoLongPressTimerRef.current = null;
      isNativeTodoDraggingRef.current = true;
      window.getSelection()?.removeAllRanges();
      setTodoDragReady({ kind, id });
      if (kind === 'task') {
        setDraggedTodoTaskId(id);
        setDraggedTodoProjectId(null);
      } else {
        setDraggedTodoProjectId(id);
        setDraggedTodoTaskId(null);
      }
      setTodoDropPreview(null);
    }, 260);
  }

  function disarmTodoDragIfIdle() {
    if (todoLongPressTimerRef.current) {
      window.clearTimeout(todoLongPressTimerRef.current);
      todoLongPressTimerRef.current = null;
    }
    if (!isNativeTodoDraggingRef.current) {
      setDraggedTodoTaskId(null);
      setDraggedTodoProjectId(null);
      setTodoDragReady(null);
      setTodoDropPreview(null);
    }
  }

  function getDropPosition(event: { currentTarget: HTMLElement; clientY: number }): 'before' | 'after' {
    return getElementDropPosition(event.currentTarget, event.clientY);
  }

  function getElementDropPosition(element: HTMLElement, clientY: number): 'before' | 'after' {
    const rect = element.getBoundingClientRect();
    return clientY > rect.top + rect.height / 2 ? 'after' : 'before';
  }

  function startTodoDrag(event: { dataTransfer: DataTransfer; preventDefault: () => void }, task: TaskListItem) {
    if (todoDragReady?.kind !== 'task' || todoDragReady.id !== task.id) {
      event.preventDefault();
      return;
    }
    isNativeTodoDraggingRef.current = true;
    setDraggedTodoTaskId(task.id);
    setTodoDropPreview(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-yayamind-todo-task', task.id);
    event.dataTransfer.setData('text/plain', task.id);
  }

  function getDraggedTodoTask(event: { dataTransfer: DataTransfer }) {
    const id = event.dataTransfer.getData('application/x-yayamind-todo-task') || event.dataTransfer.getData('text/plain') || draggedTodoTaskId;
    return data.tasks.find((item) => item.id === id) ?? null;
  }

  function startTodoProjectDrag(event: { dataTransfer: DataTransfer; target: EventTarget; preventDefault: () => void }, project: TodoProject) {
    if (project.id === 'uncategorized') {
      event.preventDefault();
      return;
    }
    if (todoDragReady?.kind !== 'project' || todoDragReady.id !== project.id) {
      event.preventDefault();
      return;
    }
    if (event.target instanceof HTMLElement && event.target.closest('button, input, textarea, select')) {
      event.preventDefault();
      return;
    }
    isNativeTodoDraggingRef.current = true;
    setDraggedTodoProjectId(project.id);
    setTodoDropPreview(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-yayamind-todo-project', project.id);
  }

  function getDraggedTodoProject(event: { dataTransfer: DataTransfer }) {
    const id = event.dataTransfer.getData('application/x-yayamind-todo-project') || draggedTodoProjectId;
    return data.todoProjects.find((project) => project.id === id) ?? null;
  }

  function getClosestTaskDropTarget(groupElement: HTMLElement, clientY: number) {
    const taskElements = Array.from(groupElement.querySelectorAll<HTMLElement>('.project-todo-item'));
    if (!taskElements.length) return null;
    return taskElements.reduce<{ element: HTMLElement; distance: number } | null>((closest, element) => {
      const rect = element.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const distance = Math.abs(clientY - center);
      if (!closest || distance < closest.distance) return { element, distance };
      return closest;
    }, null)?.element ?? null;
  }

  function getTodoDropPreviewFromPoint(clientX: number, clientY: number): TodoDropPreview | null {
    const element = document.elementFromPoint(clientX, clientY);
    if (!(element instanceof HTMLElement)) return null;

    if (draggedTodoTaskId) {
      const dateElement = element.closest<HTMLElement>('[data-todo-date]');
      const targetDate = dateElement?.dataset.todoDate;
      if (targetDate) return { kind: 'date', targetId: targetDate };
    }

    const groupElement = element.closest<HTMLElement>('.project-todo-group');
    const projectId = groupElement?.dataset.projectId;
    if (!groupElement || !projectId) return null;

    if (draggedTodoTaskId) {
      const draggedTask = data.tasks.find((item) => item.id === draggedTodoTaskId);
      const taskElement = element.closest<HTMLElement>('.project-todo-item') ?? getClosestTaskDropTarget(groupElement, clientY);
      const targetTaskId = taskElement?.dataset.taskId;
      if (draggedTask && targetTaskId && (draggedTask.projectId || 'uncategorized') === projectId) {
        return { kind: 'task', targetId: targetTaskId, position: getElementDropPosition(taskElement, clientY) };
      }
      return { kind: 'project-end', targetId: projectId };
    }

    if (draggedTodoProjectId && projectId !== draggedTodoProjectId && projectId !== 'uncategorized') {
      return { kind: 'project', targetId: projectId, position: getElementDropPosition(groupElement, clientY) };
    }

    return null;
  }

  async function commitTodoDropPreview(preview: TodoDropPreview | null) {
    if (!preview) {
      clearTodoDragState();
      return;
    }
    if (draggedTodoTaskId) {
      const task = data.tasks.find((item) => item.id === draggedTodoTaskId);
      if (!task) {
        clearTodoDragState();
        return;
      }
      if (preview.kind === 'project-end') {
        await moveTodoTaskToProject(task, preview.targetId);
        return;
      }
      if (preview.kind === 'task') {
        const targetTask = data.tasks.find((item) => item.id === preview.targetId);
        if (!targetTask || targetTask.id === task.id) {
          clearTodoDragState();
          return;
        }
        await moveTodoTaskRelative(task, targetTask, targetTask.projectId || 'uncategorized', preview.position);
        return;
      }
      if (preview.kind === 'date') {
        await assignTodoDeadline(task, preview.targetId);
        return;
      }
    }
    if (draggedTodoProjectId && preview.kind === 'project') {
      const project = data.todoProjects.find((item) => item.id === draggedTodoProjectId);
      const targetProject = data.todoProjects.find((item) => item.id === preview.targetId);
      if (project && targetProject) {
        await moveTodoProjectRelative(project, targetProject, preview.position);
        return;
      }
    }
    clearTodoDragState();
  }

  async function moveTodoProjectRelative(project: TodoProject, targetProject: TodoProject, position: 'before' | 'after') {
    if (project.id === targetProject.id || project.id === 'uncategorized' || targetProject.id === 'uncategorized') return;
    const orderedProjects = [...data.todoProjects].sort(compareTodoProjects);
    const fromIndex = orderedProjects.findIndex((item) => item.id === project.id);
    const toIndex = orderedProjects.findIndex((item) => item.id === targetProject.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = orderedProjects.splice(fromIndex, 1);
    const targetIndex = orderedProjects.findIndex((item) => item.id === targetProject.id);
    orderedProjects.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, moved);
    reorderTodoProjectsInView(project.id, targetProject.id, position);
    clearTodoDragState();
    await Promise.all(
      orderedProjects.map((item, index) =>
        fetch(`/api/todo-projects/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: index + 1 })
        })
      )
    );
    await refreshDataWithTransition();
  }

  async function moveTodoTaskRelative(task: TaskListItem, targetTask: TaskListItem, targetProjectId: string, position: 'before' | 'after') {
    if (task.id === targetTask.id) return;
    const nextProjectId = targetProjectId === 'uncategorized' ? 'uncategorized' : targetProjectId;
    const siblingTasks = visibleTodoTasks
      .filter((item) => item.id !== task.id && (item.projectId || 'uncategorized') === nextProjectId && item.status !== 'cancelled')
      .sort(compareTodoTasks);
    const targetIndex = Math.max(0, siblingTasks.findIndex((item) => item.id === targetTask.id));
    siblingTasks.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, { ...task, projectId: nextProjectId });
    reorderTodoTasksInView(task.id, targetTask.id, nextProjectId, position);
    clearTodoDragState();
    await Promise.all(
      siblingTasks.map((item, index) =>
        fetch(`/api/tasks/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: item.id === task.id ? (nextProjectId === 'uncategorized' ? null : nextProjectId) : undefined,
            order: index + 1
          })
        })
      )
    );
    await refreshDataWithTransition();
  }

  async function generateSummary(kind: 'daily' | 'weekly') {
    const response = await fetch('/api/summaries/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind })
    });
    if (response.ok) {
      const result = (await response.json()) as { file: string; title: string };
      setSummaryMessage(`已生成：${result.title} | ${result.file}`);
      setMessage('Markdown 总结已经写回本地。');
    } else {
      setSummaryMessage('总结生成失败，稍后再试。');
    }
  }

  function updateSettingsDraft(patch: Partial<SettingsDraft>) {
    setSettingsMessage('');
    setSettingsDirty(true);
    setSettingsDraft((draft) => ({ ...draft, ...patch }));
  }

  async function saveSettingsDraft() {
    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ui: {
          dayStartHour: 0,
          dayEndHour: 24
        },
        habits: {
          wakeUp: settingsDraft.wakeUp,
          sleepStart: settingsDraft.sleepStart,
          restDayMode: settingsDraft.restDayMode,
          showLegalHolidays: settingsDraft.showLegalHolidays
        },
        ai: {
          provider: settingsDraft.aiProvider,
          enabled: settingsDraft.aiEnabled,
          baseUrl: settingsDraft.aiBaseUrl.trim(),
          model: settingsDraft.aiModel.trim(),
          apiKey: settingsDraft.aiApiKey.trim()
        }
      })
    });
    if (response.ok) {
      setSettingsDirty(false);
      setSettingsMessage('设置已经保存。');
      await refreshData();
    } else {
      setSettingsMessage('设置没有保存成功，稍后再试一次。');
    }
  }

  function startManualEventDraft(date: string) {
    const startHour = Math.max(0, Math.min(23, scheduleRange.startHour));
    setManualEventDraft({
      title: '',
      date,
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String(Math.min(23, startHour + 1)).padStart(2, '0')}:00`,
      type: 'other',
      notes: '',
      preparationsText: ''
    });
  }

  async function saveManualEventDraft() {
    if (!manualEventDraft) return;
    const title = manualEventDraft.title.trim() || '新日程';
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        date: manualEventDraft.date,
        startAt: manualEventDraft.startTime,
        endAt: manualEventDraft.endTime,
        type: manualEventDraft.type,
        notes: manualEventDraft.notes,
        preparations: splitListText(manualEventDraft.preparationsText)
      })
    });
    if (response.ok) {
      setMessage('日程已经加好了。');
      const date = manualEventDraft.date;
      const startAt = `${manualEventDraft.date}T${manualEventDraft.startTime}:00+08:00`;
      setManualEventDraft(null);
      setSelectedDate(date);
      await refreshData();
      scrollScheduleToTime(date, startAt);
    } else {
      setMessage('这条日程没有保存成功，稍后再试。');
    }
  }

  function startCatDrag(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    function moveCat(moveEvent: MouseEvent) {
      if (!moved && Math.abs(moveEvent.clientX - startX) <= 6 && Math.abs(moveEvent.clientY - startY) <= 6) return;
      moved = true;
      setCatPosition({
        left: Math.min(window.innerWidth - rect.width, Math.max(12, moveEvent.clientX - offsetX)),
        top: Math.min(window.innerHeight - rect.height, Math.max(12, moveEvent.clientY - offsetY))
      });
    }

    function stopDrag() {
      window.removeEventListener('mousemove', moveCat);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('blur', stopDrag);
      if (!moved) startVoiceInput();
    }

    window.addEventListener('mousemove', moveCat);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('blur', stopDrag);
  }

  function startEventAdjust(
    event: ReactMouseEvent<HTMLElement>,
    item: CalendarItem,
    date: string,
    mode: 'move' | 'resize-start' | 'resize-end'
  ) {
    if (!item.startAt || !item.endAt) return;
    event.preventDefault();
    event.stopPropagation();

    const schedule = event.currentTarget.closest('.schedule-inner') as HTMLElement | null;
    if (!schedule) return;
    const rect = schedule.getBoundingClientRect();
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    const originalStart = getMinutesFromDayStart(start, scheduleRange);
    const originalEnd = getMinutesFromDayStart(end, scheduleRange);
    const duration = Math.max(30, originalEnd - originalStart);
    const pointerStartMinute = minuteFromClientY(event.clientY, rect, scheduleRange);
    let moved = false;

    async function saveAdjusted(nextStartMinute: number, nextEndMinute: number) {
      const startAt = makeLocalDateTime(date, nextStartMinute, scheduleRange);
      const endAt = makeLocalDateTime(date, nextEndMinute, scheduleRange);
      const response = await fetch(`/api/events/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, startAt, endAt })
      });
      if (response.ok) {
        setMessage('时间已经按半小时刻度调整好了。');
        await refreshData();
        setDragPreview(null);
      } else {
        setDragPreview(null);
        setMessage('时间调整没有保存成功，等下再试一次。');
      }
    }

    function moveEvent(moveEvent: MouseEvent) {
      moved = true;
      const currentMinute = minuteFromClientY(moveEvent.clientY, rect, scheduleRange);
      const delta = snapToHalfHour(currentMinute - pointerStartMinute);
      let nextStart = originalStart;
      let nextEnd = originalEnd;
      if (mode === 'move') {
        nextStart = clampMinute(snapToHalfHour(originalStart + delta), scheduleRange);
        nextEnd = nextStart + duration;
        if (nextEnd > scheduleRange.dayMinutes) {
          nextEnd = scheduleRange.dayMinutes;
          nextStart = Math.max(0, nextEnd - duration);
        }
      }
      if (mode === 'resize-start') {
        nextStart = clampMinute(Math.min(originalEnd - 30, snapToHalfHour(currentMinute)), scheduleRange);
      }
      if (mode === 'resize-end') {
        nextEnd = clampMinute(Math.max(originalStart + 30, snapToHalfHour(currentMinute)), scheduleRange);
      }
      const previewStart = makeLocalDateTime(date, nextStart, scheduleRange);
      const previewEnd = makeLocalDateTime(date, nextEnd, scheduleRange);
      setDragPreview({ id: item.id, startAt: previewStart, endAt: previewEnd });
      setSelectedDetail((current) =>
        current?.id === item.id ? { ...current, startAt: previewStart, endAt: previewEnd, date, kind: 'event' } : current
      );
    }

    function stopDrag(stopEvent: MouseEvent) {
      window.removeEventListener('mousemove', moveEvent);
      window.removeEventListener('mouseup', stopDrag);
      if (!moved) {
        setDragPreview(null);
        return;
      }
      const currentMinute = minuteFromClientY(stopEvent.clientY, rect, scheduleRange);
      const delta = snapToHalfHour(currentMinute - pointerStartMinute);
      let nextStart = originalStart;
      let nextEnd = originalEnd;
      if (mode === 'move') {
        nextStart = clampMinute(snapToHalfHour(originalStart + delta), scheduleRange);
        nextEnd = nextStart + duration;
        if (nextEnd > scheduleRange.dayMinutes) {
          nextEnd = scheduleRange.dayMinutes;
          nextStart = Math.max(0, nextEnd - duration);
        }
      } else if (mode === 'resize-start') {
        nextStart = clampMinute(Math.min(originalEnd - 30, snapToHalfHour(currentMinute)), scheduleRange);
      } else {
        nextEnd = clampMinute(Math.max(originalStart + 30, snapToHalfHour(currentMinute)), scheduleRange);
      }
      void saveAdjusted(nextStart, nextEnd);
    }

    window.addEventListener('mousemove', moveEvent);
    window.addEventListener('mouseup', stopDrag);
  }

  function startPanelResize(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPanelWidth;

    function movePanel(moveEvent: MouseEvent) {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      setRightPanelWidth(Math.min(460, Math.max(240, nextWidth)));
    }

    function stopPanelResize() {
      window.removeEventListener('mousemove', movePanel);
      window.removeEventListener('mouseup', stopPanelResize);
    }

    window.addEventListener('mousemove', movePanel);
    window.addEventListener('mouseup', stopPanelResize);
  }

  function updateDetailDatePart(field: 'date' | 'dueDate', part: 'month' | 'day', value: string) {
    const numeric = value.replace(/\D/g, '').slice(0, 2);
    const nextNumber = Number(numeric);
    if (!numeric || Number.isNaN(nextNumber)) return;
    setDetailDraft((draft) => {
      if (!draft) return draft;
      const [yearText, monthText, dayText] = draft[field].split('-');
      const currentYear = Number(yearText) || new Date().getFullYear();
      const currentMonth = Number(monthText) || 1;
      const currentDay = Number(dayText) || 1;
      const nextMonth = part === 'month' ? Math.min(12, Math.max(1, nextNumber)) : currentMonth;
      const maxDay = new Date(currentYear, nextMonth, 0).getDate();
      const nextDay = part === 'day' ? Math.min(maxDay, Math.max(1, nextNumber)) : Math.min(currentDay, maxDay);
      return { ...draft, [field]: `${currentYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}` };
    });
  }

  function renderInlineDetailEditor(item: DetailTarget) {
    if (!detailDraft || selectedDetail?.id !== item.id || selectedDetail.kind !== item.kind) return null;
    const contentRows = getTextEditorRows(detailDraft.purpose, 20);
    const titleRows = getTextEditorRows(detailDraft.title, 18);
    const preparationRows = getTextEditorRows(detailDraft.preparationsText, 20);
    const noteRows = getTextEditorRows(detailDraft.notes, 20);

    return (
      <div
        className="detail-editor inline-detail-editor"
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
          void saveItemDraft();
        }}
      >
        <label>
          标题
          <input value={detailDraft.title} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, title: event.target.value })} />
        </label>
        {item.kind === 'event' ? (
          <>
            <div className="detail-date-time-row">
              <label>
                月
                <input inputMode="numeric" value={getDatePart(detailDraft.date, 'month')} onChange={(event) => updateDetailDatePart('date', 'month', event.target.value)} />
              </label>
              <label>
                日
                <input inputMode="numeric" value={getDatePart(detailDraft.date, 'day')} onChange={(event) => updateDetailDatePart('date', 'day', event.target.value)} />
              </label>
              <label>
                开始
                <input type="time" step="1800" value={detailDraft.startTime} onClick={(event) => showTimePicker(event.currentTarget)} onFocus={(event) => showTimePicker(event.currentTarget)} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, startTime: event.target.value })} />
              </label>
              <label>
                结束
                <input type="time" step="1800" value={detailDraft.endTime} onClick={(event) => showTimePicker(event.currentTarget)} onFocus={(event) => showTimePicker(event.currentTarget)} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, endTime: event.target.value })} />
              </label>
            </div>
            <label>
              具体安排
              <textarea rows={contentRows} value={detailDraft.purpose} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, purpose: event.target.value })} />
            </label>
          </>
        ) : (
          <>
            <div className="detail-date-time-row">
              <label>
                月
                <input inputMode="numeric" value={getDatePart(detailDraft.dueDate, 'month')} onChange={(event) => updateDetailDatePart('dueDate', 'month', event.target.value)} />
              </label>
              <label>
                日
                <input inputMode="numeric" value={getDatePart(detailDraft.dueDate, 'day')} onChange={(event) => updateDetailDatePart('dueDate', 'day', event.target.value)} />
              </label>
              <label>
                截止时间
                <input type="time" step="1800" value={detailDraft.dueTime} onClick={(event) => showTimePicker(event.currentTarget)} onFocus={(event) => showTimePicker(event.currentTarget)} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, dueTime: event.target.value })} />
              </label>
            </div>
            <label>
              内容
              <textarea className="detail-task-title-editor" rows={titleRows} value={detailDraft.title} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, title: event.target.value })} />
            </label>
          </>
        )}
        {item.kind === 'event' ? (
          <>
            <label>
              准备事项
              <textarea rows={preparationRows} value={detailDraft.preparationsText} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, preparationsText: event.target.value })} />
            </label>
            <label>
              备注
              <textarea rows={noteRows} value={detailDraft.notes} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, notes: event.target.value })} />
            </label>
          </>
        ) : null}
      </div>
    );
  }

  const hasActiveCatContent = Boolean(
    message ||
    pendingClarification ||
    pendingDecision ||
    pendingPostCommit ||
    pendingModification ||
    parsePreview ||
    input ||
    voiceDisplayText ||
    catProcessStatus ||
    isListening ||
    isThinking
  );
  const shouldShowCatDialog = hasActiveCatContent && !isDesktopShell;

  if (authRequired && !authSession) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-brand">
            <span>Yaya</span>
            <span>Mind</span>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            <p className="eyebrow">{authMode === 'login' ? '登录账号' : '创建账号'}</p>
            <h1>{authMode === 'login' ? '打开你的个人助手' : '第一次使用 YayaMind'}</h1>
            <label>
              邮箱
              <input type="email" value={authEmail} autoComplete="email" onChange={(event) => setAuthEmail(event.target.value)} required />
            </label>
            <label>
              密码
              <input type="password" value={authPassword} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={6} onChange={(event) => setAuthPassword(event.target.value)} required />
            </label>
            {authMessage ? <p className="auth-message">{authMessage}</p> : null}
            <button className="auth-submit" type="submit" disabled={isAuthSubmitting}>
              {isAuthSubmitting ? '处理中' : authMode === 'login' ? '登录' : '注册并进入'}
            </button>
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setAuthMode((mode) => (mode === 'login' ? 'signup' : 'login'));
                setAuthMessage('');
              }}
            >
              {authMode === 'login' ? '第一次用，创建账号' : '已有账号，返回登录'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`app-shell ${draggedTodoTaskId || draggedTodoProjectId ? 'todo-dragging' : ''}`}
      style={{ gridTemplateColumns: `76px minmax(260px, 1fr) 8px minmax(240px, ${rightPanelWidth}px)` }}
      onMouseDown={(event) => {
        if (!activeNewTaskProjectId) return;
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('.todo-task-form, .todo-add-task-button')) return;
        window.setTimeout(() => {
          void finishNewTodoTaskDraft(activeNewTaskProjectId);
        }, 0);
      }}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-text"><span>Yaya</span><span>Mind</span></span>
        </div>
        <div className="nav-main">
          {[
            ['□', '一周', 'week'],
            ['✓', '待办', 'todos'],
            ['✦', '习惯', 'goals'],
            ['♡', '画像', 'profile'],
            ['↺', '总结', 'summary']
          ].map(([icon, item, mode]) => (
            <button className={`nav-item ${viewMode === mode ? 'nav-active' : ''}`} key={item} title={item} onClick={() => setViewMode(mode as ViewMode)}>
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{item}</span>
            </button>
          ))}
        </div>
        <div className="nav-bottom">
          <button className={`nav-item ${viewMode === 'settings' ? 'nav-active' : ''}`} title="设置" onClick={() => setViewMode('settings')}>
            <span className="nav-icon">⚙</span>
            <span className="nav-label">设置</span>
          </button>
          {authSession ? (
            <button className="nav-item logout-button" title="退出账号" onClick={logout}>
              <span className="nav-icon">↩</span>
              <span className="nav-label">退出</span>
            </button>
          ) : null}
        </div>
      </aside>

      <section className="calendar-panel">
        {viewMode === 'week' ? (
          <>
            <header className="panel-header calendar-toolbar">
              <p className="eyebrow">一周日程</p>
              <div className="calendar-actions">
                <button onClick={() => {
                  if (calendarFocusMode === 'future') {
                    setCalendarFocusMode('week');
                    setSelectedDate(toLocalDateText(new Date()));
                  } else {
                    setCalendarFocusMode('future');
                  }
                }}>
                  {calendarFocusMode === 'future' ? '回到今天' : `未来 ${futurePlanCount}`}
                  <span>›</span>
                </button>
              </div>
            </header>

            <div className={`calendar-grid ${calendarFocusMode === 'future' ? 'calendar-grid-future' : ''}`} style={{ gridTemplateColumns: `repeat(${calendarFocusMode === 'future' ? 7 : Math.max(1, visibleCalendarDays.length)}, minmax(0, 1fr))` }}>
          {visibleCalendarDays.length ? visibleCalendarDays.map((day) => (
            <article data-date={day.date} className={`day-column ${getDayStateClass(day.date, now)} ${getRestDayClass(day.date, data.settings ?? defaultSettings)} ${day.date === selectedDate ? 'day-selected' : ''}`} key={day.date} onClick={() => selectCalendarDate(day.date)}>
              <h2>
                <span>{getWeekdayText(day.label)}</span>
                <small>{getDateText(day.label)}</small>
              </h2>
              <div className="day-schedule">
                <div className="schedule-inner">
                <div className="time-guide">
                  {getMinorTimeMarks(scheduleRange).map((minutes) => (
                    <i key={minutes} style={getMinuteMarkStyle(minutes, scheduleRange)} />
                  ))}
                  {getHourMarks(scheduleRange).map((hour) => (
                    <span key={hour} style={getHourMarkStyle(hour, scheduleRange)}>{formatScheduleHour(hour)}</span>
                  ))}
                </div>
                {scheduleRange.sleepBlocks.map((block) => (
                  <div className="sleep-block" key={`${day.date}-${block.start}-${block.end}`} style={getSleepBlockStyle(block, scheduleRange)}>
                    <span>休息</span>
                  </div>
                ))}
                {isToday(day.date, now) ? (
                  <>
                    <div className="past-shade" style={getPastShadeStyle(now, scheduleRange)} />
                    <div className="now-line" style={getNowLineStyle(now, scheduleRange)} />
                  </>
                ) : null}
                {day.items.length > 0 ? (
                  day.items.map((item) => (
                    <button
                      data-event-id={item.id}
                      className={`event-card event-${item.type} ${item.isDraft ? 'event-draft' : ''} ${Number(item.laneCount ?? 1) > 1 ? 'event-compact' : ''} ${item.conflict ? 'event-conflict' : ''}`}
                      key={item.id}
                      draggable={false}
                      style={getEventStyle(dragPreview?.id === item.id ? dragPreview.startAt : item.startAt, dragPreview?.id === item.id ? dragPreview.endAt : item.endAt, item.lane, item.laneCount, scheduleRange)}
                      onMouseDown={(event) => startEventAdjust(event, item, day.date, 'move')}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectCalendarDate(day.date);
                      }}
                    >
                      <span
                        className="resize-handle resize-start"
                        onMouseDown={(event) => startEventAdjust(event, item, day.date, 'resize-start')}
                      />
                      <strong>{getShortTitle(item.title)}</strong>
                      {item.isDraft ? <i>草稿</i> : null}
                      {item.conflict ? <i>冲突</i> : null}
                      <span
                        className="resize-handle resize-end"
                        onMouseDown={(event) => startEventAdjust(event, item, day.date, 'resize-end')}
                      />
                    </button>
                  ))
                ) : null}
                </div>
              </div>
            </article>
          )) : (
            <div className="empty-future">
              <strong>还没有本周以后的安排</strong>
              <span>说一句“下周四下午三点开会”，这里就会出现。</span>
            </div>
          )}
            </div>
          </>
        ) : null}

        {viewMode === 'todos' ? (
          <section className="workspace-view todo-view">
            <header className="panel-header todo-toolbar">
              <p className="eyebrow">项目待办</p>
              <div className="todo-toolbar-actions">
                <button className="todo-add-project" onClick={createBlankTodoProject}>
                  <span>＋</span>
                  新增项目
                </button>
              </div>
            </header>
            <div className="project-todo-list">
              {visibleProjectTodoGroups.length ? (
                visibleProjectTodoGroups.map((group) => (
                  <section
                    className={`project-todo-group ${todoDragReady?.kind === 'project' && todoDragReady.id === group.projectId ? 'todo-selected' : ''} ${todoContextMenu?.kind === 'project' && todoContextMenu.project.id === group.projectId ? 'todo-context-selected' : ''} ${draggedTodoProjectId === group.projectId ? 'todo-drag-source' : ''} ${todoDropPreview?.kind === 'project' && todoDropPreview.targetId === group.projectId ? `todo-drop-preview todo-drop-${todoDropPreview.position}` : ''} ${todoDropPreview?.kind === 'project-end' && todoDropPreview.targetId === group.projectId ? 'todo-project-end-preview' : ''}`}
                    data-project-id={group.projectId}
                    key={group.projectId}
                    draggable={!isUncategorizedTodoProject(group.project)}
                    style={{ '--project-color': group.color } as CSSProperties}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (event.target instanceof HTMLElement && event.target.closest('.project-todo-item, .todo-task-form, .todo-empty-start, button, input, textarea, select')) return;
                      openTodoProjectContextMenu(event, group.project);
                    }}
                    onMouseDown={(event) => {
                      if (event.target instanceof HTMLElement && event.target.closest('.project-todo-item, .todo-task-form, .todo-empty-start')) return;
                      armTodoDrag(event, 'project', group.projectId);
                    }}
                    onMouseUp={disarmTodoDragIfIdle}
                    onDragStart={(event) => startTodoProjectDrag(event, group.project)}
                    onDragEnd={clearTodoDragState}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      if (draggedTodoTaskId) {
                        setTodoDropPreview({ kind: 'project-end', targetId: group.projectId });
                      } else if (draggedTodoProjectId && group.projectId !== draggedTodoProjectId) {
                        setTodoDropPreview({ kind: 'project', targetId: group.projectId, position: getDropPosition(event) });
                      }
                    }}
                    onDragLeave={(event) => {
                      const nextTarget = event.relatedTarget;
                      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                      setTodoDropPreview((current) => (current?.targetId === group.projectId ? null : current));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setTodoDropPreview(null);
                      const project = getDraggedTodoProject(event);
                      if (project) {
                        void moveTodoProjectRelative(project, group.project, getDropPosition(event));
                        return;
                      }
                      const task = getDraggedTodoTask(event);
                      if (task) void moveTodoTaskToProject(task, group.projectId);
                    }}
                  >
                    <div className="project-todo-head">
                      {editingProjectId === group.projectId ? (
                        <input
                          value={projectTitleDraft}
                          onChange={(event) => setProjectTitleDraft(event.target.value)}
                          autoFocus
                          onBlur={() => {
                            void saveTodoProjectTitle(group.projectId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void saveTodoProjectTitle(group.projectId, { focusNewTask: true });
                          }}
                        />
                      ) : (
                        <strong onDoubleClick={() => startEditTodoProject(group.project)}>{group.projectTitle}</strong>
                      )}
                      <button className="todo-add-task-button" type="button" title="新增待办" aria-label={`给${group.projectTitle}新增待办`} onClick={() => startNewTodoTask(group.projectId)}>
                        ＋
                      </button>
                      <span>{group.openCount} / {group.tasks.length}</span>
                    </div>
                    {activeNewTaskProjectId === group.projectId ? (
                    <div
                      className="todo-task-form"
                      onBlur={(event) => {
                        const nextTarget = event.relatedTarget;
                        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                        void finishNewTodoTaskDraft(group.projectId);
                      }}
                    >
                      <input
                        data-new-task-project={group.projectId}
                        value={newTaskDraftByProject[group.projectId]?.title ?? ''}
                        onChange={(event) => updateNewTodoTaskDraft(group.projectId, { title: event.target.value })}
                        placeholder=""
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void createTodoTaskFromProject(group.projectId);
                        }}
                      />
                      <input
                        value={newTaskDraftByProject[group.projectId]?.notes ?? ''}
                        onChange={(event) => updateNewTodoTaskDraft(group.projectId, { notes: event.target.value })}
                        placeholder=""
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void createTodoTaskFromProject(group.projectId);
                        }}
                      />
                    </div>
                    ) : null}
                    <div className="project-todo-items">
                      {group.tasks.length === 0 && activeNewTaskProjectId !== group.projectId ? (
                        <button className="todo-empty-start" onClick={() => startNewTodoTask(group.projectId)}>
                          写第一条待办
                        </button>
                      ) : null}
                      {group.tasks.map((task) => {
                        const isDone = task.status === 'done';
                        return (
                          <article
                            data-task-id={task.id}
                            className={`project-todo-item ${isDone ? 'todo-done' : ''} ${todoDragReady?.kind === 'task' && todoDragReady.id === task.id ? 'todo-selected' : ''} ${todoContextMenu?.kind === 'task' && todoContextMenu.task.id === task.id ? 'todo-context-selected' : ''} ${draggedTodoTaskId === task.id ? 'todo-drag-source' : ''} ${todoDropPreview?.kind === 'task' && todoDropPreview.targetId === task.id ? `todo-task-drop-preview todo-drop-${todoDropPreview.position}` : ''}`}
                            key={task.id}
                            draggable
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              armTodoDrag(event, 'task', task.id);
                            }}
                            onMouseUp={disarmTodoDragIfIdle}
                            onContextMenu={(event) => {
                              openTodoTaskContextMenu(event, task);
                            }}
                            onDragStart={(event) => startTodoDrag(event, task)}
                            onDragEnd={clearTodoDragState}
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              event.dataTransfer.dropEffect = 'move';
                              if (draggedTodoTaskId && draggedTodoTaskId !== task.id) {
                                const draggedTask = data.tasks.find((item) => item.id === draggedTodoTaskId);
                                if (draggedTask && (draggedTask.projectId || 'uncategorized') === group.projectId) {
                                  setTodoDropPreview({ kind: 'task', targetId: task.id, position: getDropPosition(event) });
                                } else {
                                  setTodoDropPreview({ kind: 'project-end', targetId: group.projectId });
                                }
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setTodoDropPreview(null);
                              const draggedTask = getDraggedTodoTask(event);
                              if (draggedTask) {
                                if ((draggedTask.projectId || 'uncategorized') !== group.projectId) {
                                  void moveTodoTaskToProject(draggedTask, group.projectId);
                                } else {
                                  void moveTodoTaskRelative(draggedTask, task, group.projectId, getDropPosition(event));
                                }
                              }
                            }}
                            style={{ viewTransitionName: `todo-${task.id}`, '--project-color': getProjectColor(task.projectId) } as CSSProperties}
                          >
                            <button
                              className="todo-check"
                              aria-label={isDone ? '恢复待办' : '完成待办'}
                              type="button"
                              draggable={false}
                              onMouseDown={(event) => event.stopPropagation()}
                              onDragStart={(event) => event.preventDefault()}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void updateTodoTaskStatus(task, isDone ? 'todo' : 'done');
                              }}
                            >
                              {isDone ? '✓' : ''}
                            </button>
                            <div className="todo-copy">
                              {editingTodoTaskId === task.id && editingTodoField === 'title' ? (
                                <textarea
                                  className="todo-title-editor"
                                  rows={getTextEditorRows(todoTaskDraft.title, 12)}
                                  value={todoTaskDraft.title}
                                  onChange={(event) => setTodoTaskDraft((draft) => ({ ...draft, title: event.target.value }))}
                                  autoFocus
                                  onBlur={() => {
                                    void saveTodoTaskDraft(task.id);
                                  }}
                                />
                              ) : (
                                <span className="todo-content-text" onDoubleClick={() => startEditTodoTask(task, 'title')}>{task.title}</span>
                              )}
                            </div>
                            <div className="todo-inline-actions todo-row-actions todo-side-meta">
                              {getTodoDateTag(task) ? (
                                <button
                                  className="todo-date-tag"
                                  style={getTodoDateTagStyle(task)}
                                  title="移除截止时间"
                                  type="button"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void clearTodoDeadline(task);
                                  }}
                                >
                                  <span>{getTodoDateTag(task)}</span>
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                      {todoDropPreview?.kind === 'project-end' && todoDropPreview.targetId === group.projectId && draggedTodoTaskId ? (
                        <div className="todo-drop-slot">松开后移到这个项目末尾</div>
                      ) : null}
                    </div>
                  </section>
                ))
              ) : (
                <p className="muted">还没有待办任务。说一句“我要写完产品方案”，这里就会出现。</p>
              )}
            </div>
          </section>
        ) : null}

        {viewMode === 'goals' ? (
          <section className="workspace-view">
            <header className="panel-header">
              <div>
                <p className="eyebrow">阶段性目标</p>
                <h1>目标和里程碑</h1>
              </div>
            </header>
            <div className="goal-form">
              <input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="新增一个阶段性目标" />
              <input value={goalTargetDate} onChange={(event) => setGoalTargetDate(event.target.value)} type="date" />
              <button onClick={createGoalFromForm}>添加目标</button>
            </div>
            <div className="workspace-list">
              {data.goals.length ? (
                data.goals.map((goal) => (
                  <article className="workspace-card" key={goal.id}>
                    <strong>{goal.title}</strong>
                    <span>{goal.targetDate ? `目标日期：${goal.targetDate}` : '未设置目标日期'}</span>
                    <small>{getGoalStatusLabel(goal.status)}</small>
                    <div className="card-actions">
                      <button onClick={() => updateGoal(goal.id, 'done')}>瀹屾垚</button>
                      <button onClick={() => updateGoal(goal.id, goal.status === 'paused' ? 'active' : 'paused')}>{goal.status === 'paused' ? '恢复' : '暂停'}</button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">还没有阶段性目标。先加一个最重要的方向。</p>
              )}
            </div>
          </section>
        ) : null}

        {viewMode === 'profile' ? (
          <section className="workspace-view">
            <header className="panel-header">
              <div>
                <h1>个人画像</h1>
              </div>
            </header>
            <div className="profile-grid">
              <section className="profile-block profile-preferences">
                <strong>日程显示和休息日</strong>
                <div className="preference-grid">
                  <label>
                    起床
                    <input type="time" value={settingsDraft.wakeUp} onClick={(event) => showTimePicker(event.currentTarget)} onFocus={(event) => showTimePicker(event.currentTarget)} onChange={(event) => updateSettingsDraft({ wakeUp: event.target.value })} />
                  </label>
                  <label>
                    睡觉
                    <input type="time" value={settingsDraft.sleepStart} onClick={(event) => showTimePicker(event.currentTarget)} onFocus={(event) => showTimePicker(event.currentTarget)} onChange={(event) => updateSettingsDraft({ sleepStart: event.target.value })} />
                  </label>
                  <label>
                    休息
                    <select value={settingsDraft.restDayMode} onChange={(event) => updateSettingsDraft({ restDayMode: event.target.value as SettingsDraft['restDayMode'] })}>
                      <option value="weekend">双休</option>
                      <option value="single_sunday">单休周日</option>
                      <option value="single_saturday">单休周六</option>
                      <option value="alternate_weekends">大小周</option>
                    </select>
                  </label>
                  <label className="preference-toggle">
                    <input type="checkbox" checked={settingsDraft.showLegalHolidays} onChange={(event) => updateSettingsDraft({ showLegalHolidays: event.target.checked })} />
                    显示法定节假日
                  </label>
                  {settingsDirty ? <button className="preference-save" onClick={saveSettingsDraft}>保存习惯</button> : null}
                </div>
                <div className="preference-footer">
                  <small>{settingsMessage || getScheduleRangeText(data.settings ?? defaultSettings)}</small>
                </div>
              </section>
              <ProfileBlock title="时间习惯" items={[...data.profile.timeHabits.highFocusWindows, ...data.profile.timeHabits.commonDelayWindows]} empty="还在观察你的高效和拖延时段。" />
              <ProfileBlock title="估时模式" items={[...data.profile.estimationPatterns.bufferRules, ...data.profile.estimationPatterns.oftenUnderestimatedTags]} empty="还没有稳定的估时模式。" />
              <ProfileBlock title="生活节奏" items={[...data.profile.lifeRhythm.regularMeals, ...data.profile.lifeRhythm.exercisePreferences, ...data.profile.lifeRhythm.restPatterns]} empty="还没有生活节奏记录。" />
              <ProfileBlock title="近期信号" items={data.profile.signals} empty="继续记录执行过程后，这里会逐渐丰富。" />
            </div>
          </section>
        ) : null}

        {viewMode === 'summary' ? (
          <section className="workspace-view">
            <header className="panel-header">
              <div>
                <p className="eyebrow">总结</p>
                <h1>Markdown 输出</h1>
              </div>
            </header>
            <div className="summary-actions">
              <button onClick={() => generateSummary('daily')}>生成今日总结</button>
              <button onClick={() => generateSummary('weekly')}>生成本周总结</button>
            </div>
            <p className="summary-message">{summaryMessage || '总结会写入 personal-assistant-data/summaries，方便放回 Obsidian 阅读。'}</p>
          </section>
        ) : null}

        {viewMode === 'settings' ? (
          <section className="workspace-view">
            <header className="panel-header">
              <div>
                <p className="eyebrow">设置</p>
                <h1>AI 接口</h1>
              </div>
            </header>
            <div className="settings-grid">
              <section className="workspace-card settings-card">
                <strong>模型接口</strong>
                <div className="settings-form">
                  <label className="preference-toggle">
                    <input type="checkbox" checked={settingsDraft.aiEnabled} onChange={(event) => updateSettingsDraft({ aiEnabled: event.target.checked })} />
                    启用 AI 理解
                  </label>
                  <label>
                    服务类型
                    <select value={settingsDraft.aiProvider} onChange={(event) => updateSettingsDraft({ aiProvider: event.target.value as SettingsDraft['aiProvider'] })}>
                      <option value="deepseek">DeepSeek</option>
                      <option value="openai-compatible">OpenAI 兼容接口</option>
                    </select>
                  </label>
                  <label>
                    API 地址
                    <input value={settingsDraft.aiBaseUrl} onChange={(event) => updateSettingsDraft({ aiBaseUrl: event.target.value })} placeholder="https://api.deepseek.com" />
                  </label>
                  <label>
                    模型
                    <input value={settingsDraft.aiModel} onChange={(event) => updateSettingsDraft({ aiModel: event.target.value })} placeholder="deepseek-chat" />
                  </label>
                  <label>
                    API Key
                    <input type="password" value={settingsDraft.aiApiKey} onChange={(event) => updateSettingsDraft({ aiApiKey: event.target.value })} placeholder="sk-..." autoComplete="off" />
                  </label>
                  {settingsDirty ? <button className="preference-save" onClick={saveSettingsDraft}>保存设置</button> : null}
                </div>
                <small>{settingsMessage || '本地桌面版会优先使用这里保存的接口；没有填写时继续读取环境变量。'}</small>
              </section>
            </div>
          </section>
        ) : null}
      </section>

      <div className="panel-resizer" onMouseDown={startPanelResize} title="拖动调整右侧宽度" />
      <aside className={`today-panel ${viewMode === 'todos' ? 'todo-side-panel' : 'week-detail-panel'}`}>
        {viewMode === 'todos' ? (
          <section className="todo-month-panel">
            <p className="eyebrow">{now.getFullYear()} 年 {now.getMonth() + 1} 月</p>
            <div className="todo-month-weekdays">
              {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="todo-month-grid">
              {monthCalendarDays.map((day) => (
                <button
                  className={`todo-month-day ${day.inMonth ? '' : 'todo-month-muted'} ${todoDeadlineDates.has(day.date) ? 'todo-month-deadline' : ''} ${todoDropPreview?.kind === 'date' && todoDropPreview.targetId === day.date ? 'todo-date-drop-preview' : ''}`}
                  data-todo-date={day.date}
                  key={day.date}
                  onClick={() => selectCalendarDate(day.date)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const task = getDraggedTodoTask(event);
                    if (task) void assignTodoDeadline(task, day.date);
                  }}
                >
                  <span>{day.day}</span>
                  {todoDeadlineDots.get(day.date)?.length ? (
                    <i className="todo-month-dots">
                      {todoDeadlineDots.get(day.date)!.slice(0, 8).map((color, index) => (
                        <b key={`${color}_${index}`} style={{ backgroundColor: color }} />
                      ))}
                    </i>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
        <section>
          <div className="detail-title-row">
            <h2>{selectedDay ? formatSelectedDayTitle(selectedDay.date, selectedDay.label) : '选择一天'}</h2>
            {selectedDay ? (
              <button className="icon-add-button" type="button" title="新增日程" aria-label="新增日程" onClick={() => startManualEventDraft(selectedDay.date)}>
                ＋
              </button>
            ) : null}
          </div>
        </section>

        <div className="today-detail-split">
          <section className="today-detail-zone today-schedule-zone">
            <p className="eyebrow">日程</p>
            <div className="today-zone-scroll">
              {manualEventDraft ? (
                <ManualEventEditor
                  draft={manualEventDraft}
                  onChange={setManualEventDraft}
                  onSave={saveManualEventDraft}
                  onCancel={() => setManualEventDraft(null)}
                />
              ) : null}
              {selectedDay?.items.length ? (
                selectedDay.items
                  .slice()
                  .sort((a, b) => (a.startAt ?? a.dueAt ?? '').localeCompare(b.startAt ?? b.dueAt ?? ''))
                  .map((item) => (
                    <article
                      className={`detail-row ${item.isDraft ? 'detail-row-draft' : ''} ${detailDraft && selectedDetail?.id === item.id && selectedDetail.kind === 'event' ? 'detail-row-editing' : ''} ${detailContextMenu?.item.id === item.id && detailContextMenu.item.kind === 'event' ? 'detail-context-selected' : ''} ${item.conflict ? 'detail-row-conflict' : ''}`}
                      key={item.id}
                      onClick={(event) => openDetailFromRow(event, { ...item, kind: 'event' })}
                      onDoubleClick={(event) => editDetailFromRow(event, { ...item, kind: 'event' })}
                      onContextMenu={(event) => openDetailContextMenu(event, { ...item, kind: 'event' })}
                    >
                      <div className="detail-row-head">
                        <div>
                          <strong>{formatItemTime(item)}</strong>
                          <span>{item.isDraft ? '草稿标题：' : '标题：'}{item.title}</span>
                          {getCompactItemMeta(item) ? <small>{getCompactItemMeta(item)}</small> : null}
                        </div>
                      </div>
                      {renderDetailExtras(item)}
                      {renderInlineDetailEditor({ ...item, kind: 'event' })}
                    </article>
                  ))
              ) : (
                <p className="muted">这天暂时没有明确时间块。</p>
              )}
              {selectedDay && [...selectedDay.pendingItems, ...selectedDay.tasks.filter(needsTaskClarification)].length ? (
                <div className="today-subsection">
                  <p className="eyebrow">待补充事项</p>
                  {[...selectedDay.pendingItems, ...selectedDay.tasks.filter(needsTaskClarification)]
                    .slice()
                    .map((item) => (
                      <article
                        className={`detail-row detail-row-pending ${item.isDraft ? 'detail-row-draft' : ''} ${detailDraft && selectedDetail?.id === item.id ? 'detail-row-editing' : ''} ${detailContextMenu?.item.id === item.id ? 'detail-context-selected' : ''}`}
                        key={item.id}
                        onClick={(event) => openDetailFromRow(event, { ...item, kind: item.type === 'task' ? 'task' : 'event' })}
                        onDoubleClick={(event) => editDetailFromRow(event, { ...item, kind: item.type === 'task' ? 'task' : 'event' })}
                        onContextMenu={(event) => openDetailContextMenu(event, { ...item, kind: item.type === 'task' ? 'task' : 'event' })}
                      >
                        <div className="detail-row-head">
                          <div>
                            <strong>{getPendingItemLabel(item)}</strong>
                            <span>{item.title}</span>
                            <small>{getPendingItemHint(item)}</small>
                          </div>
                        </div>
                        {renderDetailExtras(item)}
                        {renderInlineDetailEditor({ ...item, kind: item.type === 'task' ? 'task' : 'event' })}
                      </article>
                    ))}
                </div>
              ) : null}
              {(selectedDay?.weatherAlerts?.length || selectedDay?.reminders?.length) ? (
                <div className="today-subsection">
                  <p className="eyebrow">提醒</p>
                  {selectedDay.weatherAlerts.length ? (
                    <div className="reminder-group">
                      <strong>出门提醒</strong>
                      {selectedDay.weatherAlerts.map((alert) => (
                        <div className="weather-row" key={alert.id}>
                          <span>{alert.detail}</span>
                          <small>{alert.remindAt ? `建议提醒：${formatReminderTime(alert.remindAt)}` : '出门前看一眼。'}</small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {selectedDay.reminders.length ? (
                    <div className="reminder-group">
                      <strong>事件提醒</strong>
                      {selectedDay.reminders.map((reminder) => (
                        <div className="reminder-row" key={reminder.id}>
                          <strong>{reminder.title}</strong>
                          <small>{formatReminderTime(reminder.remindAt)} · {getReminderStatusLabel(reminder.status)}</small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {notificationPermission !== 'granted' ? (
                    <button className="notification-button" onClick={requestNotificationPermission}>
                      开启桌面提醒
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="today-detail-zone today-task-zone">
            <p className="eyebrow">待办</p>
            <div className="today-zone-scroll">
              {selectedDay?.tasks.filter((item) => !needsTaskClarification(item)).length ? (
                selectedDay.tasks
                  .filter((item) => !needsTaskClarification(item))
                  .slice()
                  .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
                  .map((item) => (
                    <article
                      className={`detail-row detail-row-deadline ${detailDraft && selectedDetail?.id === item.id && selectedDetail.kind === 'task' ? 'detail-row-editing' : ''} ${detailContextMenu?.item.id === item.id && detailContextMenu.item.kind === 'task' ? 'detail-context-selected' : ''}`}
                      key={item.id}
                      onClick={(event) => openDetailFromRow(event, { ...item, kind: 'task' })}
                      onDoubleClick={(event) => editDetailFromRow(event, { ...item, kind: 'task' })}
                      onContextMenu={(event) => openDetailContextMenu(event, { ...item, kind: 'task' })}
                    >
                      <div className="detail-row-head">
                        <div>
                          <strong>{formatItemTime(item)}</strong>
                          <span>{item.title}</span>
                        </div>
                      </div>
                      {renderDetailExtras(item)}
                      {renderInlineDetailEditor({ ...item, kind: 'task' })}
                    </article>
                  ))
              ) : (
                <p className="muted">这天没有到期待办。</p>
              )}
            </div>
          </section>
        </div>
          </>
        )}
      </aside>

      {todoContextMenu ? (
        <div
          className="todo-context-menu"
          style={{ left: todoContextMenu.x, top: todoContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              if (todoContextMenu.kind === 'task') void deleteTodoTask(todoContextMenu.task);
              else void deleteTodoProject(todoContextMenu.project);
            }}
          >
            删除
          </button>
        </div>
      ) : null}

      {detailContextMenu ? (
        <div
          className="todo-context-menu detail-context-menu"
          style={{ left: detailContextMenu.x, top: detailContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              void deleteItem(detailContextMenu.item);
              setDetailContextMenu(null);
            }}
          >
            删除
          </button>
        </div>
      ) : null}

      <div
        className={`cat-widget ${isDesktopShell ? 'cat-widget-desktop-shell' : ''}`}
        style={catPosition ? { left: catPosition.left, top: catPosition.top, right: 'auto', bottom: 'auto' } : undefined}
      >
        {shouldShowCatDialog ? <div className={`cat-dialog ${hasActiveCatContent ? '' : 'cat-dialog-idle'}`}>
          <button
            className="cat-dialog-close"
            type="button"
            title="取消本次对话"
            aria-label="取消本次对话"
            onClick={(event) => {
              event.stopPropagation();
              cancelVoiceInteraction('');
            }}
          >
            ×
          </button>
          {message && !pendingClarification && !pendingDecision ? <p>{message}</p> : null}
          {pendingClarification ? (
            <ClarificationCard
              result={pendingClarification}
              onCancel={() => {
                setPendingClarification(null);
                setInput('');
                setMessage('好，这条先不补充。你可以重新告诉我。');
              }}
            />
          ) : pendingDecision ? (
            <DecisionCard
              result={pendingDecision}
              onSelect={handleDecisionOption}
              onCancel={() => {
                setPendingDecision(null);
                setInput('');
                setMessage('好，这条先不处理。你可以重新告诉我。');
              }}
            />
          ) : pendingPostCommit ? (
            <PostCommitCard
              action={pendingPostCommit}
              onConfirm={() => {
                setPendingPostCommit(null);
                setMessage('');
              }}
              onModify={() => {
                setPendingModification(pendingPostCommit);
                setPendingPostCommit(null);
                setMessage('');
                restartVoiceInputSoon(160);
              }}
              onCancel={() => deletePostCommitAction(pendingPostCommit)}
            />
          ) : pendingModification ? (
            <div className="post-commit-card">
              <strong>直接说要怎么改</strong>
              <span>比如“不是周五，是周六”，或者“加备注：带电脑”。</span>
            </div>
          ) : parsePreview ? (
            <InputUnderstandingCard result={parsePreview} onSelectOption={commitInput} />
          ) : null}
          <div className="voice-panel">
            <div className={`voice-transcript ${input || voiceDisplayText ? '' : 'voice-empty'}`}>
              {input || voiceDisplayText || (isListening ? '正在听，你可以直接说。' : '')}
            </div>
            {catProcessStatus || isThinking ? <small className="voice-status">{catProcessStatus || '理解意图中'}</small> : null}
          </div>
        </div> : null}
        {!isDesktopShell ? (
          <div className={`cat-face ${isListening ? 'cat-listening' : ''} ${isThinking ? 'cat-thinking' : ''} ${hasActiveCatContent ? '' : 'cat-sleeping'}`} onMouseDown={startCatDrag} title="点一下开始说话，拖动可以移动小猫">
            <img src={isListening || isThinking ? catListeningAvatar : catSleepingAvatar} alt="YayaMind 小猫助手" />
            <span className="cat-state-mark" />
          </div>
        ) : null}
      </div>

      {isDesktopShell ? (
        <textarea
          ref={systemDictationInputRef}
          className="system-dictation-capture"
          aria-label="系统听写捕获"
          tabIndex={-1}
          onInput={(event) => {
            const nextText = event.currentTarget.value.trim();
            updateVoiceText(nextText);
          }}
        />
      ) : null}

    </main>
  );
}

function formatTimeRange(startAt?: string, endAt?: string) {
  if (!startAt) return '待定';
  const start = new Date(startAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (!endAt) return start;
  const end = new Date(endAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${start}-${end}`;
}

function formatItemTime(item: CalendarItem) {
  if (item.startAt) return formatTimeRange(item.startAt, item.endAt);
  if (item.dueAt) return `截止 ${formatReminderTime(item.dueAt)}`;
  return '待定';
}

function formatPinnedItemMeta(item: CalendarItem) {
  if (item.startAt) return formatTimeRange(item.startAt, item.endAt);
  if (item.dueAt) return `截止 ${formatReminderTime(item.dueAt)}`;
  if (typeof item.estimatedMinutes === 'number') return `约 ${item.estimatedMinutes} 分钟`;
  return '待定';
}

function needsTaskClarification(item: CalendarItem) {
  if (item.type !== 'task') return false;
  const text = `${item.title} ${item.notes ?? ''} ${item.rawText ?? ''}`;
  return /什么什么|那个|在这之前|之前记得|一定要把那个|可$|，，|呃/.test(text);
}

function getCompactItemMeta(item: CalendarItem) {
  const label = getTypeLabel(item.type);
  if (item.conflict) return label ? `${label} · 冲突` : '冲突';
  return label;
}

function renderDetailExtras(item: CalendarItem) {
  if (item.type === 'task') return null;
  const rows: Array<{ label: string; value: string }> = [];
  const content = getItemContent(item);
  const preparations = dedupeTextList(item.preparations ?? []);
  const notes = cleanupDisplayNote(item.notes, preparations);

  if (content) rows.push({ label: '具体安排', value: content });
  if (preparations.length) rows.push({ label: '准备事项', value: preparations.join('、') });
  if (notes) rows.push({ label: '备注', value: notes });
  if (typeof item.estimatedMinutes === 'number') rows.push({ label: '估时', value: `${item.estimatedMinutes} 分钟` });

  return rows.map((row) => <em key={row.label}>{row.label}：{row.value}</em>);
}

function getItemContent(item: CalendarItem) {
  const raw = summarizeDisplayPurpose(cleanupSpokenDetail(item.purpose || item.rawText || ''));
  const title = item.title.trim();
  if (!raw || raw === title) return '';
  if (raw.includes(title) && raw.length <= title.length + 4) return '';
  return raw;
}

function summarizeDisplayPurpose(text: string) {
  let value = text
    .replace(/^(今天|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天])/, '')
    .replace(/^(上午|中午|下午|晚上|今晚|早上|饭前|饭后|吃饭前|吃完饭后|然后)/, '')
    .replace(/^(我先|我要|我想|帮我|安排|加一个|新增|新加|记一下|记得)/, '')
    .replace(/(大概|可能|应该|差不多|左右|一下|一个)?(小时|分钟).*$/g, '')
    .replace(/[，。；;]\s*$/g, '')
    .trim();
  if (value.length < 4 && /面试/.test(text)) value = '准备面试';
  if (value.length < 3 && /健身|运动|锻炼/.test(text)) value = '健身';
  if (value.length < 3 && /项目/.test(text)) value = text.match(/(?:改|修改|整理|推进)?[^，。；;]*项目/)?.[0]?.trim() ?? value;
  if (value.length > 42) value = `${value.slice(0, 40)}…`;
  return value;
}

function dedupeTextList(items: string[]) {
  const result: string[] = [];
  for (const item of items.map((value) => value.trim()).filter(Boolean)) {
    if (!result.some((existing) => existing.includes(item) || item.includes(existing))) result.push(item);
  }
  return result;
}

function cleanupDisplayNote(note: string | undefined, preparations: string[]) {
  const normalized = (note ?? '').trim().replace(/^准备[：:]\s*/, '').trim();
  if (!normalized) return '';
  if (preparations.some((item) => item.includes(normalized) || normalized.includes(item))) return '';
  return normalized;
}

function getPendingItemLabel(item: CalendarItem) {
  if (item.type === 'task') return '待补充内容';
  const text = `${item.title} ${item.notes ?? ''} ${item.rawText ?? ''}`;
  return hasSpecificTimeOnlySignal(text) ? '待补充内容' : '待补充时间';
}

function getPendingItemHint(item: CalendarItem) {
  if (item.type === 'task') return '这条需要补清楚具体要做什么，再作为截止任务。';
  return getPendingItemLabel(item) === '待补充内容'
    ? '补上具体要做什么后，会进入一周安排。'
    : '补上日期/开始结束时间后，会进入一周安排。';
}

function hasSpecificTimeOnlySignal(text: string) {
  const hasSpecificTime = /(\d{1,2})[:：](\d{2})|(\d{1,2}|[一二两三四五六七八九十])\s*点(半|\d{1,2}分?)?/.test(text);
  const hasConcreteContent = /(开会|会议|沟通|讨论|复盘|面试|上课|课程|电话|见面|训练|运动|吃饭|午饭|晚饭|写|做|整理|完成)/.test(text);
  return hasSpecificTime && !hasConcreteContent;
}

function needsIntentCheck(text: string) {
  const normalized = text.trim();
  if (normalized.length < 3) return true;
  if (/[�□■]{2,}/.test(normalized)) return true;
  const planningSignals =
    /新增|新加|添加|加一个|有一个|待办|项目代办|今天|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|早上|上午|中午|下午|晚上|今晚|点|半|分钟|小时|开会|会议|面试|提醒|记得|任务|截止|之前|开始|结束|完成|写完|做完|安排|复盘|进度|暂停|继续|晾|洗|打扫|运动|吃饭/.test(normalized);
  return !planningSignals;
}

function getDayPlanCount(day: AssistantData['calendar'][number]) {
  return day.items.length + day.pendingItems.length + day.tasks.filter((task) => !needsTaskClarification(task)).length;
}

function getItemReminders(item: CalendarItem, reminders: CalendarReminder[]) {
  return reminders.filter((reminder) => {
    if (reminder.relatedId && reminder.relatedId === item.id) return true;
    if (item.reminderIds?.includes(reminder.id)) return true;
    return reminder.title.includes(item.title) || item.title.includes(reminder.title);
  });
}

function getWeekStart(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatWeekLabel(date: Date) {
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  const dateText = `${date.getMonth() + 1}/${date.getDate()}`;
  return `${weekday} ${dateText}`;
}

function getWeekdayText(label: string) {
  const parts = label.replace(/^今天\s+/, '').split(' ');
  return parts.length >= 2 ? `${parts[0]} ${parts.at(-1)}` : label;
}

function getDateText(label: string) {
  return '';
}

function formatSelectedDayTitle(date: string, label: string) {
  return date === toLocalDateText(new Date()) ? '今天' : label.replace(/^今天\s+/, '');
}

function formatReminderTime(value: string) {
  const date = new Date(value);
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function createDetailDraft(item: DetailTarget, fallbackDate: string): DetailDraft {
  const start = item.startAt ? new Date(item.startAt) : null;
  const end = item.endAt ? new Date(item.endAt) : null;
  const due = item.dueAt ? new Date(item.dueAt) : null;
  return {
    id: item.id,
    title: item.title,
    notes: item.notes ?? '',
    date: start ? toLocalDateText(start) : fallbackDate,
    startTime: start ? toTimeInputValue(start) : '',
    endTime: end ? toTimeInputValue(end) : '',
    dueDate: due ? toLocalDateText(due) : fallbackDate,
    dueTime: due ? toTimeInputValue(due) : '',
    estimatedMinutes: typeof item.estimatedMinutes === 'number' ? String(item.estimatedMinutes) : '',
    purpose: item.purpose ?? getItemContent(item),
    preparationsText: item.preparations?.join('\n') ?? ''
  };
}

function createLogDraft(log: CalendarLog, fallbackDate: string): LogDraft {
  const at = log.at ? new Date(log.at) : null;
  return {
    id: log.id,
    note: log.text,
    date: at ? toLocalDateText(at) : fallbackDate,
    time: at ? toTimeInputValue(at) : log.time
  };
}

function toTimeInputValue(date: Date) {
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function combineLocalDateTime(date: string, time: string) {
  if (!date || !time) return undefined;
  return new Date(`${date}T${time}:00`).toISOString();
}

function getDatePart(date: string, part: 'month' | 'day') {
  const [, month = '1', day = '1'] = date.split('-');
  return String(Number(part === 'month' ? month : day) || 1);
}

function splitPreparations(value: string) {
  return value
    .split(/[\n,，、；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const splitListText = splitPreparations;

function createSettingsDraft(settings: AppSettings): SettingsDraft {
  return {
    wakeUp: settings.habits.wakeUp || '06:00',
    sleepStart: settings.habits.sleepStart || '22:00',
    restDayMode: settings.habits.restDayMode || 'weekend',
    showLegalHolidays: settings.habits.showLegalHolidays !== false,
    aiProvider: settings.ai?.provider ?? 'deepseek',
    aiEnabled: settings.ai?.enabled !== false,
    aiBaseUrl: settings.ai?.baseUrl || 'https://api.deepseek.com',
    aiModel: settings.ai?.model || 'deepseek-chat',
    aiApiKey: settings.ai?.apiKey || ''
  };
}

function inferRangeFromHabit(wakeUp: string, sleepStart: string) {
  const wakeHour = Number((wakeUp || '06:00').slice(0, 2));
  const sleepHour = Number((sleepStart || '22:00').slice(0, 2));
  if (sleepHour > wakeHour) return { startHour: wakeHour, endHour: sleepHour };
  return { startHour: wakeHour, endHour: Math.min(30, sleepHour + 24) };
}

function getScheduleRangeText(settings: AppSettings) {
  const range = getScheduleRange(settings);
  return `当前显示 ${formatScheduleHour(range.startHour)}-${formatScheduleHour(range.endHour)}，问候会按这个作息变得更贴近你。`;
}

function formatScheduleHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  return `${String(normalized).padStart(2, '0')}:00`;
}

function getRestDayClass(dateText: string, settings: AppSettings) {
  const date = new Date(`${dateText}T12:00:00`);
  const shouldShowLegalHolidays = settings.habits.showLegalHolidays !== false;
  if (isAdjustedWorkday(dateText) && shouldShowLegalHolidays) return 'day-adjusted-work';
  if (isLegalHoliday(dateText) && shouldShowLegalHolidays) return 'day-rest day-legal-rest';
  if (!isRestDay(date, settings)) return '';
  return 'day-rest';
}

function isRestDay(date: Date, settings: AppSettings) {
  const day = date.getDay();
  const mode = settings.habits.restDayMode;
  if (mode === 'weekend') return day === 0 || day === 6;
  if (mode === 'single_sunday') return day === 0;
  if (mode === 'single_saturday') return day === 6;
  if (mode === 'custom') return settings.habits.customRestDays.includes(day);
  if (mode === 'alternate_weekends') {
    if (day !== 0 && day !== 6) return false;
    const start = new Date(`${settings.habits.alternateWeekendStartsOn || '2026-01-03'}T12:00:00`);
    const diffWeeks = Math.floor((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return diffWeeks % 2 === 0 ? day === 0 || day === 6 : day === 0;
  }
  return false;
}

function isLegalHoliday(dateText: string) {
  return legalHolidayDates.has(dateText) || ['01-01', '05-01', '10-01', '10-02', '10-03'].includes(dateText.slice(5));
}

function isAdjustedWorkday(dateText: string) {
  return adjustedWorkdayDates.has(dateText);
}

const legalHolidayDates = new Set([
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  '2026-02-15',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-02-21',
  '2026-02-22',
  '2026-02-23',
  '2026-04-04',
  '2026-04-05',
  '2026-04-06',
  '2026-05-01',
  '2026-05-02',
  '2026-05-03',
  '2026-05-04',
  '2026-05-05',
  '2026-06-19',
  '2026-06-20',
  '2026-06-21',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07'
]);

const adjustedWorkdayDates = new Set([
  '2026-01-04',
  '2026-02-14',
  '2026-02-28',
  '2026-05-09',
  '2026-09-20',
  '2026-10-10'
]);

function showTimePicker(input: HTMLInputElement) {
  try {
    input.showPicker?.();
  } catch {
    input.focus();
  }
}

function isFreshReminderTrigger(reminder: CalendarReminder, now: Date) {
  if (!reminder.updatedAt) return false;
  return now.getTime() - new Date(reminder.updatedAt).getTime() <= 90_000;
}

function hasActiveInteractionState(state: {
  message: string;
  pendingClarification: ParseResult | null;
  pendingDecision: ParseResult | null;
  pendingPostCommit: PostCommitAction | null;
  pendingModification: PostCommitAction | null;
  input: string;
  voiceDisplayText: string;
  catProcessStatus: string;
  isListening: boolean;
  isThinking: boolean;
}) {
  return Boolean(
    state.message ||
    state.pendingClarification ||
    state.pendingDecision ||
    state.pendingPostCommit ||
    state.pendingModification ||
    state.input ||
    state.voiceDisplayText ||
    state.catProcessStatus ||
    state.isListening ||
    state.isThinking
  );
}

function getGreetingPeriod(now: Date) {
  const hour = now.getHours();
  if (hour < 5) return 'late-night';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'noon';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

function getTimeGreeting(now: Date, settings: AppSettings) {
  const period = getGreetingPeriod(now);
  const lines: Record<string, string[]> = {
    'late-night': [
      '还没休息呀，先把最要紧的一件事放下就好。',
      '这么晚还在，我陪你收个小尾巴，等会儿早点睡。',
      '夜深啦，今天已经很辛苦了，别把自己绷太紧。'
    ],
    morning: [
      '早上好呀，新的一天慢慢开始，今天想先做什么？',
      '早呀，先放一件最重要的小事进来吧。',
      '早上好，今天也一起稳稳推进。'
    ],
    noon: [
      '中午好呀，吃饭和休息也算计划的一部分。',
      '中午到啦，下午要推进哪一块？',
      '先喘口气也可以，等会儿再安排下一件事。'
    ],
    afternoon: [
      '下午好呀，现在适合把计划收拢一下。',
      '下午继续加油，今天还想完成哪一块？',
      '我在这儿，随时可以帮你把安排落到时间上。'
    ],
    evening: [
      '晚上好呀，今天打算做什么呢？',
      '晚上啦，今天也努力了一天，真棒。',
      '要不要把今晚最重要的一件事先安排好？'
    ],
    night: [
      `这么晚了，${settings.habits.sleepStart ? `你平时 ${settings.habits.sleepStart} 左右休息，` : ''}早点收尾呀。`,
      '今天也辛苦啦，剩下的事可以轻轻放进明天。',
      '夜里适合少安排一点，先照顾好自己。'
    ]
  };
  const options = lines[period] ?? lines.evening;
  const index = Math.abs(now.getDate() + now.getHours()) % options.length;
  return options[index];
}

function getDesktopCatDialogPayload(state: {
  message: string;
  dialogMessages: DesktopCatDialogMessage[];
  pendingClarification: ParseResult | null;
  pendingDecision: ParseResult | null;
  pendingPostCommit: PostCommitAction | null;
  pendingModification: PostCommitAction | null;
  parsePreview: ParseResult | null;
  input: string;
  voiceDisplayText: string;
  catProcessStatus: string;
  isListening: boolean;
  isThinking: boolean;
}): DesktopCatDialogPayload {
  const messages: DesktopCatDialogMessage[] = [...state.dialogMessages];
  const hasDialogHistory = messages.length > 0;
  const addMessage = (role: DesktopCatDialogMessage['role'], text: string, muted = false) => {
    const value = text.trim();
    if (!value) return;
    messages.push({ id: `${messages.length}-${role}`, role, text: value, muted });
  };
  const addRawText = (result: ParseResult | null) => {
    if (!result?.rawText) return;
    addMessage('user', result.rawText);
  };
  const toOptions = (result: ParseResult | null): DesktopCatDialogOption[] =>
    result ? getConflictOptions(result).map((option) => ({ id: option.id, label: option.title })) : [];

  const voiceText = state.input || state.voiceDisplayText;

  if (state.pendingClarification) {
    if (!hasDialogHistory) {
      addRawText(state.pendingClarification);
      addMessage('assistant', state.pendingClarification.questions[0] || '这里还差一点信息，你补一句就好。');
    }
    if (state.isListening && voiceText) addMessage('user', voiceText);
    if (state.isListening) addMessage('input', voiceText ? '我在听，请继续说。' : '我在听。', true);
    return { type: 'cat-dialog-v1', messages };
  }

  if (state.pendingDecision) {
    if (!hasDialogHistory) {
      addRawText(state.pendingDecision);
      addMessage('assistant', state.pendingDecision.questions[0] || '这条需要你选一下怎么处理。');
    }
    if (state.isListening && voiceText) addMessage('user', voiceText);
    if (state.isListening) addMessage('input', voiceText ? '我在听，请继续说。' : '我在听。', true);
    return { type: 'cat-dialog-v1', messages, options: toOptions(state.pendingDecision) };
  }

  if (state.parsePreview?.questions[0]) {
    if (!hasDialogHistory) {
      addRawText(state.parsePreview);
      addMessage('assistant', state.parsePreview.questions[0]);
    }
    if (state.isListening && voiceText) addMessage('user', voiceText);
    if (state.isListening) addMessage('input', voiceText ? '我在听，请继续说。' : '我在听。', true);
    return { type: 'cat-dialog-v1', messages, options: toOptions(state.parsePreview) };
  }

  if (state.isListening) {
    if (voiceText) addMessage('user', voiceText);
    addMessage('input', voiceText ? '我正在听，请继续说。' : '我正在听，请开始说话。', true);
    return { type: 'cat-dialog-v1', messages };
  }

  if (state.catProcessStatus || state.isThinking) {
    const status = state.catProcessStatus || '理解意图中';
    if (!hasDialogHistory) addMessage('user', voiceText);
    addMessage('system', status, true);
    return { type: 'cat-dialog-v1', messages };
  }

  if (state.parsePreview) {
    if (!hasDialogHistory) {
      addRawText(state.parsePreview);
      addMessage('assistant', getDesktopParsePreviewMessage(state.parsePreview));
    }
    return { type: 'cat-dialog-v1', messages, options: toOptions(state.parsePreview) };
  }

  if (state.pendingPostCommit) {
    addMessage('assistant', `已加好：${state.pendingPostCommit.title}`);
    return { type: 'cat-dialog-v1', messages };
  }

  if (state.pendingModification) {
    if (!hasDialogHistory) addMessage('assistant', '直接说要怎么改，比如换日期或加准备事项。');
    addMessage('input', '我正在听，请继续说。', true);
    return { type: 'cat-dialog-v1', messages };
  }

  if (voiceText && !hasDialogHistory) addMessage('user', voiceText);
  if (state.message) addMessage('assistant', state.message);
  return { type: 'cat-dialog-v1', messages };
}

function getDesktopParsePreviewMessage(result: ParseResult) {
  if (result.needsConfirmation) {
    if (getPlanDraft(result)) return result.questions[0] ? '' : '可以确认、修改或取消。';
    if (getBatchOperation(result) || result.candidates?.length) return '我列出候选了，可以确认或取消。';
    if (result.questions[0]) return `还差一点：${result.questions[0]}`;
  }
  const previewText = getPreviewText(result);
  if (previewText && previewText !== '准备记录') {
    return `我整理好了：${previewText}`;
  }
  const rewrittenText = result.transcription?.correctedText?.trim() || result.rawText.trim();
  if (rewrittenText) return `我听到：${rewrittenText}`;
  return '我整理好了，你看一下确认卡片。';
}

function shouldAutoCommitDesktopVoicePreview(result: ParseResult) {
  const simpleAutoCommitIntents: ParsedIntent[] = ['add_event', 'add_task', 'add_reminder', 'start_work', 'pause_work', 'resume_work', 'finish_work', 'progress_update'];
  return simpleAutoCommitIntents.includes(result.intent) &&
    !result.needsConfirmation &&
    !result.draft &&
    !result.batchOperation &&
    !result.candidates?.length &&
    getConflictOptions(result).length === 0;
}

function getDayStateClass(dateText: string, now: Date) {
  const today = toLocalDateText(now);
  if (dateText < today) return 'day-past';
  if (dateText === today) return 'day-current';
  return 'day-future';
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    meeting: '会议',
    task_block: '任务块',
    life: '生活',
    exercise: '训练',
    meal: '吃饭',
    rest: '休息',
    risk: '风险',
    other: '',
    task: '任务'
  };
  return labels[type] ?? '安排';
}

type ScheduleRange = { startHour: number; endHour: number; dayMinutes: number; sleepBlocks: SleepBlock[] };
type SleepBlock = { start: number; end: number };

const compressedSleepMinutes = 60;
const defaultScheduleRange: ScheduleRange = { startHour: 0, endHour: 24, dayMinutes: 24 * 60, sleepBlocks: [] };

function getScheduleRange(settings: AppSettings): ScheduleRange {
  const startHour = Math.min(24, Math.max(0, Math.round(settings.ui.dayStartHour ?? 0)));
  const endHour = Math.min(24, Math.max(0, Math.round(settings.ui.dayEndHour ?? 24)));
  const safeStart = startHour === 0 && endHour === 24 ? 0 : 0;
  const safeEnd = startHour === 0 && endHour === 24 ? 24 : 24;
  const sleepBlocks = getSleepBlocks(settings, safeStart, safeEnd);
  const compressedMinutes = sleepBlocks.reduce((total, block) => total + Math.max(0, block.end - block.start - compressedSleepMinutes), 0);
  return { startHour: safeStart, endHour: safeEnd, dayMinutes: (safeEnd - safeStart) * 60 - compressedMinutes, sleepBlocks };
}

function getHourMarks(range = defaultScheduleRange) {
  return Array.from({ length: range.endHour - range.startHour + 1 }, (_, index) => range.startHour + index)
    .filter((hour) => !isMinuteInsideSleepInterior(hour * 60, range));
}

function getHourMarkStyle(hour: number, range = defaultScheduleRange) {
  return {
    top: `${clampPercent((mapActualMinuteToDisplay(hour * 60, range) / range.dayMinutes) * 100)}%`
  };
}

function getMinorTimeMarks(range = defaultScheduleRange) {
  const marks: number[] = [];
  for (let minutes = range.startHour * 60 + 30; minutes < range.endHour * 60; minutes += 30) {
    if (minutes % 60 !== 0 && !isMinuteInsideSleepInterior(minutes, range)) {
      marks.push(mapActualMinuteToDisplay(minutes, range));
    }
  }
  return marks;
}

function getSleepBlocks(settings: AppSettings, startHour: number, endHour: number): SleepBlock[] {
  const sleepStart = parseTimeToMinutes(settings.habits.sleepStart || '22:00');
  const wakeUp = parseTimeToMinutes(settings.habits.wakeUp || '06:00');
  if (sleepStart === wakeUp) return [];
  const blocks = sleepStart < wakeUp
    ? [{ start: sleepStart, end: wakeUp }]
    : [
        { start: 0, end: wakeUp },
        { start: sleepStart, end: 24 * 60 }
      ];
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;
  return blocks
    .map((block) => ({ start: Math.max(block.start, rangeStart), end: Math.min(block.end, rangeEnd) }))
    .filter((block) => block.end - block.start >= 15);
}

function parseTimeToMinutes(value: string) {
  const [hourText = '0', minuteText = '0'] = value.split(':');
  const hour = Math.min(23, Math.max(0, Number(hourText) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteText) || 0));
  return hour * 60 + minute;
}

function getSleepBlockStyle(block: SleepBlock, range = defaultScheduleRange) {
  const top = mapActualMinuteToDisplay(block.start, range);
  return {
    top: `${clampPercent((top / range.dayMinutes) * 100)}%`,
    height: `${clampPercent((compressedSleepMinutes / range.dayMinutes) * 100)}%`
  };
}

function getMinuteMarkStyle(minutesFromStart: number, range = defaultScheduleRange) {
  return {
    top: `${clampPercent((minutesFromStart / range.dayMinutes) * 100)}%`
  };
}

function isToday(dateText: string, now: Date) {
  return dateText === toLocalDateText(now);
}

function toLocalDateText(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinutesFromDayStart(value: Date, range = defaultScheduleRange) {
  const minutes = value.getHours() * 60 + value.getMinutes();
  return mapActualMinuteToDisplay(minutes, range);
}

function minuteFromClientY(clientY: number, rect: DOMRect, range = defaultScheduleRange) {
  const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  return snapToHalfHour(ratio * range.dayMinutes);
}

function snapToHalfHour(minutes: number) {
  return Math.round(minutes / 30) * 30;
}

function clampMinute(minutes: number, range = defaultScheduleRange) {
  return Math.min(range.dayMinutes, Math.max(0, minutes));
}

function makeLocalDateTime(date: string, minutesFromStart: number, range = defaultScheduleRange) {
  const dateTime = new Date(`${date}T00:00:00`);
  dateTime.setMinutes(mapDisplayMinuteToActual(clampMinute(minutesFromStart, range), range));
  return dateTime.toISOString();
}

function isMinuteInsideSleepInterior(minute: number, range = defaultScheduleRange) {
  return range.sleepBlocks.some((block) => minute > block.start && minute < block.end);
}

function mapActualMinuteToDisplay(minute: number, range = defaultScheduleRange) {
  const rangeStart = range.startHour * 60;
  const rangeEnd = range.endHour * 60;
  const clamped = Math.min(rangeEnd, Math.max(rangeStart, minute));
  let display = clamped - rangeStart;
  for (const block of range.sleepBlocks) {
    const duration = block.end - block.start;
    const compression = Math.max(0, duration - compressedSleepMinutes);
    const blockDisplayStart = block.start - rangeStart - range.sleepBlocks
      .filter((item) => item.end <= block.start)
      .reduce((total, item) => total + Math.max(0, item.end - item.start - compressedSleepMinutes), 0);

    if (clamped >= block.end) {
      display -= compression;
    } else if (clamped > block.start) {
      const ratio = (clamped - block.start) / Math.max(1, duration);
      display = blockDisplayStart + ratio * compressedSleepMinutes;
      break;
    }
  }
  return display;
}

function mapDisplayMinuteToActual(displayMinute: number, range = defaultScheduleRange) {
  const rangeStart = range.startHour * 60;
  let compressedBefore = 0;
  for (const block of range.sleepBlocks) {
    const duration = block.end - block.start;
    const blockDisplayStart = block.start - rangeStart - compressedBefore;
    const blockDisplayEnd = blockDisplayStart + compressedSleepMinutes;
    if (displayMinute < blockDisplayStart) break;
    if (displayMinute <= blockDisplayEnd) {
      const ratio = (displayMinute - blockDisplayStart) / compressedSleepMinutes;
      return block.start + ratio * duration;
    }
    compressedBefore += Math.max(0, duration - compressedSleepMinutes);
  }
  return rangeStart + displayMinute + compressedBefore;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getNowLineStyle(now: Date, range = defaultScheduleRange) {
  return {
    top: `${clampPercent((getMinutesFromDayStart(now, range) / range.dayMinutes) * 100)}%`
  };
}

function getPastShadeStyle(now: Date, range = defaultScheduleRange) {
  return {
    height: `${clampPercent((getMinutesFromDayStart(now, range) / range.dayMinutes) * 100)}%`
  };
}

function getEventStyle(startAt?: string, endAt?: string, lane = 0, laneCount = 1, range = defaultScheduleRange) {
  if (!startAt) return {};
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const startMinutes = getMinutesFromDayStart(start, range);
  const endMinutes = getMinutesFromDayStart(end, range);
  const durationMinutes = Math.max(30, endMinutes - startMinutes);
  const safeLaneCount = Math.max(1, laneCount);
  const gap = 4;
  const widthPercent = 100 / safeLaneCount;

  return {
    height: `${clampPercent((durationMinutes / range.dayMinutes) * 100)}%`,
    left: `calc(${lane * widthPercent}% + ${lane > 0 ? gap : 0}px)`,
    right: 'auto',
    top: `${clampPercent((startMinutes / range.dayMinutes) * 100)}%`,
    width: `calc(${widthPercent}% - ${lane > 0 ? gap : 0}px)`
  };
}

function getDeadlineStyle(dueAt?: string | null) {
  if (!dueAt) return {};
  const minutes = getMinutesFromDayStart(new Date(dueAt));
  return {
    top: `${clampPercent((minutes / defaultScheduleRange.dayMinutes) * 100)}%`
  };
}

function formatElapsed(startedAt: string, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours === 0) return `${restMinutes} 分钟`;
  return `${hours} 小时 ${restMinutes} 分钟`;
}

function getCatSuggestion(data: AssistantData, now: Date) {
  const activeSession = data.today.activeSession;
  if (activeSession) {
    const minutes = Math.max(0, Math.floor((now.getTime() - new Date(activeSession.startedAt).getTime()) / 60_000));
    if (minutes >= 90) return '这段已经挺长了，可以考虑收个小尾巴，或者记录一下当前进度。';
    if (minutes >= 45) return '已经进入一段有效专注了，先别急着切任务，保住这个节奏。';
    return '刚开工不久，先把当前任务推进到一个可停顿的小节点。';
  }

  const nextPlan = data.today.plans[0];
  if (nextPlan) return `现在没有执行中的任务，可以从“${getShortTitle(nextPlan.title)}”开始。`;
  if (data.today.reminders.length > 0) return '今天有未处理提醒，可以先清掉一个生活小尾巴。';
  return '今天面板还很轻，可以先丢一件最小可执行的任务给我。';
}

function getReminderStatusLabel(status: string) {
  if (status === 'triggered') return '已触发';
  if (status === 'missed') return '已错过';
  return '待提醒';
}

function getGoalStatusLabel(status: GoalRecord['status']) {
  const labels: Record<GoalRecord['status'], string> = {
    active: '进行中',
    paused: '已暂停',
    done: '已完成',
    cancelled: '已取消'
  };
  return labels[status];
}

function buildProjectTodoGroups(projects: TodoProject[], tasks: TaskListItem[]) {
  const groups = new Map<string, { project: TodoProject; projectId: string; projectTitle: string; tasks: TaskListItem[]; openCount: number; color: string }>();
  projects.forEach((project) => {
    groups.set(project.id, { project, projectId: project.id, projectTitle: project.title, tasks: [], openCount: 0, color: getProjectColor(project.id) });
  });
  tasks
    .filter((task) => task.status !== 'cancelled' && task.title.trim())
    .forEach((task) => {
      const projectId = task.projectId || 'uncategorized';
      const projectTitle = task.projectTitle || '未归类';
      const project = projects.find((item) => item.id === projectId) ?? {
        id: projectId,
        title: projectTitle,
        status: 'active' as const,
        createdAt: '',
        updatedAt: ''
      };
      const group = groups.get(projectId) ?? { project, projectId, projectTitle, tasks: [], openCount: 0, color: getProjectColor(projectId) };
      group.tasks.push(task);
      if (task.status !== 'done') group.openCount += 1;
      groups.set(projectId, group);
    });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort(compareTodoTasks)
    }))
    .sort((a, b) => compareTodoProjects(a.project, b.project));
}

type ProjectTodoGroup = ReturnType<typeof buildProjectTodoGroups>[number];

function isUncategorizedTodoProject(project: Pick<TodoProject, 'id' | 'title'>) {
  return project.id === 'uncategorized' || project.title.trim() === '未归类';
}

const coreTodoProjectTitles = ['工作', '学校', '生活'];

function getCoreTodoGroups(groups: ProjectTodoGroup[]) {
  return coreTodoProjectTitles
    .map((title) => groups.find((group) => group.projectTitle === title))
    .filter(Boolean) as ProjectTodoGroup[];
}

function getOtherTodoGroups(groups: ProjectTodoGroup[]) {
  return groups.filter((group) => !coreTodoProjectTitles.includes(group.projectTitle));
}

function compareTodoProjects(a: Pick<TodoProject, 'order' | 'title' | 'createdAt'>, b: Pick<TodoProject, 'order' | 'title' | 'createdAt'>) {
  const orderA = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY;
  const orderB = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;
  const createdOrder = (a.createdAt || '').localeCompare(b.createdAt || '');
  if (createdOrder !== 0) return createdOrder;
  return a.title.localeCompare(b.title, 'zh-CN');
}

function compareTodoTasks(a: Pick<TaskListItem, 'order' | 'status' | 'dueAt' | 'createdAt'>, b: Pick<TaskListItem, 'order' | 'status' | 'dueAt' | 'createdAt'>) {
  const doneOrder = Number(a.status === 'done') - Number(b.status === 'done');
  if (doneOrder !== 0) return doneOrder;
  const orderA = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY;
  const orderB = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;
  return (a.dueAt ?? a.createdAt).localeCompare(b.dueAt ?? b.createdAt);
}

function buildTodoDeadlineDots(tasks: TaskListItem[]) {
  const dots = new Map<string, string[]>();
  tasks
    .filter((task) => task.status !== 'cancelled' && task.dueAt)
    .forEach((task) => {
      const date = task.dueAt!.slice(0, 10);
      dots.set(date, [...(dots.get(date) ?? []), getProjectColor(task.projectId)]);
    });
  return dots;
}

function getProjectColor(projectId: string) {
  const palette = ['#9b3d3d', '#2f6f68', '#b2742e', '#5c6fa6', '#8f5b83', '#6f7b3b', '#b85f42', '#4f7f9b'];
  if (projectId === 'uncategorized') return '#9a8b7d';
  let hash = 0;
  for (const char of projectId) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return palette[hash % palette.length];
}

function buildMonthCalendarDays(now: Date) {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(firstDay);
  const weekday = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  start.setDate(firstDay.getDate() - weekday + 1);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: toLocalDateText(date),
      day: date.getDate(),
      inMonth: date.getMonth() === now.getMonth()
    };
  });
}

function getTodoDateTag(task: TaskListItem) {
  if (!task.dueAt) return '';
  const date = new Date(task.dueAt);
  if (Number.isNaN(date.getTime())) return '';
  return `#${date.getMonth() + 1}/${date.getDate()}`;
}

function getTodoDateTagStyle(task: TaskListItem): CSSProperties {
  if (!task.dueAt) return {};
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((dueDay.getTime() - today.getTime()) / 86_400_000);
  const palette =
    daysLeft <= 0
      ? { background: '#f3a39a', border: '#d97870' }
      : daysLeft <= 2
        ? { background: '#f7bbb1', border: '#e49a91' }
        : daysLeft <= 4
          ? { background: '#f9d1c5', border: '#ebb5a8' }
          : daysLeft <= 7
            ? { background: '#f6dfcf', border: '#e4c6b0' }
            : { background: '#eee9e1', border: '#d9d0c4' };
  return {
    '--todo-date-bg': palette.background,
    '--todo-date-border': palette.border
  } as CSSProperties;
}

function stripTodoDateTags(text: string) {
  return text.replace(/#\d{4}-\d{2}-\d{2}/g, '').replace(/\s+/g, ' ').trim();
}

function getTextEditorRows(text: string, charsPerLine: number) {
  const normalized = text || '';
  const visualRows = normalized.split('\n').reduce((sum, line) => {
    const wideChars = Array.from(line).reduce((count, char) => count + (/[\u4e00-\u9fff]/.test(char) ? 1.05 : 0.55), 0);
    return sum + Math.max(1, Math.ceil(wideChars / charsPerLine));
  }, 0);
  return Math.max(1, visualRows);
}

function ProfileBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  const visibleItems = items.filter(Boolean);
  return (
    <article className="workspace-card">
      <strong>{title}</strong>
      {visibleItems.length ? (
        visibleItems.map((item) => <span key={item}>{item}</span>)
      ) : (
        <span>{empty}</span>
      )}
    </article>
  );
}

function ManualEventEditor({
  draft,
  onChange,
  onSave,
  onCancel
}: {
  draft: ManualEventDraft;
  onChange: (draft: ManualEventDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const patch = (value: Partial<ManualEventDraft>) => onChange({ ...draft, ...value });
  return (
    <div className="manual-event-editor">
      <input value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="日程标题" autoFocus />
      <div className="manual-event-time-row">
        <input type="date" value={draft.date} onChange={(event) => patch({ date: event.target.value })} />
        <input type="time" value={draft.startTime} step="1800" onChange={(event) => patch({ startTime: event.target.value })} />
        <input type="time" value={draft.endTime} step="1800" onChange={(event) => patch({ endTime: event.target.value })} />
      </div>
      <select value={draft.type} onChange={(event) => patch({ type: event.target.value as CalendarItem['type'] })}>
        <option value="other">日程</option>
        <option value="meeting">会议</option>
        <option value="task_block">任务块</option>
        <option value="life">生活</option>
        <option value="exercise">运动</option>
        <option value="meal">吃饭</option>
        <option value="rest">休息</option>
      </select>
      <textarea rows={2} value={draft.preparationsText} onChange={(event) => patch({ preparationsText: event.target.value })} placeholder="准备事项" />
      <textarea rows={2} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} placeholder="备注" />
      <div className="manual-event-actions">
        <button type="button" onClick={onSave}>确定</button>
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function InputUnderstandingCard({ result, onSelectOption }: { result: ParseResult; onSelectOption: (optionId?: string) => void }) {
  const options = getConflictOptions(result);
  const rows = getUnderstandingRows(result);
  const draft = getPlanDraft(result);
  const batch = getBatchOperation(result);
  const candidates = result.candidates ?? batch?.candidates ?? [];

  return (
    <div className={`parse-preview understanding-card ${result.needsConfirmation ? 'parse-warning' : ''}`}>
      <div className="understanding-head">
        <span>{result.needsConfirmation ? '等待确认' : '已整理'}</span>
        <strong>{getIntentLabel(result.intent)}</strong>
        {result.preview.parser === 'deepseek' ? <small className="ai-participation">DeepSeek 参与</small> : null}
      </div>
      {result.transcription ? (
        <div className="transcription-correction">
          <small>实时转写：{result.transcription.originalText}</small>
          <small>AI改写：{result.transcription.correctedText}</small>
        </div>
      ) : null}
      <div className="understanding-rows">
        {rows.map((row) => (
          <div className="understanding-row" key={row.label}>
            <small>{row.label}</small>
            <b>{row.value}</b>
          </div>
        ))}
      </div>
      {draft ? (
        <div className="understanding-draft-list">
          {draft.items.slice(0, 6).map((item) => (
            <small key={item.id}>
              {getDraftKindLabel(item.kind)} · {item.title}
              {item.startAt ? ` · ${formatPreviewTime(item.startAt, item.endAt)}` : item.dueAt ? ` · ${formatPreviewTime(item.dueAt)}` : item.remindAt ? ` · ${formatPreviewTime(item.remindAt)}` : ' · 待补充'}
              {item.risk ? ` · ${item.risk}` : ''}
            </small>
          ))}
          {draft.assumptions.length ? <small>推断：{draft.assumptions.slice(0, 2).join('；')}</small> : null}
        </div>
      ) : null}
      {candidates.length ? (
        <div className="understanding-draft-list">
          {candidates.slice(0, 6).map((item) => (
            <small key={item.id}>{getDraftKindLabel(item.kind)} · {item.title}{item.detail ? ` · ${item.detail}` : ''}</small>
          ))}
        </div>
      ) : null}
      {result.questions[0] ? <p className="understanding-question">{result.questions[0]}</p> : null}
      {options.length > 0 ? (
        <div className="conflict-options">
          {options.map((option) => (
            <button key={option.id} onClick={() => onSelectOption(option.id)}>
              {option.title}
            </button>
          ))}
        </div>
      ) : !result.needsConfirmation ? (
        <div className="conflict-options">
          <button onClick={() => onSelectOption()}>确认记录</button>
        </div>
      ) : null}
    </div>
  );
}

function ClarificationCard({ result, onCancel }: { result: ParseResult; onCancel: () => void }) {
  return (
    <div className="clarification-card">
      <div>
        <span>小猫追问</span>
        <strong>{result.questions[0] ?? '这条还差一点信息。'}</strong>
      </div>
      <small>原话：{result.rawText}</small>
      <button onClick={onCancel}>取消</button>
    </div>
  );
}

function DecisionCard({ result, onSelect, onCancel }: { result: ParseResult; onSelect: (optionId: string) => void; onCancel: () => void }) {
  const options = getConflictOptions(result);
  return (
    <div className="clarification-card decision-card">
      <div>
        <span>需要你选一个</span>
        <strong>{result.questions[0] ?? '这个安排需要确认后再写入。'}</strong>
      </div>
      <small>原话：{result.rawText}</small>
      <div className="conflict-options">
        {options.map((option) => (
          <button key={option.id} onClick={() => onSelect(option.id)}>
            {option.title}
          </button>
        ))}
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function PostCommitCard({
  action,
  onConfirm,
  onModify,
  onCancel
}: {
  action: PostCommitAction;
  onConfirm: () => void;
  onModify: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="post-commit-card">
      <strong>{action.title}</strong>
      <span>已放进安排里，要保留吗？</span>
      <div className="conflict-options">
        <button onClick={onConfirm}>确认</button>
        <button onClick={onModify}>修改</button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function getEventOperationIntent(text: string, parsed?: ParseResult | null): 'delete_event' | 'update_event' | 'annotate_event' | null {
  if (isExplicitNewEventText(text)) return null;
  if (parsed?.intent === 'delete_event' || parsed?.intent === 'update_event' || parsed?.intent === 'annotate_event') return parsed.intent;
  if (/(删掉|删除|取消|撤掉|去掉|不要了|不用了)/.test(text) && /(会|会议|开会|面试|上课|课程|安排|日程)/.test(text)) return 'delete_event';
  if (/(备注|补充|带上|带|准备|加上|说明)/.test(text) && /(会|会议|开会|面试|上课|课程|安排|日程)/.test(text)) return 'annotate_event';
  if (/(改|修改|改到|改成|改为|重新安排|不是|换到|挪到|提前|推迟)/.test(text) && /(会|会议|开会|面试|上课|课程|安排|日程)/.test(text)) return 'update_event';
  return null;
}

function isExplicitNewEventText(text: string) {
  return /(有一?个|有场|安排一?个|新增一?个|加一?个|记一?个|我要|我想|打算|需要|明天|后天|今天|上午|下午|晚上|\d{1,2}[点:：]|一?个小时|半小时|两小时|俩小时)/.test(text) &&
    /(面试|会议|开会|上课|课程|日程|安排)/.test(text) &&
    !/(已有|刚才|上次|那[个场条]|这[个场条]|备注|补充|带上|加上说明)/.test(text);
}

function isMeetingLikeItem(item: CalendarItem) {
  return /(meeting|会|会议|开会|面试|上课|课程)/.test(`${item.type} ${item.title} ${item.rawText ?? ''}`);
}

function scoreEventCandidate(item: CalendarItem, text: string, targetMinutes: number | null, targetDate: string) {
  let score = item.date === targetDate ? 20 : 0;
  if (isMeetingLikeItem(item)) score += 8;
  if (/上午|早上/.test(text) && item.startAt && new Date(item.startAt).getHours() < 12) score += 10;
  if (/下午/.test(text) && item.startAt && new Date(item.startAt).getHours() >= 12 && new Date(item.startAt).getHours() < 18) score += 10;
  if (/晚上|晚上的|今晚/.test(text) && item.startAt && new Date(item.startAt).getHours() >= 18) score += 10;
  if (targetMinutes !== null) {
    if (!item.startAt) return -1001;
    const diff = Math.abs(getMinutesFromDayStart(new Date(item.startAt)) - targetMinutes);
    if (diff > 120) return -1001;
    score += Math.max(0, 120 - diff);
  }
  return score;
}

function inferSpokenTimeMinutes(text: string) {
  const digital = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2})[:：](\d{2})/);
  if (digital) return normalizeSpokenHour(Number(digital[2]), digital[1] ?? '') * 60 + Number(digital[3]);

  const spoken = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2}|[一二两三四五六七八九十])\s*点(半|[一二三四五六七八九十\d]{1,2}分?)?/);
  if (!spoken) return null;
  const hour = normalizeSpokenHour(parseSpokenNumber(spoken[2]), spoken[1] ?? '');
  const minute = spoken[3]?.startsWith('半') ? 30 : 0;
  return hour * 60 + minute;
}

function normalizeSpokenHour(hour: number, period: string) {
  if ((period === '下午' || period === '晚上' || period === '今晚') && hour < 12) return hour + 12;
  if (period === '中午' && hour < 11) return hour + 12;
  return hour;
}

function parseSpokenNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return map[value] ?? 0;
}

function buildModificationBody(action: PostCommitAction, text: string, parsed: ParseResult | null, fallbackDate?: string) {
  const fields = parsed?.fields ?? {};
  const body: Record<string, unknown> = {};
  const parsedTitle = typeof fields.title === 'string' ? fields.title.trim() : '';
  const parsedStartAt = typeof fields.startAt === 'string' ? fields.startAt : undefined;
  const parsedEndAt = typeof fields.endAt === 'string' ? fields.endAt : undefined;
  const parsedDueAt = typeof fields.dueAt === 'string' ? fields.dueAt : undefined;
  const correctionDate = inferCorrectionDate(text, fallbackDate);
  const note = extractSimpleNote(text);
  const preparations = extractSimplePreparations(text);

  if (action.kind === 'event') {
    if (parsedTitle && !/(备注|带|准备|不是|改成|改到)/.test(text)) body.title = parsedTitle;
    if (parsedStartAt) {
      body.startAt = correctionDate ? replaceIsoDate(parsedStartAt, correctionDate) : parsedStartAt;
      body.date = toLocalDateText(new Date(String(body.startAt)));
      if (parsedEndAt) body.endAt = correctionDate ? replaceIsoDate(parsedEndAt, correctionDate) : parsedEndAt;
    } else if (correctionDate) {
      body.date = correctionDate;
      if (action.startAt) body.startAt = replaceIsoDate(action.startAt, correctionDate);
      if (action.endAt) body.endAt = replaceIsoDate(action.endAt, correctionDate);
    }
    if (note) body.notes = note;
    if (preparations.length) body.preparations = preparations;
    return body;
  }

  if (parsedTitle && !/(备注|带|准备|不是|改成|改到)/.test(text)) body.title = parsedTitle;
  if (parsedDueAt) body.dueAt = correctionDate ? replaceIsoDate(parsedDueAt, correctionDate) : parsedDueAt;
  if (!parsedDueAt && correctionDate && action.startAt) body.dueAt = replaceIsoDate(action.startAt, correctionDate);
  if (note) body.notes = note;
  if (preparations.length) body.preparations = preparations;
  return body;
}

function inferCorrectionDate(text: string, fallbackDate?: string) {
  const base = fallbackDate ? new Date(`${fallbackDate}T12:00:00`) : new Date();
  if (/今天/.test(text)) return toLocalDateText(base);
  if (/明天/.test(text)) {
    const date = new Date(base);
    date.setDate(base.getDate() + 1);
    return toLocalDateText(date);
  }
  if (/后天/.test(text)) {
    const date = new Date(base);
    date.setDate(base.getDate() + 2);
    return toLocalDateText(date);
  }
  const weekMatch = text.match(/(下周|下个星期|这周|本周)?(?:周|星期)([一二三四五六日天])/);
  if (!weekMatch) return undefined;
  const targetDay = '日一二三四五六'.indexOf(weekMatch[2] === '天' ? '日' : weekMatch[2]);
  const weekStart = getWeekStart(base);
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + (targetDay === 0 ? 6 : targetDay - 1));
  if (/下周|下个星期/.test(weekMatch[1] ?? '')) date.setDate(date.getDate() + 7);
  return toLocalDateText(date);
}

function replaceIsoDate(value: string, dateText: string) {
  const date = new Date(value);
  const [year, month, day] = dateText.split('-').map(Number);
  date.setFullYear(year, month - 1, day);
  return date.toISOString();
}

function extractSimpleNote(text: string) {
  const noteMatch = text.match(/(?:备注|说明|注意)[：:，, ]*(.+)$/);
  if (noteMatch?.[1]) return noteMatch[1].trim();
  return '';
}

function extractSimplePreparations(text: string) {
  const match = text.match(/(?:带上|带|准备)[：:，, ]*(.+)$/);
  if (!match?.[1]) return [];
  return splitPreparations(match[1].replace(/^一个|^一下/, '').trim());
}

function mergeText(current = '', next = '') {
  const value = next.trim();
  if (!value) return current;
  if (!current.trim()) return value;
  if (current.includes(value)) return current;
  return `${current.trim()}\n${value}`;
}

function mergeList(current: string[], next: string[]) {
  return Array.from(new Set([...current, ...next].map((item) => item.trim()).filter(Boolean)));
}

function buildInputForCommit(text: string, pending: ParseResult | null, decision: ParseResult | null = null) {
  if (decision && !text) return decision.rawText;
  if (!pending) return text;
  if (!text) return '';
  return `${pending.rawText}，补充信息：${text}`;
}

function getPlanDraft(result: ParseResult): PlanDraft | null {
  if (result.draft) return result.draft;
  const draft = result.preview.draft;
  return isPlanDraft(draft) ? draft : null;
}

function getBatchOperation(result: ParseResult): BatchOperationPreview | null {
  if (result.batchOperation) return result.batchOperation;
  const batch = result.preview.batchOperation;
  return isBatchOperationPreview(batch) ? batch : null;
}

function isPlanDraft(value: unknown): value is PlanDraft {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as PlanDraft).items));
}

function isBatchOperationPreview(value: unknown): value is BatchOperationPreview {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as BatchOperationPreview).candidates));
}

function getDraftKindLabel(kind: PlanDraftItem['kind'] | CandidateItem['kind']) {
  const labels: Record<string, string> = {
    event: '日程',
    task: '待办',
    reminder: '提醒',
    profile_update: '画像',
    habit_rule: '周期',
    project: '项目',
    profile: '画像'
  };
  return labels[kind] ?? '候选';
}

function getBatchActionLabel(action: BatchOperationPreview['action']) {
  const labels: Record<BatchOperationPreview['action'], string> = {
    delete: '删除',
    update_time: '移动时间',
    move_project: '移动项目',
    move_date: '移动日期',
    update_status: '修改状态'
  };
  return labels[action];
}

function getShortTitle(title: string) {
  const normalized = title
    .replace(/^我要?/, '')
    .replace(/^要去/, '')
    .replace(/^去/, '')
    .replace(/^需要/, '')
    .replace(/^今天/, '')
    .replace(/^今晚/, '')
    .replace(/^(上午|下午|晚上|早上|中午)/, '')
    .replace(/的?安排$/, '')
    .trim();

  if (/健身房|健身|训练|运动/.test(normalized)) return '健身';
  if (normalized.includes('开会') || normalized.includes('会议')) return '开会';
  if (normalized.includes('上课') || normalized.includes('课程')) return '上课';
  if (normalized.includes('面试')) return '面试';
  if (/(skill|技能|规则|prompt|提示词)/i.test(normalized) && /(改|修|重构|更新|沉淀|优化)/.test(normalized)) return normalized.includes('重构') ? '重构' : '改skill';
  if (/重构我/.test(normalized)) return '重构';
  if (/(重构|重写|改造)/.test(normalized)) return '重构';
  if (/(修改|改一下|改改|修一下|修复)/.test(normalized)) return '修改';
  if (/(优化|精修|打磨)/.test(normalized)) return '优化';
  if (normalized.includes('吃饭') || normalized.includes('晚饭') || normalized.includes('午饭')) return '吃饭';
  if (normalized.includes('睡觉') || normalized.includes('休息')) return '休息';
  if (normalized.includes('写') && normalized.includes('简历')) return '简历';
  if (normalized.includes('调试') || normalized.includes('测试')) return '调试';
  if (normalized.includes('提醒')) return normalized.replace(/.*提醒我?/, '').slice(0, 8) || '提醒';
  if (normalized.length <= 3) return normalized || title.slice(0, 3);
  return normalized.slice(0, 3);
}

function getUnderstandingRows(result: ParseResult) {
  const draft = getPlanDraft(result);
  if (draft) {
    return [
      { label: '标题', value: '整组草稿' },
      { label: '具体内容', value: `${draft.items.length} 项草稿：${draft.items.map((item) => item.title).slice(0, 4).join('、')}` }
    ];
  }
  const batch = getBatchOperation(result);
  if (batch) {
    return [
      { label: '标题', value: '批量候选清单' },
      { label: '具体内容', value: `${batch.candidates.length} 个候选，动作：${getBatchActionLabel(batch.action)}` }
    ];
  }
  const fields = result.fields;
  const rows: Array<{ label: string; value: string }> = [];
  const title = typeof fields.title === 'string' ? fields.title : undefined;
  const note = typeof fields.note === 'string' ? fields.note : undefined;
  const purpose = typeof fields.purpose === 'string' ? fields.purpose : undefined;
  const notes = typeof fields.notes === 'string' ? fields.notes : undefined;
  const startAt = typeof fields.startAt === 'string' ? fields.startAt : undefined;
  const endAt = typeof fields.endAt === 'string' ? fields.endAt : undefined;
  const remindAt = typeof fields.remindAt === 'string' ? fields.remindAt : undefined;
  const dueAt = typeof fields.dueAt === 'string' ? fields.dueAt : undefined;
  const estimatedMinutes = typeof fields.estimatedMinutes === 'number' ? fields.estimatedMinutes : undefined;
  const preparations = asStringArray(fields.preparations);

  rows.push({ label: '标题', value: summarizeScheduleTitle(result.intent, title || note || result.rawText || '新安排') });
  rows.push({
    label: '具体内容',
    value: buildScheduleDetailText({
      rawText: result.rawText,
      startAt: startAt ?? remindAt ?? dueAt,
      endAt,
      purpose,
      notes,
      estimatedMinutes
    })
  });
  if (preparations.length) rows.push({ label: '提前准备', value: preparations.join('\n') });
  return rows;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function formatPreviewTime(startAt?: string, endAt?: string) {
  if (!startAt) return '待定';
  const date = new Date(startAt);
  const dateText = `${date.getMonth() + 1}/${date.getDate()}`;
  return `${dateText} ${formatTimeRange(startAt, endAt)}`;
}

function summarizeScheduleTitle(intent: ParsedIntent, text: string) {
  const normalized = text.trim();
  if (/(面试|interview)/i.test(normalized)) return '面试';
  if (/(上课|课程|听课|讲座|课堂)/.test(normalized)) return '上课';
  if (/(开会|会议|会\b|沟通|讨论|复盘会)/.test(normalized)) return '开会';
  if (intent === 'add_reminder') return '提醒';
  if (intent === 'add_task') return '任务';
  return getShortTitle(normalized);
}

function buildScheduleDetailText({
  rawText,
  startAt,
  endAt,
  purpose,
  notes,
  estimatedMinutes
}: {
  rawText: string;
  startAt?: string;
  endAt?: string;
  purpose?: string;
  notes?: string;
  estimatedMinutes?: number;
}) {
  const location = extractLocationFromText(rawText);
  const rows = [
    startAt ? `时间：${formatPreviewTime(startAt, endAt)}` : '',
    location ? `地点：${location}` : '',
    `内容：${purpose || notes || cleanupSpokenDetail(rawText)}`,
    estimatedMinutes ? `预计：${estimatedMinutes} 分钟` : ''
  ].filter(Boolean);
  return rows.join('\n');
}

function extractLocationFromText(text: string) {
  const match = text.match(/(?:在|到|去)([^，。；;]+?)(?:开会|会议|上课|面试|见面|沟通|讨论|，|。|；|;|$)/);
  const value = match?.[1]?.trim();
  return value && value.length <= 18 ? value : undefined;
}

function cleanupSpokenDetail(text: string) {
  return text
    .replace(/^(嗯|呃|那个|就是|然后)+/, '')
    .replace(/[，。；;]\s*$/g, '')
    .trim() || text;
}

function getIntentLabel(intent: ParsedIntent) {
  const labels: Record<ParsedIntent, string> = {
    add_event: '日程 / 时间块',
    update_event: '修改日程',
    delete_event: '删除日程',
    annotate_event: '补充日程',
    add_task: '任务',
    start_work: '开始工作',
    pause_work: '暂停',
    resume_work: '继续',
    finish_work: '结束',
    progress_update: '进度',
    add_reminder: '提醒',
    review_note: '复盘',
    plan_draft: '整组草稿',
    batch_operation: '批量操作',
    profile_update: '画像 / 作息',
    habit_rule: '习惯周期'
  };
  return labels[intent];
}

function getPreviewText(result: ParseResult) {
  if (result.needsConfirmation && result.questions[0]) return result.questions[0];
  const title = result.fields.title;
  const note = result.fields.note;
  const remindAt = result.fields.remindAt;
  const startAt = result.fields.startAt;
  const endAt = result.fields.endAt;

  if (typeof remindAt === 'string') return `${String(title || '提醒')} · ${formatTimeRange(remindAt)}`;
  if (typeof startAt === 'string') return `${String(title || '安排')} · ${formatTimeRange(startAt, typeof endAt === 'string' ? endAt : undefined)}`;
  if (typeof title === 'string') return title;
  if (typeof note === 'string') return note;
  return '准备记录';
}

function getConflictOptions(result: ParseResult) {
  const options = result.preview.options;
  if (!Array.isArray(options)) return [];
  return options.filter(isConflictOption);
}

function isConflictOption(value: unknown): value is ConflictOption {
  if (!value || typeof value !== 'object') return false;
  const option = value as Record<string, unknown>;
  return typeof option.id === 'string' && typeof option.title === 'string';
}

function getCommitMessage(result?: ParseResult, resolvedBy?: string, feedback?: string) {
  if (feedback) return feedback;
  if (!result) return '记下来了，安排先放进口袋。';
  if (resolvedBy === 'confirm-draft') return '整组草稿已确认写入。';
  if (resolvedBy === 'cancel-draft') return '草稿已取消，没有写入正式数据。';
  if (resolvedBy === 'hold-draft') return '已先放进待定草稿，没有写入正式日程。';
  if (resolvedBy === 'execute-batch') return '批量操作已执行。';
  if (resolvedBy === 'profile-update') return '画像和作息已更新。';
  if (resolvedBy === 'save-pending') return '已放进待补充事项。';
  if (resolvedBy === 'keep-both') return '已重叠新增。';
  if (resolvedBy === 'task-split') return '任务先记成待拆分。';
  if (resolvedBy === 'defer-tomorrow') return '任务已经改到明天。';
  if (resolvedBy === 'duplicate-add') return '已继续新增这条任务。';
  if (resolvedBy === 'skip-duplicate') return '好，先保留已有任务，不重复记录。';
  if (result.needsConfirmation && result.questions[0]) return result.questions[0];

  const messages: Record<ParsedIntent, string> = {
    add_event: '日程已经排进一周安排。',
    update_event: '日程修改好了。',
    delete_event: '日程已删除。',
    annotate_event: '日程补充好了。',
    add_task: '任务记好了，先放进今日/待办里。',
    start_work: '开工啦，我会帮你留下执行脚印。',
    pause_work: '暂停记下来了，先缓一口气。',
    resume_work: '继续工作已记录，节奏接回来了。',
    finish_work: '结束记录好了，今天又往前推了一点。',
    progress_update: '进度记下来了，后面重排会用上。',
    add_reminder: '提醒设好了，到点会在这里冒出来。',
    review_note: '复盘原因收好了，下次计划会更贴近现实。',
    plan_draft: '整组草稿已准备好。',
    batch_operation: '批量候选已准备好。',
    profile_update: '画像和作息已更新。',
    habit_rule: '周期安排已准备好。'
  };
  return messages[result.intent];
}


