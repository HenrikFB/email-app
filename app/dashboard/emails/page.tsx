'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { EmailsDataTable } from './data-table'
import { getEmailsFromConnection, analyzeSelectedEmails } from './actions'
import { getEmailConnections } from '../email-connections/actions'
import { getConfigurations } from '../actions'
import type { Email } from '@/lib/microsoft-graph/client'
import type { EmailConnection } from '../email-connections/actions'
import type { AgentConfiguration } from '../actions'

export default function EmailBrowserPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const connectionIdParam = searchParams.get('connection')

  const [connections, setConnections] = useState<EmailConnection[]>([])
  const [agentConfigs, setAgentConfigs] = useState<AgentConfiguration[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string>(connectionIdParam || '')
  const [selectedConfig, setSelectedConfig] = useState<string>('')
  const [emails, setEmails] = useState<Email[]>([])
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filters
  const [fromFilter, setFromFilter] = useState('')
  const [dateRange, setDateRange] = useState('30') // days
  const [hasAttachment, setHasAttachment] = useState<boolean | undefined>(undefined)

  // Load connections and configs on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [connectionsData, configsData] = await Promise.all([
          getEmailConnections(),
          getConfigurations()
        ])
        setConnections(connectionsData)
        setAgentConfigs(configsData)
        
        if (connectionIdParam && connectionsData.length > 0) {
          setSelectedConnection(connectionIdParam)
        } else if (connectionsData.length > 0) {
          setSelectedConnection(connectionsData[0].id)
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setError('Failed to load data')
      }
    }
    loadData()
  }, [connectionIdParam])

  const handleFetchEmails = async () => {
    if (!selectedConnection) {
      setError('Please select an email connection')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Calculate date for "after" filter
      const daysAgo = parseInt(dateRange)
      const afterDate = new Date()
      afterDate.setDate(afterDate.getDate() - daysAgo)
      const afterDateStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, '0')}/${String(afterDate.getDate()).padStart(2, '0')}`

      const result = await getEmailsFromConnection(selectedConnection, {
        from: fromFilter || undefined,
        after: afterDateStr,
        hasAttachment: hasAttachment,
        maxResults: 50,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setEmails(result.emails)
      }
    } catch (err) {
      console.error('Error fetching emails:', err)
      setError('Failed to fetch emails')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeSelected = async () => {
    if (selectedEmails.length === 0) {
      setError('Please select at least one email')
      return
    }

    if (!selectedConfig) {
      setError('Please select an agent configuration')
      return
    }

    setAnalyzing(true)
    setAnalyzeProgress(0)
    setError(null)
    setSuccessMessage(null)

    try {
      // Note: Progress is shown via state, but actual analysis happens server-side
      // We simulate progress for UX purposes
      const progressInterval = setInterval(() => {
        setAnalyzeProgress(prev => {
          if (prev >= 90) return prev
          return prev + 10
        })
      }, 500)

      const result = await analyzeSelectedEmails(selectedEmails, selectedConnection, selectedConfig)
      
      clearInterval(progressInterval)
      setAnalyzeProgress(100)
      
      if (result.success) {
        setSuccessMessage(
          `✅ Analyzed ${result.analyzed} email(s): ${result.matched} matched, ${result.failed} failed`
        )
        setSelectedEmails([])
        
        // Redirect to results page after 2 seconds
        setTimeout(() => {
          router.push('/dashboard/results')
        }, 2000)
      } else {
        setError(result.error || 'Failed to analyze emails')
      }
    } catch (err) {
      console.error('Error analyzing emails:', err)
      setError('Failed to analyze emails')
    } finally {
      setTimeout(() => {
        setAnalyzing(false)
        setAnalyzeProgress(0)
      }, 2500)
    }
  }

  if (connections.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Email Browser</h1>
        <Card>
          <CardHeader>
            <CardTitle>No Email Connections</CardTitle>
            <CardDescription>
              You need to connect an email account before you can browse emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/api/microsoft/auth'}>
              Connect Email Account
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Browser</h1>
        <p className="text-muted-foreground">
          Browse and analyze emails from your connected accounts
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter emails by sender, date range, and more</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="connection">Email Connection</Label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger id="connection">
                  <SelectValue placeholder="Select connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">From (Sender)</Label>
              <Input
                id="from"
                placeholder="sender@example.com"
                value={fromFilter}
                onChange={(e) => setFromFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="dateRange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachments">Attachments</Label>
              <Select 
                value={hasAttachment === undefined ? 'any' : hasAttachment ? 'yes' : 'no'} 
                onValueChange={(v) => setHasAttachment(v === 'any' ? undefined : v === 'yes')}
              >
                <SelectTrigger id="attachments">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">With attachments</SelectItem>
                  <SelectItem value="no">Without attachments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleFetchEmails} disabled={loading}>
            {loading ? 'Fetching...' : 'Fetch Emails'}
          </Button>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Controls */}
      {selectedEmails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analyze Selected Emails</CardTitle>
            <CardDescription>
              {selectedEmails.length} email(s) selected
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="agentConfig">Agent Configuration</Label>
              <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                <SelectTrigger id="agentConfig">
                  <SelectValue placeholder="Select configuration" />
                </SelectTrigger>
                <SelectContent>
                  {agentConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAnalyzeSelected} disabled={analyzing || !selectedConfig}>
                {analyzing ? 'Analyzing...' : 'Analyze Selected'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Progress & Success Message */}
      {analyzing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Analyzing emails...</p>
                <p className="text-sm text-muted-foreground">{analyzeProgress}%</p>
              </div>
              <Progress value={analyzeProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                This may take a few minutes depending on the number of emails and whether links need to be scraped.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {successMessage && !analyzing && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-green-900">{successMessage}</p>
            <p className="mt-1 text-xs text-green-700">Redirecting to results page...</p>
          </CardContent>
        </Card>
      )}

      {/* Emails Table */}
      {emails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Emails ({emails.length})</CardTitle>
            <CardDescription>Select emails to analyze</CardDescription>
          </CardHeader>
          <CardContent>
            <EmailsDataTable
              emails={emails}
              selectedEmails={selectedEmails}
              onSelectionChange={setSelectedEmails}
            />
          </CardContent>
        </Card>
      )}

      {!loading && emails.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Emails</CardTitle>
            <CardDescription>
              Click "Fetch Emails" to load emails with your filters
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

