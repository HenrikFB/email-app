'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { disconnectEmailConnection, toggleConnectionStatus, type EmailConnection } from '../email-connections/actions'

interface EmailConnectionCardProps {
  connection: EmailConnection
}

export default function EmailConnectionCard({ connection }: EmailConnectionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const handleDisconnect = async () => {
    setIsDeleting(true)
    try {
      await disconnectEmailConnection(connection.id)
    } catch (error) {
      console.error('Error disconnecting:', error)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleToggleStatus = async () => {
    setIsToggling(true)
    try {
      await toggleConnectionStatus(connection.id, !connection.is_active)
    } catch (error) {
      console.error('Error toggling status:', error)
    } finally {
      setIsToggling(false)
    }
  }

  if (showDeleteConfirm) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <CardTitle className="text-red-900">Confirm Disconnection</CardTitle>
          <CardDescription className="text-red-700">
            Are you sure you want to disconnect this email account? This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-red-900">{connection.email_address}</p>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            disabled={isDeleting}
          >
            {isDeleting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{connection.email_address}</CardTitle>
            <CardDescription>
              Connected {new Date(connection.created_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={connection.provider === 'Google' ? 'default' : 'secondary'}>
              {connection.provider}
            </Badge>
            <Badge variant={connection.is_active ? 'default' : 'secondary'}>
              {connection.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {connection.last_sync_at && (
          <p className="text-sm text-muted-foreground">
            Last synced: {new Date(connection.last_sync_at).toLocaleString()}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          <Link href={`/dashboard/emails?connection=${connection.id}`}>
            <Button variant="default">
              Browse Emails
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleToggleStatus}
            disabled={isToggling}
          >
            {isToggling ? 'Updating...' : connection.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Disconnect
        </Button>
      </CardFooter>
    </Card>
  )
}

