import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Button, Checkbox, Badge } from '@/components/ui'
import { Transaction } from '@/hooks/useTransactions'
import { AlertTriangle } from 'lucide-react'

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
    const [year, month, day] = dateString.split('T')[0].split('-')
    return `${day}/${month}/${year}`
}

interface ReconciliationModalProps {
    candidates: Transaction[] // or a simplified shape
    isOpen: boolean
    onConfirm: (ids: string[]) => void
    onCancel: () => void
    isPending?: boolean
}

export function ReconciliationModal({ candidates, isOpen, onConfirm, onCancel, isPending }: ReconciliationModalProps) {
    // Default to all selected
    const [selectedIds, setSelectedIds] = useState<string[]>(candidates.map(c => c.id))

    const toggleSelection = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds([...selectedIds, id])
        } else {
            setSelectedIds(selectedIds.filter(x => x !== id))
        }
    }

    const toggleAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(candidates.map(c => c.id))
        } else {
            setSelectedIds([])
        }
    }

    const isAllSelected = candidates.length > 0 && selectedIds.length === candidates.length

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel() }}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-500 h-6 w-6" />
                        <DialogTitle>Duplicate Transactions Detected</DialogTitle>
                    </div>
                    <DialogDescription>
                        The following manual transactions match the imported data.
                        Select the ones you want to <strong>delete</strong> to avoid duplicates.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    <div className="flex items-center space-x-2 mb-4">
                        <Checkbox
                            id="select-all"
                            checked={isAllSelected}
                            onChange={(e) => toggleAll(e.target.checked)}
                        />
                        <label
                            htmlFor="select-all"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Select All
                        </label>
                    </div>

                    <div className="border rounded-md divide-y">
                        {candidates.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        id={`tx-${tx.id}`}
                                        checked={selectedIds.includes(tx.id)}
                                        onChange={(e) => toggleSelection(tx.id, e.target.checked)}
                                    />
                                    <div className="grid gap-1">
                                        <div className="font-medium text-sm">{tx.description}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <span>{formatDate(tx.date)}</span>
                                            {tx.category_legacy && <Badge variant="outline" className="text-[10px] h-4">{tx.category_legacy}</Badge>}
                                        </div>
                                    </div>
                                </div>
                                <div className={`font-bold text-sm ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(tx.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onCancel} disabled={isPending}>
                        Keep All (Don't Delete)
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => onConfirm(selectedIds)}
                        disabled={isPending || selectedIds.length === 0}
                    >
                        {isPending ? 'Processing...' : `Delete Selected (${selectedIds.length})`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
