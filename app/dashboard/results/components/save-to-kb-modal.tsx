'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveEmailToKB } from '../actions'
import { listKnowledgeBases, type KnowledgeBase } from '../../knowledge-base/actions'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

interface SaveToKBModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  selectedEmailIds: string[]
  emails: any[]
}

export default function SaveToKBModal({
  open,
  onClose,
  onSaved,
  selectedEmailIds,
  emails,
}: SaveToKBModalProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedKBId, setSelectedKBId] = useState<string>('new')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingKBs, setLoadingKBs] = useState(false)

  useEffect(() => {
    if (open) {
      loadKnowledgeBases()
    } else {
      setNote('')
      setSelectedKBId('new')
    }
  }, [open])

  const loadKnowledgeBases = async () => {
    setLoadingKBs(true)
    try {
      const result = await listKnowledgeBases()
      if (result.success) {
        // Filter to manual and saved_emails types
        const filtered = (result.data || []).filter(
          kb => kb.type === 'manual' || kb.type === 'saved_emails'
        )
        setKnowledgeBases(filtered)
      }
    } catch (error) {
      console.error('Error loading KBs:', error)
    } finally {
      setLoadingKBs(false)
    }
  }

  const handleSave = async () => {
    if (selectedEmailIds.length === 0) {
      alert('No emails selected')
      return
    }

    setLoading(true)

    try {
      const kbId = selectedKBId === 'new' ? undefined : selectedKBId

      // Save each selected email
      for (const emailId of selectedEmailIds) {
        await saveEmailToKB(emailId, kbId, note || undefined)
      }

      alert(`Saved ${selectedEmailIds.length} email(s) to knowledge base!`)
      onSaved()
      onClose()
    } catch (error) {
      console.error('Error saving:', error)
      alert('Failed to save emails')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save to Knowledge Base</DialogTitle>
          <DialogDescription>
            Save {selectedEmailIds.length} selected email(s) to a knowledge base for semantic search
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Knowledge Base</Label>
            {loadingKBs ? (
              <p className="text-sm text-muted-foreground">Loading knowledge bases...</p>
            ) : (
              <Select value={selectedKBId} onValueChange={setSelectedKBId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">
                    📁 Create new "Saved Emails" KB (auto)
                  </SelectItem>
                  {knowledgeBases.map(kb => (
                    <SelectItem key={kb.id} value={kb.id}>
                      {kb.name} ({kb.document_count} docs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Select an existing knowledge base or create a new one automatically
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note or flag for these emails..."
              rows={3}
            />
          </div>

          <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
            <p className="text-sm font-medium mb-2">Selected emails:</p>
            <div className="space-y-1">
              {selectedEmailIds.map(id => {
                const email = emails.find(e => e.id === id)
                return (
                  <div key={id} className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {email?.matched ? '✓ Matched' : '✗ Not matched'}
                    </Badge>
                    <span className="line-clamp-1 flex-1">{email?.email_subject || 'Untitled'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || selectedEmailIds.length === 0}>
            {loading ? 'Saving...' : `Save ${selectedEmailIds.length} Email(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

