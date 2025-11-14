import { Suspense } from 'react'
import Link from 'next/link'
import { getConfigurations } from './actions'
import { getEmailConnections } from './email-connections/actions'
import ConfigForm from './components/config-form'
import ConfigCard from './components/config-card'
import EmailConnectionCard from './components/email-connection-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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

async function EmailConnectionsList() {
  const connections = await getEmailConnections()

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No email accounts connected</CardTitle>
          <CardDescription>
            Connect your email account to start analyzing emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/api/aurinko/auth">
            <Button>Connect Email Account</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {connections.map((connection) => (
        <EmailConnectionCard key={connection.id} connection={connection} />
      ))}
      <Link href="/api/aurinko/auth">
        <Button variant="outline" className="w-full">
          Connect Another Email Account
        </Button>
      </Link>
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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your email connections and analysis configurations
        </p>
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">Email Connections</h2>
        <Suspense fallback={<LoadingSkeleton />}>
          <EmailConnectionsList />
        </Suspense>
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">Agent Configurations</h2>
        <ConfigForm />
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">Your Configurations</h2>
        <Suspense fallback={<LoadingSkeleton />}>
          <ConfigurationsList />
        </Suspense>
      </div>
    </div>
  )
}

