import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export type Transaction = {
    id: string
    date: string
    description: string
    amount: number
    category_legacy?: string
    category_id?: string
    category_name?: string
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
    payment_method?: string
    manual_tag?: string
    is_recurring: boolean
    metadata?: any
    raw_data?: any
    cardholder?: string
    installment_n?: number
    installment_total?: number
    source_type?: string
    is_verified?: boolean
}

export interface TransactionFilters {
    skip?: number;
    limit?: number;
    month?: number;
    year?: number;
    search?: string;
    category?: string;
    is_recurring?: boolean;
    source_type?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    unverified_only?: boolean;
}

export type TransactionResponse = {
    items: Transaction[]
    total: number
    page: number
    size: number
}

async function fetchTransactions(filters: TransactionFilters): Promise<TransactionResponse> {
    const params = new URLSearchParams()
    if (filters.skip !== undefined) params.append('skip', filters.skip.toString())
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString())
    if (filters.month) params.append('month', filters.month.toString())
    if (filters.year) params.append('year', filters.year.toString())
    if (filters.search) params.append('search', filters.search)
    if (filters.category) params.append('category', filters.category)
    if (filters.is_recurring !== undefined) params.append('is_recurring', filters.is_recurring.toString())
    if (filters.source_type) params.append('source_type', filters.source_type)
    if (filters.sort_by) params.append('sort_by', filters.sort_by)
    if (filters.sort_order) params.append('sort_order', filters.sort_order)
    if (filters.unverified_only) params.append('unverified_only', 'true')

    console.log("Fetching transactions with params:", params.toString())

    const res = await fetch(`${API_URL}/transactions/?${params}`)
    if (!res.ok) throw new Error('Failed to fetch transactions')
    return res.json()
}

export function useTransactions(filters: TransactionFilters) {
    return useQuery({
        queryKey: ['transactions', filters],
        queryFn: () => fetchTransactions(filters),
        placeholderData: (previousData) => previousData,
    })
}

export type DashboardSummary = {
    year: number
    total_income: number
    total_expense: number
    balance: number
    monthly_data: {
        month: number
        income: number
        expense: number
    }[]
}

type TransactionUpdateInput = {
    id: string
    description?: string
    amount?: number
    date?: string
    category?: string
    category_legacy?: string
    category_id?: string
    manual_tag?: string
    type?: 'INCOME' | 'EXPENSE' | 'TRANSFER'
    is_verified?: boolean
}

async function updateTransaction(data: TransactionUpdateInput) {
    const { id, ...body } = data
    const res = await fetch(`${API_URL}/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Failed to update transaction: ${errorText}`)
    }
    return res.json()
}

async function deleteTransaction(id: string) {
    const res = await fetch(`${API_URL}/transactions/${id}`, {
        method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete transaction')
    return
}

async function fetchDashboardSummary(year = 2025) {
    const res = await fetch(`${API_URL}/dashboard/summary?year=${year}`)
    if (!res.ok) throw new Error('Failed to fetch dashboard summary')
    return res.json()
}

export function useUpdateTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: updateTransaction,
        onMutate: async (newData) => {
            await queryClient.cancelQueries({ queryKey: ['transactions'] })
            const previousTransactions = queryClient.getQueryData(['transactions'])

            queryClient.setQueriesData({ queryKey: ['transactions'] }, (old: any) => {
                if (!old || !old.items) return old
                return {
                    ...old,
                    items: old.items.map((tx: Transaction) =>
                        tx.id === newData.id ? { ...tx, ...newData, is_verified: true } : tx
                    )
                }
            })

            return { previousTransactions }
        },
        onError: (_err, _newData, context) => {
            if (context?.previousTransactions) {
                queryClient.setQueryData(['transactions'], context.previousTransactions)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
    })
}

export function useDeleteTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: deleteTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
    })
}

async function bulkDeleteTransactions(ids: string[]) {
    const res = await fetch(`${API_URL}/transactions/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    })
    if (!res.ok) throw new Error('Failed to bulk delete transactions')
    return
}

export function useBulkDeleteTransactions() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: bulkDeleteTransactions,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
    })
}

type TransactionCreateInput = {
    date: string
    description: string
    amount: number
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
    category_legacy?: string
    source_type?: string
}

async function createTransaction(data: TransactionCreateInput) {
    const res = await fetch(`${API_URL}/transactions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create transaction')
    return res.json()
}

export function useCreateTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
    })
}

async function uploadTransactions({ files, manual_reference_date }: { files: File[], manual_reference_date?: string }): Promise<any> {
    const formData = new FormData()
    files.forEach((file) => {
        formData.append('file', file)
    })
    if (manual_reference_date) formData.append('manual_reference_date', manual_reference_date)

    const res = await fetch(`${API_URL}/transactions/upload`, {
        method: 'POST',
        body: formData,
    })

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Failed to upload transactions: ${errorText}`)
    }
    return res.json()
}

export function useUploadTransactions() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: uploadTransactions,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
    })
}

export function useDashboardSummary(year: number) {
    return useQuery<DashboardSummary>({
        queryKey: ['dashboard', year],
        queryFn: () => fetchDashboardSummary(year),
    })
}

// Recurring Types
export type RecurringTransaction = {
    id: string
    description: string
    amount: number
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
    category_legacy?: string
    is_active: boolean
    day_of_month: number
    category_id?: string
    start_date: string
    end_date?: string | null
}

export type RecurringTransactionCreate = Omit<RecurringTransaction, 'id'>
export type RecurringTransactionUpdate = Partial<RecurringTransactionCreate>

// Recurring API Functions
async function fetchRecurringTransactions() {
    const res = await fetch(`${API_URL}/recurring/`)
    if (!res.ok) throw new Error('Failed to fetch recurring transactions')
    return res.json() as Promise<RecurringTransaction[]>
}

async function createRecurringTransaction(data: RecurringTransactionCreate) {
    const res = await fetch(`${API_URL}/recurring/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create recurring transaction')
    return res.json()
}

async function updateRecurringTransaction({ id, ...data }: RecurringTransactionUpdate & { id: string }) {
    const res = await fetch(`${API_URL}/recurring/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update recurring transaction')
    return res.json()
}

async function deleteRecurringTransaction(id: string) {
    const res = await fetch(`${API_URL}/recurring/${id}`, {
        method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete recurring transaction')
    return
}

async function projectTransactions(data: { month: number, year: number }) {
    const res = await fetch(`${API_URL}/transactions/project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to project transactions')
    return res.json()
}

// Recurring Hooks
export function useRecurringTransactions() {
    return useQuery({
        queryKey: ['recurring'],
        queryFn: fetchRecurringTransactions,
    })
}

export function useCreateRecurringTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createRecurringTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring'] })
        },
    })
}

export function useUpdateRecurringTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: updateRecurringTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring'] })
        },
    })
}

export function useDeleteRecurringTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: deleteRecurringTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring'] })
        },
    })
}

export function useProjectTransactions() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: projectTransactions,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
    })
}

export type DashboardBreakdown = {
    by_source: Record<string, number>
    by_category: { name: string, value: number, type: 'INCOME' | 'EXPENSE' | 'TRANSFER' }[]
}

async function fetchDashboardBreakdown(year: number, month?: number) {
    const params = new URLSearchParams()
    params.append('year', year.toString())
    if (month) params.append('month', month.toString())
    const res = await fetch(`${API_URL}/dashboard/breakdown?${params}`)
    if (!res.ok) throw new Error('Failed to fetch dashboard breakdown')
    return res.json()
}

export function useDashboardBreakdown(year: number, month?: number) {
    return useQuery<DashboardBreakdown>({
        queryKey: ['dashboard_breakdown', year, month],
        queryFn: () => fetchDashboardBreakdown(year, month),
    })
}

export type SimulationItem = {
    name: string
    type: 'INCOME' | 'EXPENSE'
    values: number[]
    source: string
}

export type SimulationResponse = {
    month_headers: string[]
    items: SimulationItem[]
}

export type Scenario = {
    id: number
    name: string
    description?: string
    items: any[]
}

async function fetchScenarios() {
    const res = await fetch(`${API_URL}/scenarios/`)
    if (!res.ok) throw new Error('Failed to fetch scenarios')
    return res.json()
}

export function useScenarios() {
    return useQuery<Scenario[]>({
        queryKey: ['scenarios'],
        queryFn: fetchScenarios
    })
}

async function createScenario(data: { name: string, description?: string }) {
    const res = await fetch(`${API_URL}/scenarios/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to create scenario')
    return res.json()
}

export function useCreateScenario() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createScenario,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scenarios'] })
        }
    })
}

async function addScenarioItem(data: { scenarioId: number, item: any }) {
    const res = await fetch(`${API_URL}/scenarios/${data.scenarioId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.item)
    })
    if (!res.ok) throw new Error('Failed to add scenario item')
    return res.json()
}

export function useAddScenarioItem() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: addScenarioItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['simulation'] })
        }
    })
}

async function fetchSimulationProjection(months = 12, scenarioId?: number | null) {
    let url = `${API_URL}/simulation/projection?months=${months}`
    if (scenarioId) url += `&scenario_id=${scenarioId}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch simulation')
    return res.json()
}

export function useSimulationProjection(scenarioId?: number | null) {
    return useQuery<SimulationResponse>({
        queryKey: ['simulation', scenarioId],
        queryFn: () => fetchSimulationProjection(12, scenarioId),
    })
}

async function autoCategorizeTransactions(params: { limit?: number, month?: number, year?: number, force?: boolean } = {}) {
    const queryParams = new URLSearchParams()
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.month) queryParams.append('month', params.month.toString())
    if (params.year) queryParams.append('year', params.year.toString())
    if (params.force) queryParams.append('force', 'true')

    const res = await fetch(`${API_URL}/transactions/auto-categorize?${queryParams}`, {
        method: 'POST',
    })
    if (!res.ok) throw new Error('Failed to auto-categorize transactions')
    return res.json()
}

export function useAutoCategorize() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: autoCategorizeTransactions,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard_breakdown'] })
        },
    })
}

async function batchDeleteTransactions(params: { month: number, year: number, source_type?: string, category_id?: string }) {
    const queryParams = new URLSearchParams()
    queryParams.append('month', params.month.toString())
    queryParams.append('year', params.year.toString())
    if (params.source_type) queryParams.append('source_type', params.source_type)
    if (params.category_id) queryParams.append('category_id', params.category_id)

    const res = await fetch(`${API_URL}/transactions/batch-delete?${queryParams}`, {
        method: 'DELETE',
    })
    if (!res.ok) {
        let errorMessage = 'Failed to batch delete transactions'
        try {
            const errorBody = await res.json()
            if (errorBody.detail) {
                errorMessage += ` ${JSON.stringify(errorBody.detail)}`
            }
        } catch (e) {
            const text = await res.text()
            if (text) errorMessage += `: ${text}`
        }
        throw new Error(errorMessage)
    }
    return res.json()
}

export function useBatchDeleteTransactions() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: batchDeleteTransactions,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard_breakdown'] })
        },
    })
}

export type FinancialHealth = {
    liquidity: number
    liability: number
    ratio: number
    status: 'COMFORT' | 'SURVIVAL'
}

async function fetchFinancialHealth(year?: number) {
    let url = `${API_URL}/dashboard/health-ratio`
    if (year) url += `?year=${year}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch financial health')
    return res.json()
}

export function useFinancialHealth(year?: number) {
    return useQuery<FinancialHealth>({
        queryKey: ['financial_health', year],
        queryFn: () => fetchFinancialHealth(year),
    })
}

type PayInvoiceInput = {
    amount: number
    date: string
    account_source_id?: string
    card_source_id?: string
}

async function payInvoice(data: PayInvoiceInput) {
    const res = await fetch(`${API_URL}/transactions/pay-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to pay invoice')
    return res.json()
}

export function usePayInvoice() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: payInvoice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['financial_health'] })
        },
    })
}

export async function fetchAverageSpending() {
    // Attempt to fetch 3-month average for XP Card as a baseline
    // The endpoint might accept params, but for now we call it directly
    const res = await fetch(`${API_URL}/analytics/average-spending`)
    if (!res.ok) throw new Error('Failed to fetch average spending')
    return res.json() as Promise<{ average: number }>
}

export function useAverageSpending() {
    return useQuery({
        queryKey: ['average_spending'],
        queryFn: fetchAverageSpending,
        enabled: false, // Only fetch on demand
    })
}

async function deleteScenario(id: number) {
    const res = await fetch(`${API_URL}/scenarios/${id}`, {
        method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete scenario')
    return
}

export function useDeleteScenario() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: deleteScenario,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scenarios'] })
        },
    })
}
