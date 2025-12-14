'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Copy, Trash2, FileText, Eye, Check, Sparkles, Clock, Target, BookOpen } from 'lucide-react'
import { deleteDraft, updateDraft, type GeneratedDraft } from '../actions'
import { formatDistanceToNow } from 'date-fns'

interface DraftsListProps {
  drafts: GeneratedDraft[]
}

export function DraftsList({ drafts: initialDrafts }: DraftsListProps) {
  const [drafts, setDrafts] = useState(initialDrafts)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleCopy = async (draft: GeneratedDraft) => {
    await navigator.clipboard.writeText(draft.draft_content)
    setCopiedId(draft.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (id: string) => {
    await deleteDraft(id)
    setDrafts(drafts.filter(d => d.id !== id))
  }

  const handleEdit = (draft: GeneratedDraft) => {
    setEditingId(draft.id)
    setEditContent(draft.draft_content)
  }

  const handleSaveEdit = async (id: string) => {
    await updateDraft(id, { draft_content: editContent })
    setDrafts(drafts.map(d => d.id === id ? { ...d, draft_content: editContent } : d))
    setEditingId(null)
  }

  return (
    <div className="grid gap-4">
      {drafts.map((draft) => (
        <Card key={draft.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  {draft.email_subject || 'Draft'}
                </CardTitle>
                <CardDescription className="flex items-center gap-3 text-sm">
                  {draft.agent_name && (
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {draft.agent_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}
                  </span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {draft.generation_metadata?.confidence && (
                  <Badge variant="outline" className="bg-purple-50">
                    {(draft.generation_metadata.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                )}
                {draft.generation_metadata?.iterations && draft.generation_metadata.iterations > 1 && (
                  <Badge variant="outline">
                    {draft.generation_metadata.iterations} iterations
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Draft Preview */}
            <div className="bg-muted/50 rounded-lg p-4 max-h-40 overflow-hidden relative">
              <p className="text-sm whitespace-pre-wrap">
                {draft.draft_content.length > 400 
                  ? draft.draft_content.substring(0, 400) + '...'
                  : draft.draft_content}
              </p>
              {draft.draft_content.length > 400 && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted/50 to-transparent" />
              )}
            </div>

            {/* KB Sources */}
            {draft.kb_sources_used && draft.kb_sources_used.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  Sources Used ({draft.kb_sources_used.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {draft.kb_sources_used.map((source, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {source.documentTitle}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    View Full
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      Generated Draft
                    </DialogTitle>
                    <DialogDescription>
                      {draft.email_subject}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {editingId === draft.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={15}
                          className="font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <Button onClick={() => handleSaveEdit(draft.id)} size="sm">
                            Save Changes
                          </Button>
                          <Button variant="outline" onClick={() => setEditingId(null)} size="sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="whitespace-pre-wrap text-sm">{draft.draft_content}</p>
                      </div>
                    )}
                    
                    {/* Metadata */}
                    {draft.generation_metadata && (
                      <div className="space-y-2 pt-4 border-t">
                        <p className="text-sm font-medium">Generation Details</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          {draft.generation_metadata.modelUsed && (
                            <div>Model: {draft.generation_metadata.modelUsed}</div>
                          )}
                          {draft.generation_metadata.processingTimeMs && (
                            <div>Time: {(draft.generation_metadata.processingTimeMs / 1000).toFixed(1)}s</div>
                          )}
                          {draft.generation_metadata.iterations && (
                            <div>Iterations: {draft.generation_metadata.iterations}</div>
                          )}
                          {draft.generation_metadata.confidence && (
                            <div>Confidence: {(draft.generation_metadata.confidence * 100).toFixed(0)}%</div>
                          )}
                        </div>
                        {draft.generation_metadata.reasoning && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {draft.generation_metadata.reasoning}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-4 border-t">
                      <Button onClick={() => handleCopy(draft)}>
                        {copiedId === draft.id ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy to Clipboard
                          </>
                        )}
                      </Button>
                      {editingId !== draft.id && (
                        <Button variant="outline" onClick={() => handleEdit(draft)}>
                          <FileText className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleCopy(draft)}
              >
                {copiedId === draft.id ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>

              <div className="flex-1" />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. The draft will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(draft.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

