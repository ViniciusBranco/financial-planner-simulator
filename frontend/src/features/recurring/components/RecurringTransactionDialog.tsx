import { useEffect, useState } from "react"
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@/components/ui"
import { RecurringTransaction, useCreateRecurringTransaction, useUpdateRecurringTransaction } from "@/hooks/useTransactions"

interface RecurringTransactionDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    initialData?: Partial<RecurringTransaction>
    onSuccess?: () => void
}

export function RecurringTransactionDialog({ isOpen, onOpenChange, initialData, onSuccess }: RecurringTransactionDialogProps) {
    const defaultItem: Partial<RecurringTransaction> = {
        description: '',
        amount: 0,
        type: 'EXPENSE',
        day_of_month: 1,
        category_legacy: '',
        is_active: true,
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
    }

    const [editingItem, setEditingItem] = useState<Partial<RecurringTransaction>>(defaultItem)

    const { mutate: createRecurring, isPending: isCreating } = useCreateRecurringTransaction()
    const { mutate: updateRecurring, isPending: isUpdating } = useUpdateRecurringTransaction()

    useEffect(() => {
        if (isOpen) {
            setEditingItem({
                ...defaultItem,
                ...initialData,
                end_date: initialData?.end_date || '' // Ensure string for input
            })
        }
    }, [isOpen, initialData])

    const handleAmountBlur = () => {
        if (editingItem.type === 'EXPENSE' && (editingItem.amount || 0) > 0) {
            setEditingItem({ ...editingItem, amount: -(editingItem.amount || 0) })
        } else if (editingItem.type === 'INCOME' && (editingItem.amount || 0) < 0) {
            setEditingItem({ ...editingItem, amount: Math.abs(editingItem.amount || 0) })
        }
    }

    const handleSave = () => {
        if (!editingItem.description || !editingItem.amount || !editingItem.day_of_month || !editingItem.start_date) return

        const payload = {
            description: editingItem.description,
            amount: Number(editingItem.amount),
            type: editingItem.type || 'EXPENSE',
            day_of_month: Number(editingItem.day_of_month),
            category_legacy: editingItem.category_legacy || '',
            is_active: editingItem.is_active ?? true,
            start_date: editingItem.start_date,
            end_date: editingItem.end_date || null,
            source_type: (editingItem as any).source_type || 'XP_ACCOUNT'
        }

        const options = {
            onSuccess: () => {
                onOpenChange(false)
                if (onSuccess) onSuccess()
            }
        }

        if (editingItem.id) {
            updateRecurring({ id: editingItem.id, ...payload }, options)
        } else {
            createRecurring(payload as any, options)
        }
    }

    const isPending = isCreating || isUpdating

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingItem.id ? 'Edit Template' : 'New Template'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm">Description</label>
                        <Input className="col-span-3" value={editingItem.description} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm">Amount</label>
                        <Input type="number" step="0.01" className="col-span-3" value={editingItem.amount} onChange={e => setEditingItem({ ...editingItem, amount: Number(e.target.value) })} onBlur={handleAmountBlur} />
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm">Day (1-31)</label>
                        <Input type="number" min="1" max="31" className="col-span-3" value={editingItem.day_of_month} onChange={e => setEditingItem({ ...editingItem, day_of_month: Number(e.target.value) })} />
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm">Source</label>
                        <select
                            className="col-span-3 h-10 rounded-md border border-input bg-background px-3"
                            value={(editingItem as any).source_type || 'XP_ACCOUNT'}
                            onChange={e => setEditingItem({ ...editingItem, source_type: e.target.value } as any)}
                        >
                            <option value="XP_ACCOUNT">XP Account (Debit)</option>
                            <option value="XP_CARD">XP Card (Credit)</option>
                            <option value="MANUAL">Manual/Other</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm">Type</label>
                        <select
                            className="col-span-3 h-10 rounded-md border border-input bg-background px-3"
                            value={editingItem.type}
                            onChange={e => setEditingItem({ ...editingItem, type: e.target.value as any })}
                        >
                            <option value="INCOME">Income</option>
                            <option value="EXPENSE">Expense</option>
                            <option value="TRANSFER">Transfer</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm font-medium">Start Date</label>
                        <Input type="date" className="col-span-3" value={editingItem.start_date || ''} onChange={e => setEditingItem({ ...editingItem, start_date: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm text-slate-500">End Date</label>
                        <Input type="date" className="col-span-3" value={editingItem.end_date || ''} onChange={e => setEditingItem({ ...editingItem, end_date: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm">Category</label>
                        <Input className="col-span-3" value={editingItem.category_legacy} onChange={e => setEditingItem({ ...editingItem, category_legacy: e.target.value })} placeholder="Optional" />
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                        <label className="text-right text-sm">Active</label>
                        <input type="checkbox" className="w-5 h-5" checked={editingItem.is_active} onChange={e => setEditingItem({ ...editingItem, is_active: e.target.checked })} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
