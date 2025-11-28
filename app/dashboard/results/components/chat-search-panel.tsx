'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Send,
  Bot,
  User,
  Database,
  Mail,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
} from 'lucide-react'
import { handleChatSearch } from '../actions'

// ============================================
// Types
// ============================================

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  kbResults?: KBResult[]
  emailResults?: EmailResult[]
  toolsUsed?: string[]
}

interface KBResult {
  chunk_id: string
  document_id: string
  document_title: string
  document_type: string
  kb_name: string
  content: string
  similarity: number
  chunk_index: number
  context_tags?: string[]
}

interface EmailResult {
  email_id: string
  email_subject: string
  email_from: string
  matched: boolean
  similarity: number
  content_type: string
  source_url?: string
  embedded_text: string
}

interface ChatSearchPanelProps {
  agentConfigId?: string
  currentEmailId?: string
  initialContext?: {
    extracted_data?: Record<string, unknown>
    email_subject?: string
    email_from?: string
  }
  onClose?: () => void
}

// ============================================
// Component
// ============================================

export default function ChatSearchPanel({
  agentConfigId,
  currentEmailId,
  initialContext,
  onClose,
}: ChatSearchPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Generate suggested queries based on context
  const suggestions = useMemo(() => {
    if (!initialContext?.extracted_data) {
      return [
        'Find similar job postings',
        'Show my saved cover letters',
        'What jobs match my criteria?',
      ]
    }

    const data = initialContext.extracted_data
    const suggestions: string[] = []

    // Technology-based suggestion
    const techs = data.technologies as string[] | undefined
    if (techs?.length) {
      suggestions.push(`Find similar ${techs[0]} positions`)
    }

    // Company-based suggestion
    if (data.company) {
      suggestions.push(`Show my cover letters for ${data.company}`)
    }

    // Location-based suggestion
    if (data.location) {
      suggestions.push(`Jobs in ${data.location}`)
    }

    // Domain-based suggestion
    if (data.domain) {
      suggestions.push(`Other ${data.domain} positions`)
    }

    // Fallback
    if (suggestions.length === 0) {
      suggestions.push('Find similar positions')
      suggestions.push('Search knowledge base')
    }

    return suggestions.slice(0, 3)
  }, [initialContext])

  // Generate unique message ID
  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Handle message submission
  const handleSubmit = async (query: string) => {
    if (!query.trim() || loading) return

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: query.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Build conversation history (last 10 messages)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))

      // Call server action
      const result = await handleChatSearch(
        query.trim(),
        agentConfigId,
        currentEmailId,
        history
      )

      // Add assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: result.success
          ? result.response || 'Search completed.'
          : `Error: ${result.error || 'Something went wrong'}`,
        timestamp: new Date(),
        kbResults: result.kbResults,
        emailResults: result.emailResults,
        toolsUsed: result.toolsUsed,
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      // Add error message
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg bg-gradient-to-b from-slate-50 to-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">AI Search Assistant</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Context Banner */}
      {initialContext?.email_subject && (
        <div className="px-4 py-2 bg-indigo-50 border-b text-sm">
          <span className="text-indigo-700">
            Searching based on: <strong>{initialContext.email_subject}</strong>
          </span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <WelcomeScreen suggestions={suggestions} onSuggestionClick={handleSubmit} />
        )}

        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {loading && <LoadingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4 bg-white rounded-b-lg">
        <form
          onSubmit={e => {
            e.preventDefault()
            handleSubmit(input)
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about similar jobs, cover letters, or positions..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}

// ============================================
// Sub-components
// ============================================

function WelcomeScreen({
  suggestions,
  onSuggestionClick,
}: {
  suggestions: string[]
  onSuggestionClick: (query: string) => void
}) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
        <Bot className="w-8 h-8 text-indigo-600" />
      </div>
      <h4 className="text-lg font-medium text-gray-900 mb-2">
        How can I help you search?
      </h4>
      <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
        I can find similar content in your knowledge base and analyzed emails
        using AI-powered semantic search.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((suggestion, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            onClick={() => onSuggestionClick(suggestion)}
            className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const [showKBResults, setShowKBResults] = useState(true)
  const [showEmailResults, setShowEmailResults] = useState(true)

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-indigo-600" />
        </div>
      )}

      {/* Message Content */}
      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        <Card className={isUser ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white'}>
          <CardContent className="p-3">
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>

            {/* Tools Used Badge */}
            {message.toolsUsed && message.toolsUsed.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {message.toolsUsed.map((tool, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tool.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}

            {/* KB Results */}
            {message.kbResults && message.kbResults.length > 0 && (
              <Collapsible open={showKBResults} onOpenChange={setShowKBResults}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3 justify-between text-indigo-700 hover:bg-indigo-50"
                  >
                    <span className="flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Knowledge Base ({message.kbResults.length})
                    </span>
                    {showKBResults ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {message.kbResults.slice(0, 5).map((result, i) => (
                    <ResultCard
                      key={`kb-${i}`}
                      title={result.document_title}
                      subtitle={result.kb_name}
                      similarity={result.similarity}
                      preview={result.content}
                      badges={result.context_tags}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Email Results */}
            {message.emailResults && message.emailResults.length > 0 && (
              <Collapsible open={showEmailResults} onOpenChange={setShowEmailResults}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3 justify-between text-green-700 hover:bg-green-50"
                  >
                    <span className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Emails ({message.emailResults.length})
                    </span>
                    {showEmailResults ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {message.emailResults.slice(0, 5).map((result, i) => (
                    <ResultCard
                      key={`email-${i}`}
                      title={result.email_subject}
                      subtitle={result.email_from}
                      similarity={result.similarity}
                      preview={result.embedded_text}
                      badges={result.matched ? ['Matched'] : undefined}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>

        {/* Timestamp */}
        <p className={`text-xs mt-1 ${isUser ? 'text-right' : ''} text-gray-400`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-gray-600" />
        </div>
      )}
    </div>
  )
}

function ResultCard({
  title,
  subtitle,
  similarity,
  preview,
  badges,
}: {
  title: string
  subtitle?: string
  similarity?: number
  preview?: string
  badges?: string[]
}) {
  return (
    <div className="p-2 bg-gray-50 rounded-md border text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{title}</p>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
        {similarity !== undefined && (
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {Math.round(similarity * 100)}%
          </Badge>
        )}
      </div>
      {preview && (
        <p className="mt-1 text-xs text-gray-600 line-clamp-2">{preview}</p>
      )}
      {badges && badges.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {badges.slice(0, 3).map((badge, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {badge}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
      </div>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Searching</span>
            <span className="animate-pulse">...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

