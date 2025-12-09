import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Select, Button } from "@/components/ui"
import { useTransactions, useUpdateTransaction } from "@/hooks/useTransactions"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function TransactionList() {
    const [page, setPage] = useState(1)
    const { data, isLoading } = useTransactions(page)
    const updateMutation = useUpdateTransaction()

    if (isLoading) return <div>Loading transactions...</div>

    const handleCategoryChange = (id: string, newCategory: string) => {
        updateMutation.mutate({ id, category: newCategory })
    }

    const categories = [
        "Geral", "Alimentação", "Transporte", "Lazer/Assinaturas", "Saúde",
        "Moradia", "Educação", "Investimentos", "Outros"
    ]

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Recent Transactions</h2>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {page}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={!data?.items || data.items.length < 50}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data?.items.map((tx: any) => (
                            <TableRow key={tx.id}>
                                <TableCell>{new Date(tx.date).toLocaleDateString('pt-BR')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell>
                                    <Select
                                        value={tx.category}
                                        onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                                        className="h-8 w-[180px]"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </Select>
                                </TableCell>
                                <TableCell className={cn("text-right font-medium", tx.type === 'INCOME' ? "text-emerald-500" : "text-rose-500")}>
                                    {tx.type === 'EXPENSE' ? '-' : '+'}
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

import { cn } from "@/lib/utils"
