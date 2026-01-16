import { create } from 'zustand'
import { GenerationSession, GenerationProgress } from '@/types'

const STORAGE_KEY = 'ppt-creator-session-ids'

interface GenerationState {
  // 当前生成状态
  isGenerating: boolean
  currentProgress: GenerationProgress | null
  currentSessionId: string | null

  // 会话ID列表（只存储ID，数据从服务器获取）
  sessionIds: string[]

  // 会话缓存（内存中）
  sessionCache: Map<string, GenerationSession>

  // Actions
  updateProgress: (progress: GenerationProgress) => void
  setCurrentSession: (sessionId: string) => void
  setError: (message: string) => void
  reset: () => void

  // 会话ID操作
  loadSessionIds: () => void
  addSessionId: (id: string) => void
  removeSessionId: (id: string) => void
  clearSessionIds: () => void

  // 会话数据操作
  fetchSession: (id: string) => Promise<GenerationSession | null>
  fetchAllSessions: () => Promise<GenerationSession[]>
  cacheSession: (session: GenerationSession) => void
  getCachedSession: (id: string) => GenerationSession | undefined
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  isGenerating: false,
  currentProgress: null,
  currentSessionId: null,
  sessionIds: [],
  sessionCache: new Map(),

  updateProgress: (progress) => {
    set({ currentProgress: progress })
  },

  setCurrentSession: (sessionId) => {
    set({ currentSessionId: sessionId })
  },

  setError: (message) => {
    set({
      isGenerating: false,
      currentProgress: {
        stage: 'error',
        progress: 0,
        message,
      },
    })
  },

  reset: () => {
    set({
      isGenerating: false,
      currentProgress: null,
      currentSessionId: null,
    })
  },

  loadSessionIds: () => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        set({ sessionIds: JSON.parse(stored) })
      }
    } catch (error) {
      console.error('Failed to load session IDs:', error)
    }
  },

  addSessionId: (id) => {
    const { sessionIds } = get()
    if (sessionIds.includes(id)) return
    const newIds = [id, ...sessionIds]
    set({ sessionIds: newIds })
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds))
    }
  },

  removeSessionId: (id) => {
    const { sessionIds, sessionCache } = get()
    const newIds = sessionIds.filter((sid) => sid !== id)
    sessionCache.delete(id)
    set({ sessionIds: newIds, sessionCache: new Map(sessionCache) })
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds))
    }
  },

  clearSessionIds: () => {
    set({ sessionIds: [], sessionCache: new Map() })
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  },

  fetchSession: async (id) => {
    // 先检查缓存
    const { sessionCache, cacheSession } = get()
    const cached = sessionCache.get(id)
    if (cached) return cached

    try {
      const response = await fetch(`/api/session/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          // 会话不存在，从ID列表中移除
          get().removeSessionId(id)
          return null
        }
        throw new Error('Failed to fetch session')
      }
      const session: GenerationSession = await response.json()
      cacheSession(session)
      return session
    } catch (error) {
      console.error('Failed to fetch session:', error)
      return null
    }
  },

  fetchAllSessions: async () => {
    const { sessionIds, fetchSession } = get()
    const sessions: GenerationSession[] = []

    // 并行获取所有会话，过滤掉不存在的
    const results = await Promise.all(
      sessionIds.map((id) => fetchSession(id))
    )

    for (const session of results) {
      if (session) {
        sessions.push(session)
      }
    }

    return sessions
  },

  cacheSession: (session) => {
    const { sessionCache } = get()
    sessionCache.set(session.id, session)
    set({ sessionCache: new Map(sessionCache) })
  },

  getCachedSession: (id) => {
    const { sessionCache } = get()
    return sessionCache.get(id)
  },
}))
