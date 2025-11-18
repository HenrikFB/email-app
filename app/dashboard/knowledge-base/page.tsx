'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Database, FileText, Link as LinkIcon } from 'lucide-react'
import { listKnowledgeBases, type KnowledgeBase } from './actions'
import KBCard from './components/kb-card'
import CreateKBModal from './components/create-kb-modal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function KnowledgeBasePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'manual' | 'saved_emails' | 'saved_scraped_urls'>('all')

  useEffect(() => {
    loadKnowledgeBases()
  }, [])

  const loadKnowledgeBases = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await listKnowledgeBases()

      if (!result.success) {
        setError(result.error || 'Failed to load knowledge bases')
        return
      }

      setKnowledgeBases(result.data || [])
    } catch (err) {
      console.error('Error loading knowledge bases:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    loadKnowledgeBases()
    setShowCreateModal(false)
  }

  const handleDelete = () => {
    loadKnowledgeBases()
  }

  const filteredKBs = knowledgeBases.filter(kb => {
    if (filter === 'all') return true
    return kb.type === filter
  })

  const manualCount = knowledgeBases.filter(kb => kb.type === 'manual').length
  const emailsCount = knowledgeBases.filter(kb => kb.type === 'saved_emails').length
  const urlsCount = knowledgeBases.filter(kb => kb.type === 'saved_scraped_urls').length

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Bases</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Bases</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Bases</h1>
          <p className="text-muted-foreground">
            Manage your knowledge bases for semantic search and RAG
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Knowledge Base
        </Button>
      </div>

      {knowledgeBases.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No knowledge bases yet</CardTitle>
            <CardDescription>
              Create your first knowledge base to start organizing your content for semantic search
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Knowledge Base
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="all">
                <Database className="mr-2 h-4 w-4" />
                All ({knowledgeBases.length})
              </TabsTrigger>
              <TabsTrigger value="manual">
                <FileText className="mr-2 h-4 w-4" />
                Manual ({manualCount})
              </TabsTrigger>
              <TabsTrigger value="saved_emails">
                Saved Emails ({emailsCount})
              </TabsTrigger>
              <TabsTrigger value="saved_scraped_urls">
                <LinkIcon className="mr-2 h-4 w-4" />
                Saved URLs ({urlsCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredKBs.map((kb) => (
              <KBCard key={kb.id} knowledgeBase={kb} onDelete={handleDelete} />
            ))}
          </div>

          {filteredKBs.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">No knowledge bases match the selected filter.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <CreateKBModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}

