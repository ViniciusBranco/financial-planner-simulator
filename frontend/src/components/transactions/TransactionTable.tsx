import React, { useState, useMemo, useEffect } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
    PaginationState,
} from '@tanstack/react-table'
import { Transaction, useUpdateTransaction, useDeleteTransaction } from '@/hooks/useTransactions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input } from '@/components/ui'
import { Repeat, ArrowLeft, ArrowRight, Pencil, Trash, CreditCard, Wallet, User, RefreshCw } from 'lucide-react'

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(amount)
}

// Helper to format date
const formatDate = (dateString: string) => {
    if (!dateString) return ''
    // Avoid timezone issues by splitting string directly (YYYY-MM-DD)
    const [year, month, day] = dateString.split('T')[0].split('-')
    return `${day}/${month}/${year}`
}

const columnHelper = createColumnHelper<Transaction>()

interface TransactionTableProps {
    data: Transaction[]
    pageCount: number
    pagination: PaginationState
    setPagination: React.Dispatch<React.SetStateAction<PaginationState>>
}

export function TransactionTable({ data, pageCount, pagination, setPagination }: TransactionTableProps) {
    const [editingTx, setEditingTx] = useState<Transaction | null>(null)
    const { mutateAsync: updateTransaction } = useUpdateTransaction()
    const { mutate: deleteTransaction } = useDeleteTransaction()

    // Edit Form State
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        date: '',
        category: '',
        type: 'EXPENSE' as 'INCOME' | 'EXPENSE' | 'TRANSFER'
    })

    useEffect(() => {
        if (editingTx) {
            setFormData({
                description: editingTx.description,
                amount: String(editingTx.amount),
                date: editingTx.date,
                category: editingTx.category_name || editingTx.category_legacy || '',
                type: editingTx.type
            })
        }
    }, [editingTx])

    const handleSave = async () => {
        if (!editingTx) return

        // Support comma as decimal separator
        const normalizedAmount = typeof formData.amount === 'string'
            ? formData.amount.replace(',', '.')
            : String(formData.amount)

        const amountVal = parseFloat(normalizedAmount)
        if (isNaN(amountVal)) {
            alert("Invalid amount")
            return
        }

        try {
            await updateTransaction({
                id: editingTx.id,
                description: formData.description,
                amount: amountVal,
                date: formData.date,
                type: formData.type,
                category_legacy: formData.category // Sends as category (legacy) for now or update backend to handle renaming
            })
            setEditingTx(null)
        } catch (error: any) {
            console.error("Failed to update transaction", error)
            alert(error.message || "Failed to update transaction")
        }
    }

    const handleDelete = (id: string) => {
        if (window.confirm("Are you sure you want to delete this transaction?")) {
            deleteTransaction(id)
        }
    }

    const columns = useMemo(() => [
        columnHelper.accessor('date', {
            header: 'Date',
            cell: (info) => formatDate(info.getValue()),
        }),
        columnHelper.accessor('description', {
            header: 'Description',
            cell: (info) => (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="font-bold">{info.getValue()}</span>
                        {info.row.original.manual_tag && (
                            <Badge variant="secondary" className="text-[10px] px-1 h-5 text-gray-500">
                                {info.row.original.manual_tag}
                            </Badge>
                        )}
                    </div>
                    {info.row.original.installment_total && info.row.original.installment_total > 1 && (
                        <div className="mt-1">
                            <Badge variant="outline" className="text-[10px] px-1 h-4 bg-blue-50 text-blue-700 border-blue-200">
                                {info.row.original.installment_n}/{info.row.original.installment_total}
                            </Badge>
                        </div>
                    )}
                </div>
            ),
        }),
        columnHelper.accessor('cardholder', {
            header: () => <span className="hidden md:inline">Cardholder</span>,
            cell: (info) => {
                const val = info.getValue()
                if (!val) return null
                const initial = val.charAt(0).toUpperCase()
                const colorClass = initial === 'V' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'
                return (
                    <div className="hidden md:flex items-center gap-1">
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${colorClass}`} title={val}>
                            {initial}
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{val}</span>
                    </div>
                )
            },
        }),
        columnHelper.accessor('category_name', {
            header: 'Category',
            cell: (info) => {
                const type = info.row.original.type
                let variant: any = 'outline'
                if (type === 'INCOME') variant = 'success'
                else if (type === 'EXPENSE') variant = 'warning'
                else variant = 'secondary' // TRANSFER

                return (
                    <Badge variant={variant}>
                        {info.getValue() || info.row.original.category_legacy || 'Uncategorized'}
                    </Badge>
                )
            },
        }),
        columnHelper.accessor('source_type', {
            header: 'Source',
            cell: (info) => {
                const type = info.getValue()
                let Icon = User
                let className = "text-gray-500"
                let title = "Manual"

                if (type === 'XP_CARD') { Icon = CreditCard; className = "text-purple-600"; title = "XP Card" }
                else if (type === 'XP_ACCOUNT') { Icon = Wallet; className = "text-green-600"; title = "XP Account" }
                else if (type === 'RECURRING') { Icon = RefreshCw; className = "text-blue-500"; title = "Recurring" }

                return (
                    <div className="flex items-center gap-1" title={title}>
                        <Icon className={`w-4 h-4 ${className}`} />
                        <span className="text-xs text-muted-foreground hidden lg:inline">{title}</span>
                    </div>
                )
            },
        }),
        columnHelper.accessor('amount', {
            header: 'Amount',
            cell: (info) => {
                const amount = info.getValue()
                const type = info.row.original.type
                let color = 'text-gray-900'
                if (type === 'INCOME') color = 'text-green-600'
                else if (type === 'EXPENSE') color = 'text-red-600'
                else color = 'text-blue-600' // TRANSFER

                return <div className={`text-right font-medium ${color}`}>{formatCurrency(amount)}</div>
            },
        }),
        columnHelper.accessor('is_recurring', {
            header: 'Recurrence',
            cell: (info) => info.getValue() ? <Repeat className="h-4 w-4 text-gray-500" /> : null,
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: (info) => (
                <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTx(info.row.original)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(info.row.original.id)}>
                        <Trash className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        }),
    ], [])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        pageCount: pageCount,
        state: {
            pagination,
        },
        onPaginationChange: setPagination,
        manualPagination: true,
    })

    // Calculate sum of currently displayed rows (matches Bank Invoice if filtered by Source)
    const filteredTotal = table.getRowModel().rows.reduce((sum, row) => {
        // Exclude credit card bill payments as they serve to settle the balance, not part of "spending" sum for invoice check
        if (row.original.description?.toLowerCase().includes('pagamento de fatura')) {
            return sum
        }

        const val = Number(row.original.amount)
        return sum + (isNaN(val) ? 0 : val)
    }, 0)

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-lg border shadow-sm">
                    <span className="text-sm font-medium text-muted-foreground">Total Listado:</span>
                    <span className={`text-lg font-bold ${filteredTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(filteredTotal)}
                    </span>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                </Button>
                <div className="flex-1 text-center text-sm text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Transaction</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label htmlFor="date" className="text-sm font-medium">Date</label>
                            <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="desc" className="text-sm font-medium">Description</label>
                            <Input id="desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <label htmlFor="amount" className="text-sm font-medium">Amount</label>
                                <Input id="amount" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="type" className="text-sm font-medium">Type</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                >
                                    <option value="INCOME">Income</option>
                                    <option value="EXPENSE">Expense</option>
                                    <option value="TRANSFER">Transfer</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="category" className="text-sm font-medium">Category</label>
                            <Input id="category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTx(null)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
