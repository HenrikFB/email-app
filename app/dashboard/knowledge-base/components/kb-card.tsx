'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Trash2, ExternalLink, Database, Link as LinkIcon, Pencil } from 'lucide-react'
import { deleteKnowledgeBase, updateKnowledgeBase, type KnowledgeBase } from '../actions'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useEffect, useState } from 'react'

interface KBCardProps {
  knowledgeBase: KnowledgeBase
  onDelete: () => void
}

export default function KBCard({ knowledgeBase, onDelete }: KBCardProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [editValues, setEditValues] = useState({
    name: knowledgeBase.name,
    description: knowledgeBase.description || '',
    optimizationContext: knowledgeBase.optimization_context || '',
  })

  useEffect(() => {
    setEditValues({
      name: knowledgeBase.name,
      description: knowledgeBase.description || '',
      optimizationContext: knowledgeBase.optimization_context || '',
    })
  }, [knowledgeBase])

  const getTypeIcon = () => {
    switch (knowledgeBase.type) {
      case 'manual':
        return <FileText className="h-4 w-4" />
      case 'saved_emails':
        return <Database className="h-4 w-4" />
      case 'saved_scraped_urls':
        return <LinkIcon className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const getTypeName = () => {
    switch (knowledgeBase.type) {
      case 'manual':
        return 'Manual'
      case 'saved_emails':
        return 'Saved Emails'
      case 'saved_scraped_urls':
        return 'Saved URLs'
      default:
        return knowledgeBase.type
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const result = await deleteKnowledgeBase(knowledgeBase.id)
      if (result.success) {
        setShowDeleteDialog(false)
        onDelete()
      } else {
        alert(`Error deleting: ${result.error}`)
      }
    } catch (error) {
      alert('Failed to delete knowledge base')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setUpdating(true)
    try {
      const payload = {
        name: editValues.name.trim(),
        description: editValues.description.trim() || undefined,
        optimization_context: editValues.optimizationContext.trim() || undefined,
      }

      const result = await updateKnowledgeBase(knowledgeBase.id, payload)
      if (!result.success) {
        alert(result.error || 'Failed to update knowledge base')
        return
      }

      setShowEditDialog(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to update knowledge base', error)
      alert('Failed to update knowledge base')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader onClick={() => router.push(`/dashboard/knowledge-base/${knowledgeBase.id}`)}>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="flex items-center gap-2">
                {getTypeIcon()}
                {knowledgeBase.name}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {knowledgeBase.description || 'No description'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent onClick={() => router.push(`/dashboard/knowledge-base/${knowledgeBase.id}`)}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{getTypeName()}</Badge>
              {knowledgeBase.is_dynamic && <Badge variant="secondary">Auto-created</Badge>}
            </div>
            
            <div className="text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Documents:</span>
                <span className="font-medium">{knowledgeBase.document_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Chunks:</span>
                <span className="font-medium">{knowledgeBase.total_chunks}</span>
              </div>
            </div>

            {knowledgeBase.optimization_context && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {knowledgeBase.optimization_context}
                </p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => router.push(`/dashboard/knowledge-base/${knowledgeBase.id}`)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setShowEditDialog(true)
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setShowDeleteDialog(true)
            }}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Knowledge Base</DialogTitle>
            <DialogDescription>
              Update the basic details and optimization context. These changes will apply immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kb-name">Name</Label>
              <Input
                id="kb-name"
                value={editValues.name}
                onChange={(e) => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-description">Description</Label>
              <Textarea
                id="kb-description"
                value={editValues.description}
                onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-optimization">Optimization Context</Label>
              <Textarea
                id="kb-optimization"
                value={editValues.optimizationContext}
                onChange={(e) =>
                  setEditValues(prev => ({ ...prev, optimizationContext: e.target.value }))
                }
                rows={4}
                placeholder="Guidance for how this knowledge base should influence extraction."
              />
              <p className="text-xs text-muted-foreground">
                These hints are passed to the analysis pipeline and semantic search for better context.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updating}>
                {updating ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Knowledge Base</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{knowledgeBase.name}"? This will also delete all {knowledgeBase.document_count} documents and {knowledgeBase.total_chunks} chunks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

