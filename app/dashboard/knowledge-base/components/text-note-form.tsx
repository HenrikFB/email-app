'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createTextNote, updateDocument, type KBDocument } from '../documents/actions'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface TextNoteFormProps {
  open: boolean
  knowledgeBaseId: string
  onClose: () => void
  onCreate: () => void
  editDocument?: KBDocument | null  // Optional: for edit mode
}

export default function TextNoteForm({
  open,
  knowledgeBaseId,
  onClose,
  onCreate,
  editDocument,
}: TextNoteFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [notes, setNotes] = useState('')
  const [optimizationHints, setOptimizationHints] = useState('')
  const [extractionGuidelines, setExtractionGuidelines] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Load edit document data when in edit mode
  useEffect(() => {
    if (editDocument) {
      setTitle(editDocument.title)
      setContent(editDocument.content || '')
      setNotes(editDocument.notes || '')
      setOptimizationHints(editDocument.optimization_hints || '')
      setExtractionGuidelines(editDocument.extraction_guidelines || '')
      setTags(editDocument.context_tags || [])
    } else {
      handleReset()
    }
  }, [editDocument, open])

  const handleReset = () => {
    setTitle('')
    setContent('')
    setNotes('')
    setOptimizationHints('')
    setExtractionGuidelines('')
    setTagInput('')
    setTags([])
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()])
      }
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      alert('Please enter a title and content')
      return
    }

    setLoading(true)

    try {
      let result
      
      if (editDocument) {
        // Update existing document
        result = await updateDocument(editDocument.id, {
          title: title.trim(),
          content: content.trim(),
          notes: notes.trim() || undefined,
          optimization_hints: optimizationHints.trim() || undefined,
          extraction_guidelines: extractionGuidelines.trim() || undefined,
          context_tags: tags.length > 0 ? tags : undefined,
        })
      } else {
        // Create new document
        result = await createTextNote({
          knowledgeBaseId,
          title: title.trim(),
          content: content.trim(),
          notes: notes.trim() || undefined,
          optimization_hints: optimizationHints.trim() || undefined,
          extraction_guidelines: extractionGuidelines.trim() || undefined,
          context_tags: tags.length > 0 ? tags : undefined,
        })
      }

      if (!result.success) {
        alert(`Error ${editDocument ? 'updating' : 'creating'} note: ${result.error}`)
        return
      }

      handleReset()
      onCreate()
    } catch (error) {
      alert(`Failed to ${editDocument ? 'update' : 'create'} text note`)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editDocument ? 'Edit Text Note' : 'Create Text Note'}</DialogTitle>
            <DialogDescription>
              {editDocument 
                ? 'Update this document. Changes will be re-chunked and re-embedded automatically.'
                : 'Add a new text document to this knowledge base. It will be automatically chunked and embedded for semantic search.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Senior Backend Developer Cover Letter"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your content here..."
                rows={10}
                required
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {content.length} characters
              </p>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-medium">Metadata (Optional)</h3>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Your free-form notes about this document..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Personal notes for your reference
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="optimization-hints">Optimization Hints</Label>
                <Textarea
                  id="optimization-hints"
                  value={optimizationHints}
                  onChange={(e) => setOptimizationHints(e.target.value)}
                  placeholder="e.g., Focus on salary expectations and remote work preferences..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Hints for better extraction from similar documents
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="extraction-guidelines">Extraction Guidelines</Label>
                <Textarea
                  id="extraction-guidelines"
                  value={extractionGuidelines}
                  onChange={(e) => setExtractionGuidelines(e.target.value)}
                  placeholder="e.g., When extracting from this type of document, always look for..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Guidelines for extracting data from this type of content
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Press Enter to add tags (e.g., python, senior, backend)"
                />
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Tags for categorization and filtering
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading 
                ? (editDocument ? 'Updating...' : 'Creating...')
                : (editDocument ? 'Update Note' : 'Create Note')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

