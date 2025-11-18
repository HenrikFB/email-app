'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, FileText, ExternalLink, Trash2 } from 'lucide-react'
import { getKnowledgeBase, type KnowledgeBase } from '../actions'
import { listDocuments, deleteDocument, type KBDocument } from '../documents/actions'
import TextNoteForm from '../components/text-note-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function KnowledgeBaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const kbId = params.id as string

  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  const [documents, setDocuments] = useState<KBDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [documentToEdit, setDocumentToEdit] = useState<KBDocument | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<KBDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [kbId])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [kbResult, docsResult] = await Promise.all([
        getKnowledgeBase(kbId),
        listDocuments(kbId),
      ])

      if (!kbResult.success) {
        setError(kbResult.error || 'Failed to load knowledge base')
        return
      }

      if (!docsResult.success) {
        setError(docsResult.error || 'Failed to load documents')
        return
      }

      setKb(kbResult.data || null)
      setDocuments(docsResult.data || [])
    } catch (err) {
      console.error('Error loading data:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDocument = () => {
    loadData()
    setShowNoteForm(false)
    setDocumentToEdit(null)
  }

  const handleEditClick = (doc: KBDocument) => {
    setDocumentToEdit(doc)
    setShowNoteForm(true)
  }

  const handleDeleteClick = (doc: KBDocument) => {
    setDocumentToDelete(doc)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return

    setDeleting(true)
    try {
      const result = await deleteDocument(documentToDelete.id)
      if (result.success) {
        setDeleteDialogOpen(false)
        setDocumentToDelete(null)
        loadData()
      } else {
        alert(`Error deleting: ${result.error}`)
      }
    } catch (error) {
      alert('Failed to delete document')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="h-40 w-full animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (error || !kb) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/dashboard/knowledge-base')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">{error || 'Knowledge base not found'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push('/dashboard/knowledge-base')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{kb.name}</h1>
          <p className="text-muted-foreground">{kb.description || 'No description'}</p>
        </div>
        <Button onClick={() => setShowNoteForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Text Note
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Badge>{kb.type}</Badge>
            {kb.is_dynamic && <Badge variant="secondary">Auto-created</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Documents:</span>
              <span className="ml-2 font-medium">{kb.document_count}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Chunks:</span>
              <span className="ml-2 font-medium">{kb.total_chunks}</span>
            </div>
          </div>
          {kb.optimization_context && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                <strong>Optimization Context:</strong> {kb.optimization_context}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Documents ({documents.length})</h2>
        {documents.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No documents yet. Add your first text note to get started.
              </p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => setShowNoteForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Text Note
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" />
                        {doc.title}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {doc.chunk_count} chunks • {doc.char_count} chars
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {doc.content}
                  </p>
                  
                  {doc.context_tags && doc.context_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.context_tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {doc.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        <strong>Notes:</strong> {doc.notes.substring(0, 100)}
                        {doc.notes.length > 100 && '...'}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditClick(doc)}
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(doc)}
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TextNoteForm
        open={showNoteForm}
        knowledgeBaseId={kbId}
        onClose={() => {
          setShowNoteForm(false)
          setDocumentToEdit(null)
        }}
        onCreate={handleCreateDocument}
        editDocument={documentToEdit}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{documentToDelete?.title}"? This will also delete all associated chunks and embeddings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

