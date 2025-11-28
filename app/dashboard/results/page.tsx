'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Save, Search, MessageSquare, X } from 'lucide-react'
import ResultCard from './components/result-card'
import SaveToKBModal from './components/save-to-kb-modal'
import SearchModal from './components/search-modal'
import ChatSearchPanel from './components/chat-search-panel'

type FilterType = 'all' | 'matched' | 'not-matched'
type SortType = 'date-desc' | 'date-asc' | 'confidence-desc' | 'confidence-asc'
type SourceSelectionInput = {
  emailId: string
  sourceId: string
  label: string
  data: any
}

export default function ResultsPage() {
  const [emails, setEmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortType>('date-desc')
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showChatSearch, setShowChatSearch] = useState(false)
  const [sourceSearchSelections, setSourceSearchSelections] = useState<SourceSelectionInput[]>([])

  useEffect(() => {
    loadEmails()
  }, [])

  const loadEmails = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Not authenticated')
        return
      }

      const { data: analyzedEmails, error: fetchError } = await supabase
        .from('analyzed_emails')
        .select(`
          *,
          agent_configurations (
            name,
            email_address,
            match_criteria,
            extraction_fields,
            button_text_pattern
          )
        `)
        .eq('user_id', user.id)
        .order('analyzed_at', { ascending: false })
        .limit(100)

      if (fetchError) {
        console.error('❌ Error fetching analyzed emails:', fetchError)
        setError('Error loading analyzed emails')
        return
      }

      console.log('✅ Fetched analyzed emails:', analyzedEmails?.length || 0)
      analyzedEmails?.forEach((email: any, idx: number) => {
        console.log(`📧 Email ${idx + 1}:`, {
          subject: email.email_subject,
          from: email.email_from,
          status: email.analysis_status,
          matched: email.matched,
          confidence: email.confidence,
          agentConfig: email.agent_configurations?.name || email.agent_configurations?.email_address,
          extractedData: email.extracted_data ? Object.keys(email.extracted_data) : 'none'
        })
      })

      setEmails(analyzedEmails || [])
    } catch (err) {
      console.error('Error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Filter emails based on selected filter
  const filteredEmails = emails.filter(email => {
    if (filter === 'matched') return email.matched === true
    if (filter === 'not-matched') return email.matched === false
    return true // 'all'
  })

  // Sort emails based on selected sort
  const sortedEmails = [...filteredEmails].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.analyzed_at || b.created_at).getTime() - new Date(a.analyzed_at || a.created_at).getTime()
      case 'date-asc':
        return new Date(a.analyzed_at || a.created_at).getTime() - new Date(b.analyzed_at || b.created_at).getTime()
      case 'confidence-desc':
        return (b.confidence || 0) - (a.confidence || 0)
      case 'confidence-asc':
        return (a.confidence || 0) - (b.confidence || 0)
      default:
        return 0
    }
  })

  const matchedCount = emails.filter(e => e.matched === true).length
  const notMatchedCount = emails.filter(e => e.matched === false).length
  // Get agent config from either selected emails or source selections
  const primarySelectedEmailId = selectedEmailIds[0] || sourceSearchSelections[0]?.emailId
  const agentConfigIdForSearch = primarySelectedEmailId
    ? emails.find(e => e.id === primarySelectedEmailId)?.agent_configuration_id
    : undefined

  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmailIds(prev =>
      prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedEmailIds.length === sortedEmails.length) {
      setSelectedEmailIds([])
    } else {
      setSelectedEmailIds(sortedEmails.map(e => e.id))
    }
  }

  const handleSaved = () => {
    loadEmails()
    setSelectedEmailIds([])
  }

  const openSearchModal = (sources: SourceSelectionInput[] = []) => {
    setSourceSearchSelections(sources)
    setShowSearchModal(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-20 w-full animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
          <p className="text-muted-foreground">
            View your analyzed emails and extracted data
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No analyzed emails yet</CardTitle>
            <CardDescription>
              Go to the Email Browser to analyze some emails
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
          <p className="text-muted-foreground">
            {emails.length} email{emails.length !== 1 ? 's' : ''} analyzed • {matchedCount} matched • {notMatchedCount} not matched
            {selectedEmailIds.length > 0 && ` • ${selectedEmailIds.length} selected`}
          </p>
        </div>
        <div className="flex gap-2">
          {/* AI Chat Search Button - Always visible */}
          <Button
            onClick={() => setShowChatSearch(!showChatSearch)}
            variant={showChatSearch ? 'default' : 'outline'}
            className={showChatSearch ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            AI Search
          </Button>
          
          {selectedEmailIds.length > 0 && (
            <>
              <Button onClick={() => setShowSaveModal(true)} variant="outline">
                <Save className="mr-2 h-4 w-4" />
                Save to KB ({selectedEmailIds.length})
              </Button>
              <Button onClick={() => openSearchModal()}>
                <Search className="mr-2 h-4 w-4" />
                Find Similar ({selectedEmailIds.length})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">
              All ({emails.length})
            </TabsTrigger>
            <TabsTrigger value="matched">
              Matched ({matchedCount})
            </TabsTrigger>
            <TabsTrigger value="not-matched">
              Not Matched ({notMatchedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortType)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="confidence-desc">Highest Confidence</SelectItem>
            <SelectItem value="confidence-asc">Lowest Confidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedEmails.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No emails match the selected filter.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="select-all"
              checked={selectedEmailIds.length === sortedEmails.length && sortedEmails.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select all ({sortedEmails.length})
            </label>
          </div>
          <div className="space-y-4">
            {sortedEmails.map((email: any) => (
              <div key={email.id} className="flex gap-3">
                <Checkbox
                  checked={selectedEmailIds.includes(email.id)}
                  onCheckedChange={() => toggleEmailSelection(email.id)}
                  className="mt-6"
                />
                <div className="flex-1">
                  <ResultCard result={email} onSourceSearch={openSearchModal} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SaveToKBModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSaved={handleSaved}
        selectedEmailIds={selectedEmailIds}
        emails={emails}
      />

      <SearchModal
        open={showSearchModal}
        onClose={() => {
          setShowSearchModal(false)
          setSourceSearchSelections([])
        }}
        selectedEmailIds={selectedEmailIds}
        emails={emails}
        agentConfigId={agentConfigIdForSearch}
        selectedSources={sourceSearchSelections}
      />

      {/* AI Chat Search Panel - Floating on the right side */}
      {showChatSearch && (
        <div className="fixed right-6 bottom-6 w-[450px] z-50 shadow-2xl">
          <ChatSearchPanel
            agentConfigId={agentConfigIdForSearch}
            currentEmailId={selectedEmailIds[0]}
            initialContext={
              selectedEmailIds[0]
                ? {
                    extracted_data: emails.find(e => e.id === selectedEmailIds[0])?.extracted_data,
                    email_subject: emails.find(e => e.id === selectedEmailIds[0])?.email_subject,
                    email_from: emails.find(e => e.id === selectedEmailIds[0])?.email_from,
                  }
                : undefined
            }
            onClose={() => setShowChatSearch(false)}
          />
        </div>
      )}
    </div>
  )
}
