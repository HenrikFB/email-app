'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  MessageSquare,
  X,
  Minus,
  Send,
  Bot,
  User,
  Database,
  Mail,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ExternalLink,
  FileText,
  Zap,
  Search,
  Type,
} from 'lucide-react'
import { useChat, type ChatMessage } from './chat-provider'
import { handleChatSearch } from '@/app/dashboard/results/actions'
import Link from 'next/link'

// ============================================
// Global Chat Widget
// ============================================

export function GlobalChatWidget() {
  const {
    isOpen,
    isMinimized,
    messages,
    pageContext,
    usePageContext,
    toggleChat,
    closeChat,
    minimizeChat,
    maximizeChat,
    addMessage,
    clearMessages,
    setUsePageContext,
    getEffectiveContext,
  } = useChat()
  
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isMinimized])
  
  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimized])
  
  // Get effective context
  const effectiveContext = getEffectiveContext()
  
  // Handle message submission
  const handleSubmit = async (query: string) => {
    if (!query.trim() || loading) return
    
    // Add user message
    addMessage({ role: 'user', content: query.trim() })
    setInput('')
    setLoading(true)
    
    try {
      // Build conversation history (last 10 messages)
      const history = messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      
      // Call server action with context
      const result = await handleChatSearch(
        query.trim(),
        effectiveContext?.agentConfigId,
        effectiveContext?.currentEmailId,
        history
      )
      
      // Add assistant message
      addMessage({
        role: 'assistant',
        content: result.success
          ? result.response || 'Search completed.'
          : `Error: ${result.error || 'Something went wrong'}`,
        kbResults: result.kbResults,
        emailResults: result.emailResults,
        toolsUsed: result.toolsUsed,
      })
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Floating button (when closed)
  if (!isOpen) {
    return (
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center group"
        aria-label="Open AI Search"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>
    )
  }
  
  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Card className="w-72 shadow-xl border-indigo-200">
          <div 
            className="flex items-center justify-between p-3 cursor-pointer bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-lg"
            onClick={maximizeChat}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-sm text-gray-900">AI Search</span>
              {messages.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {messages.length}
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); maximizeChat() }}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); closeChat() }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }
  
  // Full panel - positioned from top-right, resize handle at bottom-right expands down-left
  return (
    <div 
      className="fixed z-50 flex flex-col shadow-2xl rounded-lg"
      style={{ 
        top: '80px',
        right: '24px',
        width: '500px',
        height: '650px',
        minWidth: '350px', 
        minHeight: '400px', 
        maxWidth: '90vw', 
        maxHeight: 'calc(100vh - 100px)',
        resize: 'both',
        overflow: 'auto',
      }}
    >
      <Card className="flex flex-col h-full border-indigo-200 overflow-hidden" style={{ minHeight: '100%' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold">AI Search Assistant</span>
          </div>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={clearMessages}
              title="Clear conversation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={minimizeChat}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={closeChat}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Context Banner */}
        <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <button
              onClick={() => setUsePageContext(!usePageContext)}
              className="flex items-center gap-1 hover:text-indigo-600"
            >
              {usePageContext ? (
                <ToggleRight className="w-4 h-4 text-indigo-600" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-gray-400" />
              )}
              <span>Page context</span>
            </button>
            {usePageContext && effectiveContext && (
              <span className="text-indigo-600">
                • {effectiveContext.agentConfigName || effectiveContext.currentKBName || 'Active'}
              </span>
            )}
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-white">
          {messages.length === 0 && (
            <WelcomeMessage />
          )}
          
          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {loading && <LoadingBubble />}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div className="p-3 border-t bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit(input)
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button 
              type="submit" 
              disabled={loading || !input.trim()}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}

// ============================================
// Sub-components
// ============================================

function WelcomeMessage() {
  return (
    <div className="text-center py-8">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
        <Bot className="w-7 h-7 text-indigo-600" />
      </div>
      <p className="text-base font-medium text-gray-800 mb-2">
        AI Search Assistant
      </p>
      <p className="text-sm text-gray-500">
        Search across your knowledge bases and analyzed emails.
        <br />
        Just type your question below.
      </p>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const [showResults, setShowResults] = useState(true)
  const [selectedResult, setSelectedResult] = useState<any>(null)
  const [detailType, setDetailType] = useState<'kb' | 'email'>('kb')
  
  const hasResults = (message.kbResults?.length || 0) + (message.emailResults?.length || 0) > 0
  
  const openDetail = (result: any, type: 'kb' | 'email') => {
    setSelectedResult(result)
    setDetailType(type)
  }
  
  return (
    <>
      <div className={`flex gap-2 ${isUser ? 'justify-end' : ''}`}>
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
          </div>
        )}
        
        <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
          <div className={`rounded-lg px-3 py-2 text-sm ${
            isUser 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-100 text-gray-900'
          }`}>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          
          {/* Results with snippets */}
          {hasResults && (
            <Collapsible open={showResults} onOpenChange={setShowResults} className="mt-1">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                  {showResults ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                  {(message.kbResults?.length || 0) + (message.emailResults?.length || 0)} sources
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-2">
                {message.kbResults?.slice(0, 5).map((r, i) => (
                  <ResultCard 
                    key={`kb-${i}`} 
                    result={r}
                    type="kb"
                    onClick={() => openDetail(r, 'kb')}
                  />
                ))}
                {message.emailResults?.slice(0, 5).map((r, i) => (
                  <ResultCard 
                    key={`email-${i}`} 
                    result={r}
                    type="email"
                    onClick={() => openDetail(r, 'email')}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          <p className={`text-[10px] mt-0.5 ${isUser ? 'text-right' : ''} text-gray-400`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        
        {isUser && (
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-gray-600" />
          </div>
        )}
      </div>
      
      {/* Detail Modal */}
      <ResultDetailModal 
        result={selectedResult}
        type={detailType}
        onClose={() => setSelectedResult(null)}
      />
    </>
  )
}

/**
 * Result card with snippet and click to expand
 */
function ResultCard({ 
  result, 
  type,
  onClick
}: { 
  result: any
  type: 'kb' | 'email'
  onClick: () => void
}) {
  const isKB = type === 'kb'
  const title = isKB ? result.document_title : result.email_subject
  const subtitle = isKB ? result.kb_name : result.email_from
  const snippet = result.snippet || result.content?.substring(0, 150) || result.embedded_text?.substring(0, 150)
  const matchType = result.match_type as 'hybrid' | 'fulltext' | 'semantic' | undefined
  
  return (
    <div 
      className="p-2 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all text-xs"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isKB ? (
            <Database className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          ) : (
            <Mail className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          )}
          <span className="font-medium text-gray-900 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <MatchTypeBadge type={matchType} />
          <Badge variant="secondary" className="text-[10px] px-1">
            {Math.round((result.similarity || 0) * 100)}%
          </Badge>
        </div>
      </div>
      
      {/* Subtitle */}
      <p className="text-[10px] text-gray-500 mb-1.5 truncate">{subtitle}</p>
      
      {/* Snippet with highlights */}
      {snippet && (
        <div className="text-[11px] text-gray-600 line-clamp-2">
          <HighlightedSnippet text={snippet} />
        </div>
      )}
      
      {/* Click hint */}
      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-indigo-500">
        <ExternalLink className="w-3 h-3" />
        <span>Click to view full content</span>
      </div>
    </div>
  )
}

/**
 * Match type badge (hybrid/fulltext/semantic)
 */
function MatchTypeBadge({ type }: { type?: 'hybrid' | 'fulltext' | 'semantic' }) {
  if (!type) return null
  
  const config = {
    hybrid: { label: 'hybrid', icon: Zap, className: 'bg-purple-100 text-purple-700' },
    fulltext: { label: 'keyword', icon: Type, className: 'bg-blue-100 text-blue-700' },
    semantic: { label: 'semantic', icon: Search, className: 'bg-green-100 text-green-700' },
  }
  
  const { label, icon: Icon, className } = config[type]
  
  return (
    <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium ${className}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  )
}

/**
 * Render snippet with highlighted matches
 * Converts **** markers to styled spans
 */
function HighlightedSnippet({ text }: { text: string }) {
  // Split by **** markers and render with highlights
  const parts = text.split(/\*\*\*\*/g)
  
  return (
    <>
      {parts.map((part, i) => (
        i % 2 === 0 ? (
          <span key={i}>{part}</span>
        ) : (
          <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded font-medium">
            {part}
          </mark>
        )
      ))}
    </>
  )
}

/**
 * Detail modal for viewing full content
 * For KB results, fetches the full document (not just the chunk)
 */
function ResultDetailModal({ 
  result, 
  type,
  onClose 
}: { 
  result: any
  type: 'kb' | 'email'
  onClose: () => void
}) {
  const [fullDocument, setFullDocument] = useState<{ content: string; title: string } | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  
  const isKB = type === 'kb'
  const title = isKB ? result?.document_title : result?.email_subject
  const subtitle = isKB ? result?.kb_name : result?.email_from
  const snippet = result?.snippet
  const matchType = result?.match_type
  
  // Fetch full document for KB results
  // ALWAYS fetch document_id from kb_chunks to ensure we get the correct one
  // (The passed document_id might incorrectly be the chunk_id)
  
  useEffect(() => {
    if (result && isKB) {
      // Get chunk_id - this is what we have reliably
      const chunkId = result?.chunk_id || result?.id || result?.document_id
      
      console.log('🔍 Detail modal - fetching full document for chunk:', chunkId)
      
      if (chunkId) {
        setLoadingDoc(true)
        setFullDocument(null)
        
        // ALWAYS look up the real document_id from kb_chunks table
        // This ensures we get the correct document, not the chunk
        import('@/lib/supabase/client').then(({ createClient }) => {
          const supabase = createClient()
          
          // Step 1: Get the real document_id from the chunk
          supabase
            .from('kb_chunks')
            .select('document_id')
            .eq('id', chunkId)
            .single()
            .then(({ data: chunkData, error: chunkError }) => {
              if (chunkData?.document_id && !chunkError) {
                const realDocumentId = chunkData.document_id
                console.log('📄 Real document_id from chunk lookup:', realDocumentId)
                
                // Step 2: Fetch the full document content
                supabase
                  .from('kb_documents')
                  .select('content, title')
                  .eq('id', realDocumentId)
                  .single()
                  .then(({ data: docData, error: docError }) => {
                    if (docData && !docError) {
                      console.log('✅ Full document loaded:', docData.title, `(${docData.content?.length} chars)`)
                      setFullDocument(docData)
                    } else {
                      console.error('❌ Error fetching document:', realDocumentId, docError)
                    }
                    setLoadingDoc(false)
                  })
              } else {
                console.error('❌ Error looking up chunk:', chunkId, chunkError)
                setLoadingDoc(false)
              }
            })
        })
      } else {
        setFullDocument(null)
        console.log('⚠️ No chunk_id found in result')
      }
    } else {
      setFullDocument(null)
    }
  }, [result, isKB])
  
  if (!result) return null
  
  // Use full document content if available, otherwise chunk content
  const displayContent = isKB 
    ? (fullDocument?.content || result?.content || result?.fullContent || '')
    : (result?.embedded_text || result?.fullContent || '')
  
  // Navigation link - knowledge_base_id is now at top level
  const kbId = result?.knowledge_base_id || result?.metadata?.knowledge_base_id
  const docId = result?.document_id || result?.metadata?.document_id
  const navLink = isKB && kbId
    ? `/dashboard/knowledge-base/${kbId}${docId ? `?doc=${docId}` : ''}`
    : null
  
  return (
    <Dialog open={!!result} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              {isKB ? (
                <Database className="w-5 h-5 text-indigo-500 flex-shrink-0" />
              ) : (
                <Mail className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <DialogTitle className="text-lg truncate">{title}</DialogTitle>
                <p className="text-sm text-gray-500">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <MatchTypeBadge type={matchType} />
              <Badge variant="secondary">
                {Math.round((result.similarity || 0) * 100)}% match
              </Badge>
            </div>
          </div>
        </DialogHeader>
        
        {/* Snippet highlight */}
        {snippet && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
            <p className="text-xs font-medium text-yellow-800 mb-1">Matched excerpt:</p>
            <HighlightedSnippet text={snippet} />
          </div>
        )}
        
        {/* Full content */}
        <div className="flex-1 mt-4 overflow-y-auto max-h-[400px]">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {isKB ? 'Full Document' : 'Full Content'}
              {isKB && fullDocument && (
                <Badge variant="outline" className="text-[10px]">Complete</Badge>
              )}
            </h4>
            {loadingDoc ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading full document...
              </div>
            ) : (
              <div className="text-sm text-gray-600 whitespace-pre-wrap">
                {displayContent || 'No content available'}
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation link */}
        {navLink && (
          <div className="mt-4 pt-4 border-t">
            <Link 
              href={navLink}
              className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
              onClick={onClose}
            >
              <ExternalLink className="w-4 h-4" />
              Open in Knowledge Base
            </Link>
          </div>
        )}
        
        {/* Metadata */}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-xs text-gray-500">
          {isKB && (
            <>
              <div>Type: <span className="text-gray-700">{result.document_type}</span></div>
              <div>Chunk: <span className="text-gray-700">#{result.chunk_index + 1}</span></div>
            </>
          )}
          {!isKB && (
            <>
              <div>Matched: <span className="text-gray-700">{result.matched ? 'Yes' : 'No'}</span></div>
              <div>Content type: <span className="text-gray-700">{result.content_type}</span></div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LoadingBubble() {
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
      </div>
      <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
        Searching...
      </div>
    </div>
  )
}


