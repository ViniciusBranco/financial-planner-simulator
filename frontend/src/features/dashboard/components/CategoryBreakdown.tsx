import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

export function CategoryBreakdown({ data }: { data: { name: string, value: number, type: string }[] }) {
    if (!data) return null

    // Filter only EXPENSES and take top 5 + Others
    // Value comes as negative for expenses usually? No, DB aggregation sum returns raw sum.
    // Expenses are stored as negative. So sum is negative.
    // We need absolute value for Pie Chart.

    const expenses = data
        .filter(d => d.type === 'EXPENSE')
        .map(d => ({ ...d, value: Math.abs(d.value) }))

    // Sort desc
    expenses.sort((a, b) => b.value - a.value)

    const topItems = expenses.slice(0, 5)
    // Optional: Add Others
    const otherSum = expenses.slice(5).reduce((acc, curr) => acc + curr.value, 0)
    if (otherSum > 0) {
        topItems.push({ name: 'Others', value: otherSum, type: 'EXPENSE' })
    }

    const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899']

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Top Expenses</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
                {topItems.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">No expenses this month</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={topItems}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {topItems.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}
