import { useState } from "react"
import { DashboardLayout } from "@/components/DashboardLayout"
import { KPICards } from "./components/KPICards"
import { FinancialOverview } from "./components/FinancialOverview"
import { CategoryBreakdownMonthly } from "./components/SourceBreakdown"
import { CategoryBreakdown } from "./components/CategoryBreakdown"
import { useDashboardSummary, useDashboardBreakdown } from "@/hooks/useTransactions"

export function DashboardPage() {
    const currentYear = new Date().getFullYear()
    // Default to 2025 during dev if preferred, otherwise currentYear
    const [year, setYear] = useState(currentYear)
    const { data: summary, isLoading: isLoadingSummary } = useDashboardSummary(year)
    const { data: breakdown, isLoading: isLoadingBreakdown } = useDashboardBreakdown(year)

    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

    if (isLoadingSummary || isLoadingBreakdown) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[50vh]">
                    <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col space-y-8">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {summary && (
                    <KPICards
                        income={summary.total_income}
                        expense={summary.total_expense}
                        balance={summary.balance}
                    />
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <FinancialOverview year={year} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <CategoryBreakdownMonthly year={year} />
                    <CategoryBreakdown data={breakdown?.by_category || []} />
                </div>
            </div>
        </DashboardLayout>
    )
}
