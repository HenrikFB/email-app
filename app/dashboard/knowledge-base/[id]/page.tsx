'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, FileText, ExternalLink, Trash2, Upload, File } from 'lucide-react'
import { getKnowledgeBase, type KnowledgeBase } from '../actions'
import { listDocuments, deleteDocument, type KBDocument } from '../documents/actions'
import { createClient } from '@/lib/supabase/client'
import TextNoteForm from '../components/text-note-form'
import { UploadDocumentModal } from '../components/upload-document-modal'
import { DocumentDetailModal } from '../components/document-detail-modal'
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
  const [userId, setUserId] = useState<string | null>(null)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [documentToEdit, setDocumentToEdit] = useState<KBDocument | null>(null)
  const [documentToView, setDocumentToView] = useState<KBDocument | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<KBDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function getUserId() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUserId()
  }, [])

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
    if (doc.type === 'uploaded_document') {
      setDocumentToView(doc)
    } else {
      setDocumentToEdit(doc)
      setShowNoteForm(true)
    }
  }
  
  const handleViewDocument = (doc: KBDocument) => {
    setDocumentToView(doc)
  }
  
  const handleUploadModalClose = (open: boolean) => {
    setShowUploadModal(open)
    if (!open) {
      // Reload data when modal closes (documents may have been added)
      loadData()
    }
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowNoteForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Text Note
          </Button>
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Documents
          </Button>
        </div>
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
                No documents yet. Add a text note or upload PDFs to get started.
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowNoteForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Text Note
                </Button>
                <Button onClick={() => setShowUploadModal(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => {
              const isUploaded = doc.type === 'uploaded_document'
              const getStatusColor = (status: string | null) => {
                if (!status) return 'default'
                const colors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
                  pending: 'outline',
                  processing: 'secondary',
                  completed: 'default',
                  failed: 'destructive',
                  ready_for_review: 'secondary',
                }
                return colors[status] || 'default'
              }
              
              return (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          {isUploaded ? <File className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          {doc.title}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1 space-x-2">
                          <span>{doc.chunk_count} chunks • {doc.char_count} chars</span>
                          {isUploaded && doc.file_size && (
                            <span>• {(doc.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge variant={isUploaded ? 'secondary' : 'default'}>
                          {isUploaded ? 'PDF' : 'Text'}
                        </Badge>
                        {doc.processing_status && (
                          <Badge variant={getStatusColor(doc.processing_status)} className="text-xs">
                            {doc.processing_status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {doc.processing_error ? (
                      <p className="text-sm text-red-600 p-2 bg-red-50 rounded">
                        Error: {doc.processing_error}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {doc.content || 'Processing...'}
                      </p>
                    )}
                    
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
                        {isUploaded ? 'View' : 'Edit'}
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
              )
            })}
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

      {kb && userId && (
        <UploadDocumentModal
          open={showUploadModal}
          onOpenChange={handleUploadModalClose}
          knowledgeBaseId={kb.id}
          userId={userId}
          autoSaveUploads={kb.auto_save_uploads}
        />
      )}

      <DocumentDetailModal
        open={!!documentToView}
        onOpenChange={(open) => !open && setDocumentToView(null)}
        document={documentToView}
        onSave={loadData}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{documentToDelete?.title}"? This will also delete all associated chunks and embeddings{documentToDelete?.file_path ? ' and the uploaded file' : ''}. This action cannot be undone.
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

