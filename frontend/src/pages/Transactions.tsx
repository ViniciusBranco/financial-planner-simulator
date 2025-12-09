import { useState } from 'react'
import { useTransactions, useCreateTransaction, useAutoCategorize } from '@/hooks/useTransactions'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { Input, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui'
import { PaginationState, SortingState } from '@tanstack/react-table'
import { DashboardLayout } from '@/components/DashboardLayout'
import { DataImport } from '@/features/transactions/components/DataImport'
import { ChevronDown, ChevronUp, Plus, ChevronLeft, ChevronRight, Bot } from 'lucide-react'

export default function TransactionsPage() {
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 50,
    })
    const [sorting, setSorting] = useState<SortingState>([]) // Default no sort (backend defaults to date desc)

    const [search, setSearch] = useState('')
    const [month, setMonth] = useState<number | undefined>(new Date().getMonth() + 1)
    const [year, setYear] = useState<number | undefined>(new Date().getFullYear())
    const [filterType, setFilterType] = useState<'ALL' | 'RECURRING' | 'VARIABLE'>('ALL')
    const [showImport, setShowImport] = useState(false)
    const [sourceType, setSourceType] = useState<string>('')

    const handlePrevMonth = () => {
        if (!month || !year) return
        if (month === 1) {
            setMonth(12)
            setYear(year - 1)
        } else {
            setMonth(month - 1)
        }
    }

    const handleNextMonth = () => {
        if (!month || !year) return
        if (month === 12) {
            setMonth(1)
            setYear(year + 1)
        } else {
            setMonth(month + 1)
        }
    }

    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const { mutate: createTransaction } = useCreateTransaction()
    const [newTx, setNewTx] = useState({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE' as 'INCOME' | 'EXPENSE' | 'TRANSFER',
        category: ''
    })

    const isRecurringFilter = filterType === 'ALL' ? undefined : filterType === 'RECURRING'

    const { data, isLoading, isError } = useTransactions({
        skip: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        month,
        year,
        search: search || undefined,
        is_recurring: isRecurringFilter,
        source_type: sourceType || undefined,
        sort_by: sorting.length > 0 ? sorting[0].id : undefined,
        sort_order: sorting.length > 0 ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
    })

    const handleCreate = () => {
        if (!newTx.description || !newTx.amount || !newTx.date) return

        let amountVal = parseFloat(newTx.amount)
        if (isNaN(amountVal)) return

        // Auto-correct sign based on type
        if (newTx.type === 'EXPENSE' && amountVal > 0) amountVal = -amountVal
        if (newTx.type === 'INCOME' && amountVal < 0) amountVal = -amountVal

        createTransaction({
            description: newTx.description,
            amount: amountVal,
            date: newTx.date,
            type: newTx.type,
            category_legacy: newTx.category,
            source_type: 'MANUAL'
        }, {
            onSuccess: () => {
                setIsCreateOpen(false)
                setNewTx({
                    description: '',
                    amount: '',
                    date: new Date().toISOString().split('T')[0],
                    type: 'EXPENSE',
                    category: ''
                })
            }
        })
    }

    const { mutate: autoCategorize, isPending: isCategorizing } = useAutoCategorize()
    const handleAutoCategorize = () => {
        autoCategorize(100, {
            onSuccess: (res: any) => {
                const msg = res.message || "Categorization complete."
                alert(msg)
            },
            onError: () => {
                alert("Failed to run auto-categorization.")
            }
        })
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto space-y-6">
                <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
                            <p className="text-muted-foreground">Manage and view your financial transactions.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleAutoCategorize}
                                disabled={isCategorizing}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                            >
                                {isCategorizing ? (
                                    <>
                                        <Bot className="h-4 w-4 animate-spin" /> Processing...
                                    </>
                                ) : (
                                    <>
                                        <Bot className="h-4 w-4" /> Auto-Categorize
                                    </>
                                )}
                            </Button>
                            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                New Transaction
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowImport(!showImport)}
                                className="gap-2"
                            >
                                {showImport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                {showImport ? "Hide Import" : "Import Data"}
                            </Button>
                        </div>
                    </div>
                </div>

                {showImport && (
                    <div className="mb-8 animate-in slide-in-from-top-4 duration-300">
                        <DataImport />
                    </div>
                )}

                <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
                    {/* Search - Left Aligned */}
                    <div className="flex items-center gap-2 w-full xl:w-auto">
                        <Input
                            placeholder="Search description..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full md:w-[300px]"
                        />
                    </div>

                    {/* Nav, Filters, and Total - Right Aligned (Cluster) */}
                    <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto justify-end">
                        {/* Month/Year/Source Selection */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <select
                                    className="flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 w-[140px]"
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                        <option key={m} value={m}>
                                            {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                                <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <select
                                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 w-[100px]"
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <select
                                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 w-[130px]"
                                value={sourceType}
                                onChange={(e) => setSourceType(e.target.value)}
                            >
                                <option value="">All Sources</option>
                                <option value="XP_CARD">XP Card</option>
                                <option value="XP_ACCOUNT">XP Account</option>
                                <option value="MANUAL">Manual</option>
                                <option value="RECURRING">Recurring</option>
                            </select>
                        </div>

                        {/* Filter Type Buttons */}
                        <div className="flex items-center gap-1 border rounded-md p-1">
                            <Button
                                variant={filterType === 'ALL' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setFilterType('ALL')}
                            >
                                All
                            </Button>
                            <Button
                                variant={filterType === 'RECURRING' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setFilterType('RECURRING')}
                            >
                                Recurring
                            </Button>
                            <Button
                                variant={filterType === 'VARIABLE' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setFilterType('VARIABLE')}
                            >
                                Variable
                            </Button>
                        </div>

                        {/* Total Listado */}
                        <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border shadow-sm whitespace-nowrap">
                            <span className="text-sm font-medium text-muted-foreground">Total:</span>
                            <span className={`text-base font-bold ${(data?.items || []).reduce((sum: number, row: any) => {
                                if (row.description?.toLowerCase().includes('pagamento de fatura')) return sum
                                const val = Number(row.amount)
                                return sum + (isNaN(val) ? 0 : val)
                            }, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                    (data?.items || []).reduce((sum: number, row: any) => {
                                        if (row.description?.toLowerCase().includes('pagamento de fatura')) return sum
                                        const val = Number(row.amount)
                                        return sum + (isNaN(val) ? 0 : val)
                                    }, 0)
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div>Loading...</div>
                ) : isError ? (
                    <div>Error loading transactions</div>
                ) : (
                    <TransactionTable
                        data={data?.items || []}
                        pageCount={data ? Math.ceil(data.total / data.size) : 0}
                        pagination={pagination}
                        setPagination={setPagination}
                        sorting={sorting}
                        setSorting={setSorting}
                    />
                )}

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>New Transaction</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label htmlFor="new-date" className="text-sm font-medium">Date</label>
                                <Input id="new-date" type="date" value={newTx.date} onChange={(e) => setNewTx({ ...newTx, date: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="new-desc" className="text-sm font-medium">Description</label>
                                <Input id="new-desc" value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <label htmlFor="new-amount" className="text-sm font-medium">Amount</label>
                                    <Input
                                        id="new-amount"
                                        type="number"
                                        step="0.01"
                                        value={newTx.amount}
                                        onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label htmlFor="new-type" className="text-sm font-medium">Type</label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={newTx.type}
                                        onChange={(e) => setNewTx({ ...newTx, type: e.target.value as any })}
                                        id="new-type"
                                    >
                                        <option value="INCOME">Income</option>
                                        <option value="EXPENSE">Expense</option>
                                        <option value="TRANSFER">Transfer</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="new-category" className="text-sm font-medium">Category</label>
                                <Input id="new-category" value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate}>Create Transaction</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
