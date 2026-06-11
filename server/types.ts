export type SourceType = 'text' | 'voice' | 'manual' | 'system';

export type EventRecord = {
  id: string;
  type: 'meeting' | 'task_block' | 'life' | 'exercise' | 'meal' | 'rest' | 'risk' | 'other';
  title: string;
  date: string;
  startAt?: string;
  endAt?: string;
  purpose?: string;
  preparations?: string[];
  notes?: string;
  reminderIds?: string[];
  status: 'scheduled' | 'done' | 'cancelled' | 'missed' | 'moved';
  linkedTaskId: string | null;
  tags: string[];
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'paused' | 'done' | 'partially_done' | 'cancelled' | 'deferred';
  priority: 'low' | 'medium' | 'high';
  dueAt: string | null;
  estimatedMinutes: number | null;
  preparations?: string[];
  notes?: string;
  actualMinutes: number;
  linkedEventIds: string[];
  goalId: string | null;
  projectId?: string | null;
  tags: string[];
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type TodoProjectRecord = {
  id: string;
  title: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type WorkLogRecord = {
  id: string;
  taskId: string | null;
  eventId: string | null;
  action: 'start' | 'pause' | 'resume' | 'progress' | 'finish' | 'interrupt';
  note: string;
  at: string;
  status?: 'active' | 'deleted';
  feedbackType?: 'recorded' | 'progress' | 'completed' | 'deferred' | 'review';
  mood?: 'gentle' | 'steady' | 'celebrating';
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type ReminderRecord = {
  id: string;
  title: string;
  remindAt: string;
  status: 'pending' | 'triggered' | 'done' | 'dismissed' | 'missed';
  importance: 'low' | 'normal' | 'high';
  linkedTaskId: string | null;
  relatedType?: 'task' | 'event' | 'day' | 'general';
  relatedId?: string | null;
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewRecord = {
  id: string;
  targetType: 'task' | 'event' | 'day' | 'general';
  targetId: string | null;
  reasonType:
    | 'underestimated_time'
    | 'interrupted'
    | 'low_energy'
    | 'planned_rest'
    | 'procrastination'
    | 'scope_changed'
    | 'other';
  note: string;
  lesson: string;
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalRecord = {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'done' | 'cancelled';
  startDate: string;
  targetDate: string | null;
  milestones: Array<{
    id: string;
    title: string;
    status: 'todo' | 'in_progress' | 'done';
  }>;
  linkedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProfileData = {
  timeHabits: {
    highFocusWindows: string[];
    lowEnergyWindows: string[];
    commonDelayWindows: string[];
  };
  estimationPatterns: {
    oftenUnderestimatedTags: string[];
    bufferRules: string[];
  };
  lifeRhythm: {
    regularMeals: string[];
    exercisePreferences: string[];
    restPatterns: string[];
  };
  workPreferences: {
    focusStyle: string;
    preferredTaskOrder: string;
    encouragementStyle: string;
  };
  signals: string[];
  updatedAt: string;
};

export type ParsedIntent =
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
  | 'review_note';

export type ParseResult = {
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
};
