import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { useFinancialData } from "@/hooks/useFinancialData"
import { Loader2 } from "lucide-react"

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
    }).format(value)
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const income = payload.find((p: any) => p.dataKey === 'income')?.value || 0
        const expense = payload.find((p: any) => p.dataKey === 'expense')?.value || 0
        const balance = income + expense

        return (
            <div className="rounded-lg border bg-background p-3 shadow-lg ring-1 ring-black/5">
                <p className="mb-2 font-medium text-foreground">{label}</p>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-sm text-muted-foreground">Income:</span>
                        <span className="ml-auto font-medium text-emerald-600">
                            {formatCurrency(income)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-rose-500" />
                        <span className="text-sm text-muted-foreground">Expenses:</span>
                        <span className="ml-auto font-medium text-rose-600">
                            {formatCurrency(expense)}
                        </span>
                    </div>
                    <div className="mt-2 border-t pt-1">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <span className="text-sm font-medium text-foreground">Net Balance:</span>
                            <span className={`ml-auto font-bold ${balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                {formatCurrency(balance)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    return null
}

export function FinancialOverview() {
    const { data, isLoading } = useFinancialData(2025)

    if (isLoading) {
        return (
            <Card className="col-span-7">
                <CardHeader>
                    <CardTitle>Financial Overview</CardTitle>
                </CardHeader>
                <CardContent className="flex h-[400px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="col-span-7">
            <CardHeader>
                <CardTitle>Financial Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                            <XAxis
                                dataKey="month"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `R$${value / 1000}k`}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend />

                            <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-income-${index}`}
                                        fill="#10b981"
                                        fillOpacity={entry.isProjected ? 0.4 : 1}
                                        stroke={entry.isProjected ? "#10b981" : "none"}
                                        strokeDasharray={entry.isProjected ? "4 4" : ""}
                                    />
                                ))}
                            </Bar>

                            <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={32}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-expense-${index}`}
                                        fill="#ef4444"
                                        fillOpacity={entry.isProjected ? 0.4 : 1}
                                        stroke={entry.isProjected ? "#ef4444" : "none"}
                                        strokeDasharray={entry.isProjected ? "4 4" : ""}
                                    />
                                ))}
                            </Bar>

                            <Line
                                type="monotone"
                                dataKey="balance"
                                name="Net Balance"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
