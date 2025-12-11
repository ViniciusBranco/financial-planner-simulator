import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Button,
    Select
} from "@/components/ui"
import { useBatchDeleteTransactions } from "@/hooks/useTransactions"
import { Loader2, Trash2, AlertTriangle } from "lucide-react"

type BulkDeleteDialogProps = {
    isOpen: boolean
    onClose: () => void
    currentMonth?: number
    currentYear?: number
}

export function BulkDeleteDialog({ isOpen, onClose, currentMonth, currentYear }: BulkDeleteDialogProps) {
    const [month, setMonth] = useState<number>(currentMonth || new Date().getMonth() + 1)
    const [year, setYear] = useState<number>(currentYear || new Date().getFullYear())
    const [scope, setScope] = useState<string>('ALL') // ALL, XP_CARD, XP_ACCOUNT, MANUAL

    const batchDelete = useBatchDeleteTransactions()

    // Sync props to state
    useEffect(() => {
        if (isOpen) {
            setMonth(currentMonth || new Date().getMonth() + 1)
            setYear(currentYear || new Date().getFullYear())
            setScope('ALL')
        }
    }, [isOpen, currentMonth, currentYear])

    const handleDelete = async () => {
        try {
            const sourceType = scope === 'ALL' ? undefined : scope
            const res = await batchDelete.mutateAsync({
                month,
                year,
                source_type: sourceType
            })
            alert(res.message) // Simple feedback
            onClose()
        } catch (error) {
            console.error(error)
            alert("Failed to delete transactions")
        }
    }

    const MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md border-destructive/50">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <Trash2 className="h-5 w-5" />
                        Batch Delete Transactions
                    </DialogTitle>
                    <DialogDescription>
                        Permanently remove transactions for <strong>{MONTHS[month - 1]} {year}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-destructive/10 p-3 rounded-md flex items-start gap-2 text-sm text-destructive my-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <p>Warning: This action cannot be undone. Please verify the scope below.</p>
                </div>

                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Delete Scope</label>
                        <Select
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                            className="w-full"
                        >
                            <option value="ALL">All Transactions (Danger)</option>
                            <option value="XP_CARD">Only XP Card (Credit)</option>
                            <option value="XP_ACCOUNT">Only XP Account (Debit)</option>
                            <option value="MANUAL">Only Manual Entries</option>
                        </Select>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between items-center">
                    <Button variant="ghost" onClick={onClose} disabled={batchDelete.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDelete}
                        disabled={batchDelete.isPending}
                        variant="destructive"
                        className="gap-2"
                    >
                        {batchDelete.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {batchDelete.isPending ? 'Deleting...' : 'Confirm Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
