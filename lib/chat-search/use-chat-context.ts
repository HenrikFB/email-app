'use client'

import { useEffect, useRef } from 'react'
import { useChat, ChatPageContext } from '@/components/chat'

// ============================================
// Types
// ============================================

/**
 * Options for the useChatContext hook
 */
interface UseChatContextOptions {
  /** Whether to clear context on unmount */
  clearOnUnmount?: boolean
}

// ============================================
// Hook
// ============================================

/**
 * Hook to register page context for the global chat widget
 * 
 * @example
 * // In a results page
 * useChatContext({
 *   pageType: 'results',
 *   agentConfigId: selectedAgent?.id,
 *   agentConfigName: selectedAgent?.name,
 *   currentEmailId: selectedEmail?.id,
 *   currentEmailSubject: selectedEmail?.email_subject,
 *   currentEmailExtractedData: selectedEmail?.extracted_data,
 * })
 */
export function useChatContext(
  context: ChatPageContext,
  options: UseChatContextOptions = {}
) {
  const { clearOnUnmount = true } = options
  const { setPageContext, clearPageContext } = useChat()
  const isInitialMount = useRef(true)
  
  // Update context when it changes
  useEffect(() => {
    // Filter out undefined values to avoid overwriting with empty data
    const filteredContext = Object.fromEntries(
      Object.entries(context).filter(([, v]) => v !== undefined)
    ) as ChatPageContext
    
    // Only update if we have meaningful context
    if (Object.keys(filteredContext).length > 0) {
      setPageContext(filteredContext)
    }
  }, [
    context.pageType,
    context.agentConfigId,
    context.agentConfigName,
    context.currentEmailId,
    context.currentEmailSubject,
    context.currentKBId,
    context.currentKBName,
    JSON.stringify(context.assignedKBIds),
    JSON.stringify(context.currentEmailExtractedData),
    setPageContext,
  ])
  
  // Clear context on unmount
  useEffect(() => {
    isInitialMount.current = false
    
    return () => {
      if (clearOnUnmount && !isInitialMount.current) {
        clearPageContext()
      }
    }
  }, [clearOnUnmount, clearPageContext])
}

// ============================================
// Utility Functions
// ============================================

/**
 * Build context from an analyzed email
 */
export function buildEmailContext(email: {
  id: string
  email_subject?: string
  extracted_data?: Record<string, unknown>
  agent_configuration_id?: string
}, agentConfig?: {
  id: string
  name: string
}): ChatPageContext {
  return {
    pageType: 'results',
    currentEmailId: email.id,
    currentEmailSubject: email.email_subject,
    currentEmailExtractedData: email.extracted_data,
    agentConfigId: agentConfig?.id || email.agent_configuration_id,
    agentConfigName: agentConfig?.name,
  }
}

/**
 * Build context from a knowledge base
 */
export function buildKBContext(kb: {
  id: string
  name: string
}, assignedAgentConfigId?: string): ChatPageContext {
  return {
    pageType: 'knowledge-base',
    currentKBId: kb.id,
    currentKBName: kb.name,
    agentConfigId: assignedAgentConfigId,
  }
}

