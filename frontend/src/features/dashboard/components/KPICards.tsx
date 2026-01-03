import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react"
import { InfoIconTooltip } from "@/components/InfoIconTooltip"

type KPICardsProps = {
    income: number
    expense: number
    balance: number
}

export function KPICards({ income, expense, balance }: KPICardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center space-x-2">
                        <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                        <InfoIconTooltip text="Acumulado do Ano: Receitas - Despesas. Indica se você gastou menos do que ganhou em 2025." />
                    </div>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
                    <p className="text-xs text-muted-foreground">
                        Current Net Position
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                    <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-emerald-500">{formatCurrency(income)}</div>
                    <p className="text-xs text-muted-foreground">
                        Year to Date
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                    <ArrowDownCircle className="h-4 w-4 text-rose-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-rose-500">{formatCurrency(expense)}</div>
                    <p className="text-xs text-muted-foreground">
                        Year to Date
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}
