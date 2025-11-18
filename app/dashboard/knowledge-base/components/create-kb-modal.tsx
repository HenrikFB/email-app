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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createKnowledgeBase } from '../actions'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'

interface CreateKBModalProps {
  open: boolean
  onClose: () => void
  onCreate: () => void
}

interface AgentConfig {
  id: string
  email_address: string
  match_criteria: string | null
}

export default function CreateKBModal({ open, onClose, onCreate }: CreateKBModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'manual' | 'saved_emails' | 'saved_scraped_urls'>('manual')
  const [optimizationContext, setOptimizationContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([])
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      loadAgentConfigs()
    } else {
      // Reset form when modal closes
      setName('')
      setDescription('')
      setType('manual')
      setOptimizationContext('')
      setSelectedAgentIds([])
    }
  }, [open])

  const loadAgentConfigs = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('agent_configurations')
      .select('id, email_address, match_criteria')
      .order('created_at', { ascending: false })
    
    setAgentConfigs(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      alert('Please enter a name')
      return
    }

    setLoading(true)

    try {
      const result = await createKnowledgeBase({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        optimization_context: optimizationContext.trim() || undefined,
      })

      if (!result.success) {
        alert(`Error creating knowledge base: ${result.error}`)
        return
      }

      // Assign to selected agent configs if any
      if (selectedAgentIds.length > 0 && result.data) {
        const supabase = createClient()
        const assignments = selectedAgentIds.map(agentId => ({
          agent_configuration_id: agentId,
          knowledge_base_id: result.data!.id,
        }))
        
        await supabase.from('agent_kb_assignments').insert(assignments)
      }

      onCreate()
    } catch (error) {
      alert('Failed to create knowledge base')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    )
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
            <DialogDescription>
              Create a new knowledge base for organizing documents and enabling semantic search
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Job Applications, Finance Resources"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (user-created content)</SelectItem>
                  <SelectItem value="saved_emails">Saved Emails (from results)</SelectItem>
                  <SelectItem value="saved_scraped_urls">Saved URLs (from results)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Manual KBs are for your own content. The other types are auto-created when saving from results.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this knowledge base is for..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="optimization-context">Optimization Context (for RAG)</Label>
              <Textarea
                id="optimization-context"
                value={optimizationContext}
                onChange={(e) => setOptimizationContext(e.target.value)}
                placeholder="e.g., When using this KB for RAG, focus on extracting salary ranges and required years of experience..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This context will be used when the KB provides examples during email analysis (RAG). It guides the AI on how to use these examples.
              </p>
            </div>

            {agentConfigs.length > 0 && (
              <div className="space-y-2">
                <Label>Assign to Agent Configurations (optional)</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {agentConfigs.map(config => (
                    <div key={config.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agent-${config.id}`}
                        checked={selectedAgentIds.includes(config.id)}
                        onCheckedChange={() => toggleAgentSelection(config.id)}
                      />
                      <label
                        htmlFor={`agent-${config.id}`}
                        className="text-sm flex-1 cursor-pointer"
                      >
                        {config.email_address}
                        {config.match_criteria && (
                          <span className="text-xs text-muted-foreground block">
                            {config.match_criteria.substring(0, 60)}...
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  When assigned, this KB will provide context examples during email analysis for these agent configs (RAG).
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Knowledge Base'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

