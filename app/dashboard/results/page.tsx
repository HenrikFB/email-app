import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ResultCard from './components/result-card'

async function AnalyzedEmailsList() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Not authenticated</div>
  }

  const { data: analyzedEmails, error } = await supabase
    .from('analyzed_emails')
    .select(`
      *,
      agent_configurations (
        email_address,
        match_criteria,
        extraction_fields
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('❌ Error fetching analyzed emails:', error)
    return <div>Error loading analyzed emails</div>
  }

  console.log('✅ Fetched analyzed emails:', analyzedEmails.length)
  analyzedEmails.forEach((email, idx) => {
    console.log(`📧 Email ${idx + 1}:`, {
      subject: email.email_subject,
      from: email.email_from,
      status: email.analysis_status,
      matched: email.matched,
      agentConfig: email.agent_configurations?.email_address,
      extractedData: email.extracted_data ? Object.keys(email.extracted_data) : 'none'
    })
  })

  if (!analyzedEmails || analyzedEmails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No analyzed emails yet</CardTitle>
          <CardDescription>
            Go to the Email Browser to analyze some emails
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {analyzedEmails.map((email: any) => (
        <ResultCard key={email.id} result={email} />
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
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
  )
}

export default function ResultsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
        <p className="text-muted-foreground">
          View your analyzed emails and extracted data
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <AnalyzedEmailsList />
      </Suspense>
    </div>
  )
}

