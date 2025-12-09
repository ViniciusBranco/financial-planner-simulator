import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Badge, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui'
import { useRecurringTransactions, useDeleteRecurringTransaction, useProjectTransactions, RecurringTransaction } from '@/hooks/useTransactions'
import { Plus, Pencil, Trash, Loader2, PlayCircle } from 'lucide-react'
import { RecurringTransactionDialog } from '@/features/recurring/components/RecurringTransactionDialog'

export default function RecurringPage() {
    const today = new Date()
    const [projectMonth, setProjectMonth] = useState(today.getMonth() + 1 === 12 ? 1 : today.getMonth() + 2)
    const [projectYear, setProjectYear] = useState(today.getMonth() + 1 === 12 ? today.getFullYear() + 1 : today.getFullYear())

    const { mutate: projectTx, isPending: isProjecting } = useProjectTransactions()

    const handleProject = () => {
        if (confirm(`Generate transactions for ${projectMonth}/${projectYear}? This will create pending transactions based on your ACTIVE templates.`)) {
            projectTx({ month: projectMonth, year: projectYear }, {
                onSuccess: (data: any) => {
                    alert(data.message)
                },
                onError: (err) => {
                    alert("Error: " + err.message)
                }
            })
        }
    }

    // CRUD State
    const { data: recurringList, isLoading } = useRecurringTransactions()
    const { mutate: deleteRecurring } = useDeleteRecurringTransaction()

    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Partial<RecurringTransaction>>({})

    const openCreate = () => {
        setEditingItem({})
        setIsEditOpen(true)
    }

    const openEdit = (item: RecurringTransaction) => {
        setEditingItem(item)
        setIsEditOpen(true)
    }

    const formatDate = (d: string) => {
        if (!d) return ''
        const [y, m, day] = d.split('-')
        return `${day}/${m}/${y.slice(2)}`
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Recurring Transactions</h1>
                    <p className="text-muted-foreground">Manage templates for fixed income and expenses (Rent, Salary, Subscriptions).</p>
                </div>

                {/* Project Section */}
                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PlayCircle className="w-5 h-5 text-blue-600" />
                            Project Transactions
                        </CardTitle>
                        <CardDescription>
                            Generate actual transactions for a future month based on active templates.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                        <select
                            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={projectMonth}
                            onChange={(e) => setProjectMonth(Number(e.target.value))}
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                        <select
                            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={projectYear}
                            onChange={(e) => setProjectYear(Number(e.target.value))}
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <Button onClick={handleProject} disabled={isProjecting}>
                            {isProjecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Generate for Month
                        </Button>
                    </CardContent>
                </Card>

                {/* List Section */}
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Templates</h2>
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="w-4 h-4" /> New Template
                    </Button>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Day</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Validity</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">Loading...</TableCell>
                                </TableRow>
                            ) : recurringList?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No templates found.</TableCell>
                                </TableRow>
                            ) : (
                                recurringList?.map(item => (
                                    <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                                        <TableCell className="font-medium">{item.day_of_month}</TableCell>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.type === 'INCOME' ? 'outline' : item.type === 'TRANSFER' ? 'secondary' : 'destructive'} className={item.type === 'INCOME' ? 'text-green-600 border-green-200 bg-green-50' : ''}>
                                                {item.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}</TableCell>
                                        <TableCell className="text-sm text-slate-500">
                                            {formatDate(item.start_date)} - {item.end_date ? formatDate(item.end_date) : '...'}
                                        </TableCell>
                                        <TableCell>
                                            {item.is_active ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Active</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                                <Pencil className="w-4 h-4 text-gray-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete?')) deleteRecurring(item.id) }}>
                                                <Trash className="w-4 h-4 text-rose-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Dialog */}
                <RecurringTransactionDialog
                    isOpen={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    initialData={editingItem}
                />
            </div>
        </DashboardLayout>
    )
}
