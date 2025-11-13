import { Suspense } from 'react'
import { getConfigurations } from './actions'
import ConfigForm from './components/config-form'
import ConfigCard from './components/config-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

async function ConfigurationsList() {
  const configurations = await getConfigurations()

  if (configurations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No configurations yet</CardTitle>
          <CardDescription>
            Create your first agent configuration to start monitoring emails
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {configurations.map((config) => (
        <ConfigCard key={config.id} config={config} />
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-20 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Configurations</h1>
        <p className="text-muted-foreground">
          Manage your email monitoring and analysis configurations
        </p>
      </div>

      <ConfigForm />

      <div>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">Your Configurations</h2>
        <Suspense fallback={<LoadingSkeleton />}>
          <ConfigurationsList />
        </Suspense>
      </div>
    </div>
  )
}

