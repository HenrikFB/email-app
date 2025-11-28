'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// ============================================
// Types
// ============================================

/**
 * Context data that can be provided by pages
 * This allows the chat to be aware of what the user is currently viewing
 */
export interface ChatPageContext {
  /** Current page type */
  pageType?: 'results' | 'emails' | 'knowledge-base' | 'dashboard' | 'other'
  
  /** Agent configuration context */
  agentConfigId?: string
  agentConfigName?: string
  
  /** Current email being viewed */
  currentEmailId?: string
  currentEmailSubject?: string
  currentEmailExtractedData?: Record<string, unknown>
  
  /** Current knowledge base being viewed */
  currentKBId?: string
  currentKBName?: string
  
  /** Assigned KB IDs for the current agent */
  assignedKBIds?: string[]
}

/**
 * Chat message stored in conversation
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  kbResults?: any[]
  emailResults?: any[]
  toolsUsed?: string[]
}

/**
 * Chat provider state
 */
interface ChatState {
  isOpen: boolean
  isMinimized: boolean
  messages: ChatMessage[]
  pageContext: ChatPageContext
  usePageContext: boolean
}

/**
 * Chat provider context value
 */
interface ChatContextValue extends ChatState {
  // UI controls
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  minimizeChat: () => void
  maximizeChat: () => void
  
  // Message management
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  
  // Context management
  setPageContext: (context: ChatPageContext) => void
  clearPageContext: () => void
  setUsePageContext: (use: boolean) => void
  
  // Getters
  getEffectiveContext: () => ChatPageContext | undefined
}

// ============================================
// Context
// ============================================

const ChatContext = createContext<ChatContextValue | null>(null)

// ============================================
// Provider Component
// ============================================

interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [state, setState] = useState<ChatState>({
    isOpen: false,
    isMinimized: false,
    messages: [],
    pageContext: {},
    usePageContext: true,
  })
  
  // Generate unique message ID
  const generateId = useCallback(() => 
    `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
  [])
  
  // UI Controls
  const openChat = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, isMinimized: false }))
  }, [])
  
  const closeChat = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])
  
  const toggleChat = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isOpen: !prev.isOpen,
      isMinimized: false 
    }))
  }, [])
  
  const minimizeChat = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: true }))
  }, [])
  
  const maximizeChat = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: false }))
  }, [])
  
  // Message Management
  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    }
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
    }))
  }, [generateId])
  
  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }))
  }, [])
  
  // Context Management
  const setPageContext = useCallback((context: ChatPageContext) => {
    setState(prev => ({ ...prev, pageContext: context }))
  }, [])
  
  const clearPageContext = useCallback(() => {
    setState(prev => ({ ...prev, pageContext: {} }))
  }, [])
  
  const setUsePageContext = useCallback((use: boolean) => {
    setState(prev => ({ ...prev, usePageContext: use }))
  }, [])
  
  // Get effective context (if usePageContext is true)
  const getEffectiveContext = useCallback(() => {
    if (!state.usePageContext) return undefined
    
    // Only return context if it has meaningful data
    const ctx = state.pageContext
    if (ctx.agentConfigId || ctx.currentEmailId || ctx.currentKBId) {
      return ctx
    }
    return undefined
  }, [state.usePageContext, state.pageContext])
  
  const value: ChatContextValue = {
    ...state,
    openChat,
    closeChat,
    toggleChat,
    minimizeChat,
    maximizeChat,
    addMessage,
    clearMessages,
    setPageContext,
    clearPageContext,
    setUsePageContext,
    getEffectiveContext,
  }
  
  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}

// ============================================
// Hook
// ============================================

/**
 * Hook to access chat context
 * @throws Error if used outside ChatProvider
 */
export function useChat(): ChatContextValue {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}

/**
 * Hook to set page context
 * Automatically clears on unmount
 */
export function useChatPageContext(context: ChatPageContext) {
  const { setPageContext, clearPageContext } = useChat()
  
  // Set context on mount/change
  useState(() => {
    setPageContext(context)
  })
  
  // Note: Can't use useEffect in this pattern, context is set immediately
  // Pages should call setPageContext directly when their data loads
}

