import { useDashboardSummary } from "./useTransactions"

export type FinancialDataPoint = {
    month: string
    income: number
    expense: number
    balance: number
    isProjected: boolean
    rawDate: Date
}

export function useFinancialData(year: number = new Date().getFullYear()) {
    const { data: summary, isLoading, error } = useDashboardSummary(year)

    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const chartData: FinancialDataPoint[] = summary?.monthly_data.map(item => {
        const isProjected = year > currentYear || (year === currentYear && item.month > currentMonth)
        return {
            month: new Date(year, item.month - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
            income: item.income,
            expense: item.expense,
            balance: item.income + item.expense,
            isProjected,
            rawDate: new Date(year, item.month - 1)
        }
    }) || []

    return {
        data: chartData,
        isLoading,
        error
    }
}
