import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Button,
    Input
} from "@/components/ui"
import { usePayInvoice } from '@/hooks/useTransactions'
import { CreditCard, Wallet } from 'lucide-react'

interface PayInvoiceDialogProps {
    isOpen: boolean
    onClose: () => void
}

export function PayInvoiceDialog({ isOpen, onClose }: PayInvoiceDialogProps) {
    const { mutate: payInvoice } = usePayInvoice()
    const [amount, setAmount] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])

    const handleConfirm = () => {
        const amountVal = parseFloat(amount.replace(',', '.'))
        if (isNaN(amountVal) || amountVal <= 0) return

        payInvoice({
            amount: amountVal,
            date: date
        }, {
            onSuccess: () => {
                onClose()
                setAmount('')
                // Don't reset date as user might want to pay another
            }
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        Pay Credit Card Invoice
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="p-3 bg-blue-50 text-blue-800 rounded-md text-sm border border-blue-100 flex gap-2">
                        <Wallet className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>This will deduct from <strong>XP Account</strong> and reduce <strong>XP Card</strong> debt.</p>
                    </div>

                    <div className="grid gap-2">
                        <label htmlFor="inv-amount" className="text-sm font-medium">Invoice Amount (R$)</label>
                        <Input
                            id="inv-amount"
                            type="number"
                            step="0.01"
                            placeholder="e.g. 1500.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="inv-date" className="text-sm font-medium">Payment Date</label>
                        <Input
                            id="inv-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!amount}>Confirm Payment</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
