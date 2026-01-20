import { promises as fs } from 'fs';
import path from 'path';
import { GenerationSession, GenerationStage, GenerationMode, ThemeName } from '@/types';

// 会话存储目录
// Vercel 等无服务器环境只有 /tmp 可写
// 本地开发使用 .sessions 目录
function getSessionsDir(): string {
  // 检测 Vercel 环境
  if (process.env.VERCEL) {
    return '/tmp/.sessions';
  }
  // 检测其他只读文件系统环境
  if (process.env.SERVERLESS || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.EDGE) {
    return '/tmp/.sessions';
  }
  // EdgeOne 等边缘计算环境
  if (process.env.EDGE_RUNTIME || process.env.TENCLOUD) {
    return '/tmp/.sessions';
  }
  // 本地开发环境
  return path.join(process.cwd(), '.sessions');
}

const SESSIONS_DIR = getSessionsDir();

// 确保目录存在
async function ensureDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create sessions directory:', SESSIONS_DIR, error);
  }
}

// 获取会话文件路径
function getSessionPath(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

/**
 * 创建新会话
 */
export async function createSession(
  id: string,
  topic: string,
  language: 'zh-CN' | 'en-US',
  mode: GenerationMode = 'dsl',
  theme?: ThemeName
): Promise<GenerationSession> {
  await ensureDir();

  const session: GenerationSession = {
    id,
    topic,
    language,
    mode,
    theme,
    stage: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await fs.writeFile(
      getSessionPath(id),
      JSON.stringify(session, null, 2),
      'utf-8'
    );
    console.log('Session created:', id, 'at', getSessionPath(id));
  } catch (error) {
    console.error('Failed to write session file:', id, error);
    throw new Error('Failed to persist session. File system may be read-only.');
  }

  return session;
}

/**
 * 获取会话
 */
export async function getSession(id: string): Promise<GenerationSession | null> {
  try {
    const content = await fs.readFile(getSessionPath(id), 'utf-8');
    if (!content || content.trim() === '') {
      console.error('Session file is empty:', id);
      return null;
    }
    return JSON.parse(content) as GenerationSession;
  } catch (error) {
    console.error('Failed to read session:', id, error);
    return null;
  }
}

/**
 * 更新会话
 */
export async function updateSession(
  id: string,
  updates: Partial<GenerationSession>
): Promise<GenerationSession | null> {
  const session = await getSession(id);
  if (!session) return null;

  const updated: GenerationSession = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    getSessionPath(id),
    JSON.stringify(updated, null, 2),
    'utf-8'
  );

  return updated;
}

/**
 * 更新会话阶段
 */
export async function updateSessionStage(
  id: string,
  stage: GenerationStage,
  error?: string
): Promise<GenerationSession | null> {
  return updateSession(id, { stage, error });
}

/**
 * 删除会话
 */
export async function deleteSession(id: string): Promise<boolean> {
  try {
    await fs.unlink(getSessionPath(id));
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取所有会话（用于调试/管理）
 */
export async function getAllSessions(): Promise<GenerationSession[]> {
  await ensureDir();

  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions: GenerationSession[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(
            path.join(SESSIONS_DIR, file),
            'utf-8'
          );
          sessions.push(JSON.parse(content));
        } catch {
          // 跳过无效文件
        }
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * 会话摘要（用于列表展示，不包含大型数据）
 */
export interface SessionSummary {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  mode: GenerationMode
  theme?: ThemeName
  stage: GenerationStage
  error?: string
  createdAt: string
  updatedAt: string
  // 只包含是否有内容的标记，不包含实际内容
  hasContent: boolean
}

/**
 * 获取会话摘要（不包含 dslPresentation 和 imagePresentation）
 */
export async function getSessionSummary(id: string): Promise<SessionSummary | null> {
  const session = await getSession(id)
  if (!session) return null

  return {
    id: session.id,
    topic: session.topic,
    language: session.language,
    mode: session.mode,
    theme: session.theme,
    stage: session.stage,
    error: session.error,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    hasContent: session.mode === 'image'
      ? !!(session.imagePresentation?.slides?.length)
      : !!(session.dslPresentation?.slides?.length),
  }
}

/**
 * 批量获取会话摘要
 */
export async function getSessionsSummary(ids: string[]): Promise<SessionSummary[]> {
  const summaries = await Promise.all(ids.map(id => getSessionSummary(id)))
  return summaries.filter((s): s is SessionSummary => s !== null)
}

/**
 * 清理过期会话（超过24小时）
 */
export async function cleanupOldSessions(): Promise<number> {
  const sessions = await getAllSessions();
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24小时
  let cleaned = 0;

  for (const session of sessions) {
    const age = now - new Date(session.createdAt).getTime();
    if (age > maxAge) {
      await deleteSession(session.id);
      cleaned++;
    }
  }

  return cleaned;
}
