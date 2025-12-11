import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Button,
    Select,
    Checkbox
} from "@/components/ui"
import { useAutoCategorize } from "@/hooks/useTransactions"
import { Loader2, Bot } from "lucide-react"

type AICategorizeDialogProps = {
    isOpen: boolean
    onClose: () => void
    currentMonth?: number
    currentYear?: number
}

export function AICategorizeDialog({ isOpen, onClose, currentMonth, currentYear }: AICategorizeDialogProps) {
    const [month, setMonth] = useState<number>(currentMonth || new Date().getMonth() + 1)
    const [year, setYear] = useState<number>(currentYear || new Date().getFullYear())
    const [force, setForce] = useState(false)

    // Reset state when dialog opens with new props
    useEffect(() => {
        if (isOpen) {
            setMonth(currentMonth || new Date().getMonth() + 1)
            setYear(currentYear || new Date().getFullYear())
            setForce(false)
        }
    }, [isOpen, currentMonth, currentYear])

    const autoCategorize = useAutoCategorize()

    const handleRun = async () => {
        try {
            await autoCategorize.mutateAsync({ month, year, force })
            onClose()
        } catch (error) {
            console.error(error)
        }
    }

    const MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-indigo-600" />
                        AI Categorization Manager
                    </DialogTitle>
                    <DialogDescription>
                        Select a period to run the AI agent. Warning: This uses local GPU resources and may take a moment.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Month</label>
                            <Select
                                value={month}
                                onChange={(e) => setMonth(parseInt(e.target.value))}
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={i} value={i + 1}>{m}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Year</label>
                            <Select
                                value={year}
                                onChange={(e) => setYear(parseInt(e.target.value))}
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 border rounded-md p-3 bg-muted/30">
                        <Checkbox
                            id="force"
                            checked={force}
                            onChange={(e) => setForce(e.target.checked)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="force"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Force Re-categorize
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Overwrite existing categories if checked.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between items-center">
                    <Button variant="ghost" onClick={onClose} disabled={autoCategorize.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleRun}
                        disabled={autoCategorize.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        {autoCategorize.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {autoCategorize.isPending ? 'Processing...' : 'Run AI Agent'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
