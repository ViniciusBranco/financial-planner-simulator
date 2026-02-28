import { useFinancialHealth } from "@/hooks/useTransactions"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui"
import { InfoIconTooltip } from "@/components/InfoIconTooltip"
import { cn } from "@/lib/utils"

interface FinancialHealthWidgetProps {
    year: number
}

export function FinancialHealthWidget({ year }: FinancialHealthWidgetProps) {
    const { data: health, isLoading } = useFinancialHealth(year)

    if (isLoading) {
        return (
            <Card className="col-span-2">
                <CardHeader>
                    <CardTitle>Financial Health</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                </CardContent>
            </Card>
        )
    }

    if (!health) {
        return null
    }

    const { liquidity, liability, ratio, status } = health
    const absLiability = Math.abs(liability)
    const isComfort = status === 'COMFORT'

    // Calculate percentage for progress bar (capped at 100)
    // If liability is 0, we can assume 100% covered if liquidity > 0, else 0.
    const percentage = absLiability === 0
        ? (liquidity > 0 ? 100 : 0)
        : Math.min((liquidity / absLiability) * 100, 100)

    // Determine bar colors and message
    const barColor = isComfort ? "bg-green-500" : "bg-orange-500"
    const message = isComfort
        ? `Fully Covered (+ R$ ${(liquidity - absLiability).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
        : `Covering ${ratio.toFixed(1)}% of Invoice`

    return (
        <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center space-x-2">
                    <CardTitle className="text-sm font-medium">Financial Health</CardTitle>
                    <InfoIconTooltip text="Estratégia de Caixa: Compara quanto você tem na conta hoje vs. o valor total acumulado na fatura do cartão." />
                </div>
                <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded-full",
                    isComfort ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                )}>
                    {status}
                </span>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Bars Comparison */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <span className="text-muted-foreground">Liquidez (Current Cash)</span>
                            <div className="text-2xl font-bold text-green-600">
                                {liquidity.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        </div>
                        <div className="space-y-1 text-right">
                            <span className="text-muted-foreground">Liability (All Card Debt)</span>
                            <div className="text-2xl font-bold text-red-600">
                                {liability.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        </div>
                    </div>

                    {/* Coverage Gauge / Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Coverage</span>
                            <span>{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                                className={cn("h-full transition-all duration-500", barColor)}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <p className={cn("text-xs font-medium text-center pt-1", isComfort ? "text-green-600" : "text-orange-600")}>
                            {message}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
