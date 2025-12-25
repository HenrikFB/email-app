'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { generateCoverLetter, chatWithDrafting, type ChatMessage } from '../actions'
import { Copy, Check, Loader2, FileText, Sparkles, MessageCircle, Send, RotateCcw } from 'lucide-react'

export function DraftingForm() {
  const [jobDescription, setJobDescription] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    setCoverLetter('')
    setChatMessages([]) // Reset chat when generating new letter

    const result = await generateCoverLetter(jobDescription)

    if (result.success && result.coverLetter) {
      setCoverLetter(result.coverLetter)
    } else {
      setError(result.error || 'Failed to generate cover letter')
    }

    setIsGenerating(false)
  }

  const handleCopy = async () => {
    if (coverLetter) {
      await navigator.clipboard.writeText(coverLetter)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !coverLetter) return

    setIsChatting(true)
    const userMessage: ChatMessage = { role: 'user', content: chatInput }
    const newMessages = [...chatMessages, userMessage]
    setChatMessages(newMessages)
    setChatInput('')

    const result = await chatWithDrafting(
      chatInput,
      chatMessages,
      coverLetter,
      jobDescription
    )

    if (result.success && result.response) {
      setChatMessages([
        ...newMessages,
        { role: 'assistant', content: result.response }
      ])
    } else {
      setChatMessages([
        ...newMessages,
        { role: 'assistant', content: `Error: ${result.error || 'Failed to get response'}` }
      ])
    }

    setIsChatting(false)
  }

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to send
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleChat()
    }
  }

  const clearChat = () => {
    setChatMessages([])
  }

  return (
    <div className="space-y-6">
      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Description
            </CardTitle>
            <CardDescription>
              Paste the job description here. Add notes at the top (NOTES:) to customize.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="NOTES:&#10;- Focus on...&#10;- Include kommune projekter&#10;---&#10;Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[600px] font-mono text-sm"
            />
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !jobDescription.trim()}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Cover Letter
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generated Cover Letter
                </CardTitle>
                <CardDescription>
                  Your generated cover letter will appear here.
                </CardDescription>
              </div>
              {coverLetter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">
                {error}
              </div>
            )}
            {coverLetter ? (
              <div className="whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-sm min-h-[600px] overflow-y-auto">
                {coverLetter}
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[600px] rounded-md border border-dashed text-muted-foreground">
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span>Generating your cover letter...</span>
                  </div>
                ) : (
                  <span>Your cover letter will appear here</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chat Section - Full width and height */}
      {coverLetter && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <MessageCircle className="h-5 w-5" />
                Refine with Chat
              </h3>
              <p className="text-sm text-muted-foreground">
                Ask for changes or combine ideas. Press Cmd+Enter to send.
              </p>
            </div>
            {chatMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Chat Messages Area - Takes up available space */}
          <div className="min-h-[500px] max-h-[70vh] overflow-y-auto p-6">
            {chatMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground">
                <div className="text-center space-y-2">
                  <MessageCircle className="h-12 w-12 mx-auto opacity-50" />
                  <p>Start a conversation to refine your cover letter</p>
                  <p className="text-xs">Try: &quot;Lav projekter ligesom kommune&quot; or &quot;Add more about RPA&quot;</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {chatMessages.map((msg, i) => (
                  <div key={i} className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {msg.role === 'user' ? '📝 You' : '🤖 Assistant'}
                    </div>
                    <div
                      className={`rounded-lg p-4 ${
                        msg.role === 'user'
                          ? 'bg-primary/5 border border-primary/10'
                          : 'bg-muted/50'
                      }`}
                    >
                      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed overflow-x-auto">
                        {msg.content}
                      </pre>
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      🤖 Assistant
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="border-t p-4 space-y-3">
            <Textarea
              placeholder="Ask for changes... e.g., 'Lav projekter ligesom kommune' or 'Add lokale modeller section'&#10;&#10;Press Cmd+Enter to send"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              disabled={isChatting}
              className="min-h-[120px] font-mono text-sm resize-none"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleChat}
                disabled={isChatting || !chatInput.trim()}
                size="lg"
                className="flex items-center gap-2"
              >
                {isChatting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send (Cmd+Enter)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
