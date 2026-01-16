import { promises as fs } from 'fs';
import path from 'path';
import { GenerationSession, GenerationStage } from '@/types';

// 会话存储目录
const SESSIONS_DIR = path.join(process.cwd(), '.sessions');

// 确保目录存在
async function ensureDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch {
    // 目录已存在
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
  duration: number
): Promise<GenerationSession> {
  await ensureDir();

  const session: GenerationSession = {
    id,
    topic,
    language,
    duration,
    stage: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    getSessionPath(id),
    JSON.stringify(session, null, 2),
    'utf-8'
  );

  return session;
}

/**
 * 获取会话
 */
export async function getSession(id: string): Promise<GenerationSession | null> {
  try {
    const content = await fs.readFile(getSessionPath(id), 'utf-8');
    return JSON.parse(content) as GenerationSession;
  } catch {
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
