import { useState, useMemo, useEffect } from "react"
import { DashboardLayout } from "@/components/DashboardLayout"
import { useSimulationProjection, SimulationItem, useScenarios, useCreateScenario, useAddScenarioItem } from "@/hooks/useTransactions"
import { Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Badge } from "@/components/ui"
import { Plus, Trash, RotateCcw, Save, Loader2, Database } from "lucide-react"
import { RecurringTransactionDialog } from '@/features/recurring/components/RecurringTransactionDialog'
import { useQueryClient } from '@tanstack/react-query'

export function SimulationPage() {
    const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null)
    const { data: scenarios } = useScenarios()
    const { data, isLoading } = useSimulationProjection(selectedScenarioId)
    const queryClient = useQueryClient()

    const [items, setItems] = useState<SimulationItem[]>([])
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isSaveOpen, setIsSaveOpen] = useState(false)
    const [isBaselineAddOpen, setIsBaselineAddOpen] = useState(false)
    const [newScenarioName, setNewScenarioName] = useState("")

    const createScenario = useCreateScenario()
    const addScenarioItem = useAddScenarioItem()

    // Initial Load & Scenario Switch
    useEffect(() => {
        if (data) {
            setItems(JSON.parse(JSON.stringify(data.items)))
        }
    }, [data])

    const handleReset = () => {
        if (confirm("Reset all changes and reload from baseline?")) {
            if (data) setItems(JSON.parse(JSON.stringify(data.items)))
        }
    }

    // Add Form State (Smart Add)
    const [newItem, setNewItem] = useState({
        name: '',
        amount: 0,
        installments: 1,
        startMonth: 0,
        type: 'EXPENSE' as 'INCOME' | 'EXPENSE'
    })

    const handleAddSmartItem = () => {
        const values = new Array(12).fill(0)
        const sign = newItem.type === 'EXPENSE' ? -1 : 1
        for (let i = 0; i < newItem.installments; i++) {
            const idx = newItem.startMonth + i
            if (idx < 12) {
                values[idx] = Math.abs(newItem.amount) * sign
            }
        }
        setItems([...items, {
            name: newItem.name,
            type: newItem.type,
            values,
            source: (newItem as any).source_type || 'MANUAL'
        }])
        setIsAddOpen(false)
        setNewItem({ name: '', amount: 0, installments: 1, startMonth: 0, type: 'EXPENSE' })
    }

    const addEmptyRow = () => {
        setItems([...items, {
            name: 'New Custom Item',
            type: 'EXPENSE',
            values: new Array(12).fill(0),
            source: 'MANUAL'
        }])
    }

    const removeItem = (index: number) => {
        const next = [...items]
        next.splice(index, 1)
        setItems(next)
    }

    const updateName = (index: number, name: string) => {
        const next = [...items]
        next[index].name = name
        setItems(next)
    }

    const updateValue = (index: number, monthIdx: number, valStr: string) => {
        const next = [...items]
        // Allow negative input
        const val = parseFloat(valStr)
        next[index].values[monthIdx] = isNaN(val) ? 0 : val
        setItems(next)
    }

    const handleBlur = (index: number, monthIdx: number) => {
        const item = items[index]
        const val = item.values[monthIdx]

        let needsUpdate = false
        if (item.type === 'EXPENSE' && val > 0) {
            item.values[monthIdx] = -val
            needsUpdate = true
        } else if (item.type === 'INCOME' && val < 0) {
            item.values[monthIdx] = Math.abs(val)
            needsUpdate = true
        }

        if (needsUpdate) {
            setItems([...items]) // Trigger re-render
        }
    }

    const handleSaveScenario = async () => {
        if (!newScenarioName.trim()) return

        try {
            // 1. Create Scenario
            const scenario = await createScenario.mutateAsync({ name: newScenarioName })

            // 2. Add Delta Items
            // Strategy: We flatten the matrix. Every non-baseline item is saved as a discrete monthly entry.
            // This is "lossy" regarding the original "Smart Logic" (e.g. recurrence) but "lossless" regarding the numbers.
            const promises: Promise<any>[] = []

            const today = new Date()

            items.forEach(item => {
                // Skip baseline/hardcoded items
                if (item.source === 'RECURRING' || item.source === 'INSTALLMENT') return

                item.values.forEach((val, idx) => {
                    if (val !== 0) {
                        // Calculate date: Start (Next Month) + idx
                        const itemDate = new Date(today.getFullYear(), today.getMonth() + 1 + idx, 1)
                        const dateStr = itemDate.toISOString().split('T')[0] // YYYY-MM-DD

                        // Push item creation
                        promises.push(addScenarioItem.mutateAsync({
                            scenarioId: scenario.id,
                            item: {
                                description: item.name,
                                amount: Math.abs(val),
                                type: val < 0 ? 'EXPENSE' : 'INCOME',
                                start_date: dateStr,
                                installments: 1,
                                is_recurring: false,
                                source_type: item.source || 'MANUAL'
                            }
                        }))
                    }
                })
            })

            await Promise.all(promises)

            setIsSaveOpen(false)
            setNewScenarioName("")
            setSelectedScenarioId(scenario.id) // Switch to new scenario

        } catch (err) {
            console.error(err)
            alert("Failed to save scenario")
        }
    }

    // Calculations
    const { monthlyNet, cumulativeNet, incomes, expenses } = useMemo(() => {
        const monthlyNet = new Array(12).fill(0)
        const incomes: { item: SimulationItem, index: number }[] = []
        const expenses: { item: SimulationItem, index: number }[] = []

        items.forEach((item, index) => {
            if (item.type === 'INCOME') incomes.push({ item, index })
            else expenses.push({ item, index })

            item.values.forEach((v, i) => {
                if (i < 12) monthlyNet[i] += v
            })
        })

        const cumulativeNet: number[] = []
        let running = 0
        monthlyNet.forEach(v => {
            running += v
            cumulativeNet.push(running)
        })

        return { monthlyNet, cumulativeNet, incomes, expenses }
    }, [items])


    const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    if (isLoading && items.length === 0) return <DashboardLayout>Loading...</DashboardLayout>

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Financial Simulation</h1>

                    <div className="flex items-center gap-2">
                        <select
                            className="bg-transparent border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={selectedScenarioId ?? ""}
                            onChange={(e) => setSelectedScenarioId(e.target.value ? parseInt(e.target.value) : null)}
                        >
                            <option value="">Baseline (No Scenario)</option>
                            {scenarios?.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>

                        <Button variant="outline" size="icon" onClick={handleReset} title="Reset to Baseline/Reload">
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={() => setIsSaveOpen(true)}>
                            <Save className="mr-2 h-4 w-4" /> Save as Scenario
                        </Button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsBaselineAddOpen(true)} className="border-dashed border-primary/50 text-primary">
                        <Database className="mr-2 h-4 w-4" /> Add to Baseline (Real)
                    </Button>
                    <Button variant="outline" onClick={addEmptyRow}>
                        <Plus className="mr-2 h-4 w-4" /> Add Empty Row
                    </Button>
                    <Button onClick={() => setIsAddOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Add Smart Item
                    </Button>
                </div>
            </div>

            <Card className="border-t-4 border-t-primary/20">
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px] min-w-[200px] sticky left-0 bg-background z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Name</TableHead>
                                <TableHead className="w-[100px]">Source</TableHead>
                                {data?.month_headers.map(h => (
                                    <TableHead key={h} className="min-w-[100px] text-right">{h}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* INCOMES */}
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableCell colSpan={2 + (data?.month_headers.length || 12)} className="font-bold text-emerald-700 sticky left-0 z-20 bg-slate-50">INCOME</TableCell>
                            </TableRow>
                            {incomes.map(({ item, index }) => (
                                <TableRow key={`inc - ${index} `}>
                                    <TableCell className="sticky left-0 bg-background z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] p-1">
                                        <Input
                                            value={item.name}
                                            onChange={e => updateName(index, e.target.value)}
                                            className="h-8 border-transparent focus:border-input bg-transparent font-medium"
                                        />
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <div className="flex items-center justify-between group">
                                            <Badge variant="secondary" className="text-[10px] scale-90 origin-left">
                                                {item.source}
                                            </Badge>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(index)}>
                                                <Trash className="h-3 w-3 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    {item.values.map((v, i) => (
                                        <TableCell key={i} className="p-1">
                                            <Input
                                                type="number"
                                                value={v}
                                                onChange={e => updateValue(index, i, e.target.value)}
                                                onBlur={() => handleBlur(index, i)}
                                                className={`h - 8 border - transparent focus: border - input bg - transparent text - right ${v > 0 ? 'text-emerald-600' : 'text-slate-400'} `}
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}

                            {/* EXPENSES */}
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableCell colSpan={2 + (data?.month_headers.length || 12)} className="font-bold text-rose-700 sticky left-0 z-20 bg-slate-50">EXPENSES</TableCell>
                            </TableRow>
                            {expenses.map(({ item, index }) => (
                                <TableRow key={`exp - ${index} `}>
                                    <TableCell className="sticky left-0 bg-background z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] p-1">
                                        <Input
                                            value={item.name}
                                            onChange={e => updateName(index, e.target.value)}
                                            className="h-8 border-transparent focus:border-input bg-transparent font-medium"
                                        />
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <div className="flex items-center justify-between group">
                                            <Badge variant="secondary" className="text-[10px] scale-90 origin-left">
                                                {item.source}
                                            </Badge>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(index)}>
                                                <Trash className="h-3 w-3 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    {item.values.map((v, i) => (
                                        <TableCell key={i} className="p-1">
                                            <Input
                                                type="number"
                                                value={v}
                                                onChange={e => updateValue(index, i, e.target.value)}
                                                onBlur={() => handleBlur(index, i)}
                                                className={`h - 8 border - transparent focus: border - input bg - transparent text - right ${v < 0 ? 'text-rose-600' : 'text-slate-400'} `}
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}

                            {/* TOTALS */}
                            <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-200">
                                <TableCell className="sticky left-0 bg-slate-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">NET MONTHLY</TableCell>
                                <TableCell></TableCell>
                                {monthlyNet.map((v, i) => (
                                    <TableCell key={i} className={`text - right ${v >= 0 ? 'text-emerald-700' : 'text-rose-700'} `}>
                                        {formatMoney(v)}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow className="bg-slate-200 font-bold">
                                <TableCell className="sticky left-0 bg-slate-200 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">CUMULATIVE</TableCell>
                                <TableCell></TableCell>
                                {cumulativeNet.map((v, i) => (
                                    <TableCell key={i} className={`text - right ${v >= 0 ? 'text-emerald-900' : 'text-rose-900'} `}>
                                        {formatMoney(v)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ADD ITEM DIALOG */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Smart Item</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label>Description</label>
                            <Input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <label>Amount (positive)</label>
                                <Input type="number" value={newItem.amount} onChange={e => setNewItem({ ...newItem, amount: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid gap-2">
                                <label>Type</label>
                                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1"
                                    value={newItem.type}
                                    onChange={e => setNewItem({ ...newItem, type: e.target.value as any })}
                                >
                                    <option value="EXPENSE">Expense</option>
                                    <option value="INCOME">Income</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <label>Installments (Months)</label>
                                <Input type="number" min="1" max="12" value={newItem.installments} onChange={e => setNewItem({ ...newItem, installments: parseInt(e.target.value) })} />
                            </div>
                            <div className="grid gap-2">
                                <label>Source</label>
                                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1"
                                    value={(newItem as any).source_type || 'MANUAL'}
                                    onChange={e => setNewItem({ ...newItem, source_type: e.target.value } as any)}
                                >
                                    <option value="MANUAL">Manual</option>
                                    <option value="XP_ACCOUNT">XP Account</option>
                                    <option value="XP_CARD">XP Card</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <label>Start Month (0=Next)</label>
                            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1"
                                value={newItem.startMonth}
                                onChange={e => setNewItem({ ...newItem, startMonth: parseInt(e.target.value) })}
                            >
                                {data?.month_headers.map((h, i) => (
                                    <option key={i} value={i}>{h}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddSmartItem}>Add</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SAVE SCENARIO DIALOG */}
            <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save as Scenario</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label>Scenario Name</label>
                            <Input
                                placeholder="e.g. Buying a Tesla"
                                value={newScenarioName}
                                onChange={e => setNewScenarioName(e.target.value)}
                            />
                        </div>
                        <p className="text-sm text-slate-500">
                            This will save all current "Simulation", "Manual", and "Scenario" items as a new Scenario.
                            Baseline items (RECURRING, INSTALLMENT) are excluded.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveScenario} disabled={!newScenarioName.trim() || createScenario.isPending}>
                            {createScenario.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Scenario
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <RecurringTransactionDialog
                isOpen={isBaselineAddOpen}
                onOpenChange={setIsBaselineAddOpen}
                onSuccess={() => {
                    // Refetch simulation to show new baseline item immediately
                    queryClient.invalidateQueries({ queryKey: ['simulation'] })
                    queryClient.invalidateQueries({ queryKey: ['recurring'] })
                }}
            />

        </DashboardLayout>
    )
}
