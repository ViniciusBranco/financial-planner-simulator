
import { useState, useMemo, useEffect } from "react"
import { DashboardLayout } from "@/components/DashboardLayout"
import { useSimulationProjection, SimulationItem, useScenarios, useCreateScenario, useAddScenarioItem, useAverageSpending, useDeleteScenario } from "@/hooks/useTransactions"
import { Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Badge, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui"
import { Plus, Trash, RotateCcw, Save, Loader2, Database, Sparkles, Trash2 } from "lucide-react"
import { RecurringTransactionDialog } from '@/features/recurring/components/RecurringTransactionDialog'
import { useQueryClient } from '@tanstack/react-query'

export function SimulationPage() {
    const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null)
    const { data: scenarios } = useScenarios()
    const { data, isLoading } = useSimulationProjection(selectedScenarioId)
    const queryClient = useQueryClient()
    const { refetch: fetchAverage } = useAverageSpending()
    const deleteScenario = useDeleteScenario()

    const [items, setItems] = useState<SimulationItem[]>([])

    // NOTE: 'items' state represents the GROUPED view.
    // When saving, we iterate over these grouped items and "explode" them back into 
    // discrete monthly ScenarioItems for any non-zero value.
    // This allows the Pivot Table UX (one row, many columns) to map correctly to the DB model (many rows, time-based).
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isSaveOpen, setIsSaveOpen] = useState(false)
    const [isBaselineAddOpen, setIsBaselineAddOpen] = useState(false)
    const [newScenarioName, setNewScenarioName] = useState("")

    // Project Variable Spend State
    const [isProjectOpen, setIsProjectOpen] = useState(false)
    const [projectAmount, setProjectAmount] = useState<number>(0)

    // Delete Scenario State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)


    const createScenario = useCreateScenario()
    const addScenarioItem = useAddScenarioItem()

    // Initial Load & Scenario Switch: Group Items for Pivot View
    useEffect(() => {
        if (data && data.items) {
            const rawItems = JSON.parse(JSON.stringify(data.items)) as SimulationItem[]
            const groupedMap = new Map<string, SimulationItem>()

            rawItems.forEach(item => {
                // Key excludes 'values' but includes identifying metadata to group rows
                // We normalize the name to ensure "Despesas Variáveis" matches regardless of minor differences if any,
                // but strictly grouping by exact name is safer for now.
                const key = `${item.name.trim()}| ${item.type}| ${item.source} `

                if (groupedMap.has(key)) {
                    const existing = groupedMap.get(key)!
                    // Merge values: sum them up column by column
                    // This creates the "Pivot" effect where multiple monthly items become one row with values spread across columns
                    const newValues = existing.values.map((v, i) => v + (item.values[i] || 0))
                    existing.values = newValues
                } else {
                    // Initialize with a copy to avoid reference issues
                    groupedMap.set(key, { ...item, values: [...item.values] })
                }
            })

            setItems(Array.from(groupedMap.values()))
        }
    }, [data])

    const handleReset = () => {
        if (confirm("Reset all changes and reload from baseline?")) {
            if (data) setItems(JSON.parse(JSON.stringify(data.items)))
        }
    }

    const handleDeleteScenario = async () => {
        if (selectedScenarioId) {
            try {
                await deleteScenario.mutateAsync(selectedScenarioId)
                setSelectedScenarioId(null)
                setIsDeleteDialogOpen(false)
            } catch (error) {
                console.error("Failed to delete scenario", error)
                alert("Failed to delete scenario")
            }
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

    const handleProjectVariableSpend = async () => {
        try {
            const { data } = await fetchAverage()
            if (data) {
                setProjectAmount(Math.round(data.average)) // Round for nicer UX
                setIsProjectOpen(true)
            }
        } catch (e) {
            alert("Failed to fetch average spending")
        }
    }

    const confirmProjectVariableSpend = async () => {
        try {
            // 1. Create Scenario
            const scenarioName = "Orçamento Variável (Estimado)"
            const scenario = await createScenario.mutateAsync({ name: scenarioName })

            // 2. Add Item: "Despesas Variáveis (Não Parceladas)"
            // Start Next Month -> End of Year (or 12 months?)
            // Prompt says: "Next month until Dec 2026"

            const today = new Date()
            const year = today.getFullYear()
            const targetEndYear = 2026
            const targetEndMonth = 11 // Dec

            // Calculate starting month (Next Month)
            let currentIterDate = new Date(year, today.getMonth() + 1, 1)
            const endDate = new Date(targetEndYear, targetEndMonth, 1)

            const promises: Promise<any>[] = []

            while (currentIterDate <= endDate) {
                const dateStr = currentIterDate.toISOString().split('T')[0]
                const finalAmount = -Math.abs(Number(projectAmount))

                promises.push(addScenarioItem.mutateAsync({
                    scenarioId: scenario.id,
                    item: {
                        description: "Despesas Variáveis (Não Parceladas)",
                        amount: finalAmount,
                        type: 'EXPENSE',
                        start_date: dateStr,
                        installments: 1,
                        is_recurring: false,
                        source_type: 'XP_CARD'
                    }
                }))

                // Advance 1 month
                currentIterDate.setMonth(currentIterDate.getMonth() + 1)
            }

            await Promise.all(promises)

            setIsProjectOpen(false)
            setSelectedScenarioId(scenario.id)

        } catch (error) {
            console.error(error)
            alert("Failed to create projection scenario")
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

                        {selectedScenarioId && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setIsDeleteDialogOpen(true)}
                                title="Delete Scenario"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}

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
                    <Button
                        variant="default"
                        onClick={handleProjectVariableSpend}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <Sparkles className="mr-2 h-4 w-4" /> Project Variable Spend
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

            {/* PROJECT VARIABLE SPEND DIALOG */}
            <Dialog open={isProjectOpen} onOpenChange={setIsProjectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Project Variable Spend</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <p className="text-sm text-slate-600">
                            Based on your usage, your projected variable card spend is <strong>{formatMoney(projectAmount)}</strong>.
                        </p>
                        <p className="text-sm text-slate-500">
                            Do you want to create a Scenario "Orçamento Variável" adding this amount to future months (until Dec 2026)?
                        </p>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Adjust Amount</label>
                            <Input
                                type="number"
                                value={projectAmount}
                                onChange={e => setProjectAmount(parseFloat(e.target.value))}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Este valor será registrado como despesa mensal (negativo).
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsProjectOpen(false)}>Cancel</Button>
                        <Button onClick={confirmProjectVariableSpend} className="bg-purple-600 hover:bg-purple-700">
                            <Sparkles className="mr-2 h-4 w-4" /> Create Scenario
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this scenario and all of its simulated items. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteScenario} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
