'use client'

import { ChatProvider } from './chat-provider'
import { GlobalChatWidget } from './global-chat-widget'
import { ReactNode } from 'react'

/**
 * Wrapper component to provide chat context and widget
 * Used in server components (like layout.tsx) to enable client-side chat functionality
 */
export function ChatWrapper({ children }: { children: ReactNode }) {
  return (
    <ChatProvider>
      {children}
      <GlobalChatWidget />
    </ChatProvider>
  )
}

