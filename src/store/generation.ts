import { create } from 'zustand'

const STORAGE_KEY = 'ppt-creator-session-ids'

interface GenerationState {
  // 会话ID列表（只存储ID，数据从服务器获取）
  sessionIds: string[]

  // 会话ID操作
  loadSessionIds: () => void
  addSessionId: (id: string) => void
  removeSessionId: (id: string) => void
  clearSessionIds: () => void
}

export const useGenerationStore = create<GenerationState>((set) => ({
  sessionIds: [],

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
    if (typeof window === 'undefined') return

    // 从 localStorage 读取最新数据，避免覆盖已有的 IDs
    let currentIds: string[] = []
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        currentIds = JSON.parse(stored)
      }
    } catch {
      // 解析失败，使用空数组
    }

    if (currentIds.includes(id)) return
    const newIds = [id, ...currentIds]
    set({ sessionIds: newIds })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds))
  },

  removeSessionId: (id) => {
    if (typeof window === 'undefined') return

    // 从 localStorage 读取最新数据
    let currentIds: string[] = []
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        currentIds = JSON.parse(stored)
      }
    } catch {
      // 解析失败，使用空数组
    }

    const newIds = currentIds.filter((sid) => sid !== id)
    set({ sessionIds: newIds })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds))
  },

  clearSessionIds: () => {
    set({ sessionIds: [] })
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  },
}))

// 工具函数：直接从服务器获取会话数据
export async function fetchSession(id: string) {
  try {
    const response = await fetch(`/api/session/${id}`)
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Session ${id} not found on server`)
        return null
      }
      throw new Error('Failed to fetch session')
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch session:', error)
    return null
  }
}

// 工具函数：批量获取会话数据
export async function fetchSessions(ids: string[]) {
  const results = await Promise.all(ids.map((id) => fetchSession(id)))
  return results.filter((session) => session !== null)
}

// 会话摘要类型（与服务端 SessionSummary 对应）
export interface SessionSummary {
  id: string
  topic: string
  language: 'zh-CN' | 'en-US'
  mode: 'dsl' | 'image'
  theme?: string
  stage: string
  error?: string
  createdAt: string
  updatedAt: string
  hasContent: boolean
}

// 工具函数：批量获取会话摘要（轻量级，用于列表展示）
export async function fetchSessionSummaries(ids: string[]): Promise<SessionSummary[]> {
  if (ids.length === 0) return []

  try {
    const response = await fetch('/api/session/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    if (!response.ok) {
      throw new Error('Failed to fetch session summaries')
    }

    const data = await response.json()
    return data.sessions || []
  } catch (error) {
    console.error('Failed to fetch session summaries:', error)
    return []
  }
}
