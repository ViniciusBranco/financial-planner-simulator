import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { useDashboardBreakdown } from "@/hooks/useTransactions"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Loader2 } from "lucide-react"

export function CategoryBreakdownMonthly({ year }: { year: number }) {
    const [month, setMonth] = useState<number | 'all'>('all')
    const { data: breakdown, isLoading } = useDashboardBreakdown(year, month === 'all' ? undefined : month)

    // Process category data
    const rawData = breakdown?.by_category || []

    // Filter Expenses and normalize
    const expenses = rawData
        .filter(d => d.type === 'EXPENSE')
        .map(d => ({ ...d, value: Math.abs(d.value) }))
        .sort((a, b) => b.value - a.value)

    const chartData = expenses

    const MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    // Distinct Colors for Categories
    const COLORS = [
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
        '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'
    ]

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Spending by Category</CardTitle>
                <select
                    className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none"
                    value={month}
                    onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                >
                    <option value="all">Entire Year</option>
                    {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                    ))}
                </select>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex h-[300px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No expenses
                    </div>
                ) : (
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    payload={
                                        chartData.slice(0, 5).map((entry, index) => ({
                                            value: entry.name,
                                            type: 'square',
                                            id: entry.name,
                                            color: COLORS[index % COLORS.length]
                                        }))
                                    }
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
