import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { CreditCard, Wallet, User, BadgeDollarSign } from "lucide-react"

export function SourceBreakdown({ data }: { data: Record<string, number> }) {
    if (!data) return null

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Accounts & Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {Object.entries(data).map(([source, amount]) => {
                    let Icon = User
                    let label = "Manual"
                    let iconColor = "text-slate-600"
                    let bgClass = "bg-slate-100"

                    if (source === 'XP_CARD') {
                        Icon = CreditCard
                        label = "XP Card"
                        iconColor = "text-rose-600"
                        bgClass = "bg-rose-50"
                    }
                    else if (source === 'XP_ACCOUNT') {
                        Icon = Wallet
                        label = "XP Account"
                        iconColor = "text-emerald-600"
                        bgClass = "bg-emerald-50"
                    }
                    else if (source === 'RECURRING') {
                        Icon = BadgeDollarSign
                        label = "Recurring"
                        iconColor = "text-blue-600"
                        bgClass = "bg-blue-50"
                    }

                    // Sort of hacky translation for others
                    if (source === 'MANUAL') { label = 'Manual Entry' }

                    const displayAmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
                    const amountClass = amount >= 0 ? 'text-emerald-600' : 'text-rose-600'

                    return (
                        <div key={source} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${bgClass} ${iconColor}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-sm">{label}</span>
                            </div>
                            <span className={`font-bold ${amountClass}`}>
                                {displayAmt}
                            </span>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
