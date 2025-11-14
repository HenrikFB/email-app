'use client'

import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Email } from '@/lib/microsoft-graph/client'

interface EmailsDataTableProps {
  emails: Email[]
  selectedEmails: string[]
  onSelectionChange: (selected: string[]) => void
}

export function EmailsDataTable({ emails, selectedEmails, onSelectionChange }: EmailsDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const columns: ColumnDef<Email>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(!!value)
            if (value) {
              onSelectionChange(emails.map(email => email.id))
            } else {
              onSelectionChange([])
            }
          }}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedEmails.includes(row.original.id)}
          onCheckedChange={(value) => {
            if (value) {
              onSelectionChange([...selectedEmails, row.original.id])
            } else {
              onSelectionChange(selectedEmails.filter(id => id !== row.original.id))
            }
          }}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'from',
      header: 'From',
      cell: ({ row }) => {
        const from = row.original.from
        return (
          <div>
            {from.name && <div className="font-medium">{from.name}</div>}
            <div className="text-sm text-muted-foreground">{from.address}</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => {
        return (
          <div className="max-w-md">
            <div className="font-medium">{row.original.subject}</div>
            {row.original.snippet && (
              <div className="text-sm text-muted-foreground line-clamp-2">
                {row.original.snippet}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'receivedDateTime',
      header: 'Date',
      cell: ({ row }) => {
        const date = new Date(row.original.receivedDateTime)
        return (
          <div className="text-sm">
            <div>{date.toLocaleDateString()}</div>
            <div className="text-muted-foreground">{date.toLocaleTimeString()}</div>
          </div>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const email = row.original
        return (
          <div className="flex flex-col gap-1">
            {email.hasAttachments && (
              <Badge variant="secondary" className="w-fit">
                📎 Attachments
              </Badge>
            )}
            {email.isRead ? (
              <Badge variant="outline" className="w-fit">Read</Badge>
            ) : (
              <Badge variant="default" className="w-fit">Unread</Badge>
            )}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: emails,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  })

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={selectedEmails.includes(row.original.id) && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No emails found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
          {selectedEmails.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
