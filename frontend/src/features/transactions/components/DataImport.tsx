import React, { useState, useRef, ChangeEvent, DragEvent } from 'react'
import { UploadCloud, FileSpreadsheet, X, CheckCircle, AlertCircle, Download } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Checkbox } from '@/components/ui'
import { useUploadTransactions, useBulkDeleteTransactions, Transaction } from '@/hooks/useTransactions'
import { cn } from '@/lib/utils'
import { ReconciliationModal } from './ReconciliationModal'

const MONTHS = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
]

export const DataImport: React.FC = () => {
    const [dragActive, setDragActive] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState<string>('')

    // Default to current month/year
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1))
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()))
    const [useAutoDate, setUseAutoDate] = useState(false)

    // Reconciliation State
    const [reconciliationCandidates, setReconciliationCandidates] = useState<Transaction[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const { mutate: bulkDelete, isPending: isDeleting } = useBulkDeleteTransactions()

    const inputRef = useRef<HTMLInputElement>(null)
    const { mutate: upload, isPending } = useUploadTransactions()

    // Generate years (Current - 1 to Current + 2)
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 4 }, (_, i) => String(currentYear - 1 + i))

    const handleDrag = (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files))
        }
    }

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files))
        }
    }

    const handleFiles = (files: File[]) => {
        const validFiles = files.filter(file => file.type === 'text/csv' || file.name.endsWith('.csv'))

        if (validFiles.length === 0) {
            setUploadStatus('error')
            setMessage('Invalid file format. Please upload CSV files.')
            return
        }

        if (validFiles.length < files.length) {
            setMessage(`Note: Only ${validFiles.length} valid CSV files were selected.`)
        } else {
            setMessage('')
            setUploadStatus('idle')
        }

        setSelectedFiles(validFiles)
    }

    const onUploadClick = () => {
        if (selectedFiles.length === 0) return

        setUploadStatus('uploading')
        // Construct Date string YYYY-MM-DD
        const manualDate = useAutoDate ? undefined : `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`

        upload(
            {
                files: selectedFiles,
                manual_reference_date: manualDate
            },
            {
                onSuccess: (data) => {
                    setUploadStatus('success')
                    setMessage(`Success! Imported ${data.total_imported} transactions from ${selectedFiles.length} files.`)
                    setSelectedFiles([])
                    if (inputRef.current) inputRef.current.value = ''

                    if (data.reconciliation_candidates && data.reconciliation_candidates.length > 0) {
                        setReconciliationCandidates(data.reconciliation_candidates)
                        setIsModalOpen(true)
                    }
                },
                onError: (error: any) => {
                    setUploadStatus('error')
                    setMessage(error.message || 'Failed to upload files.')
                    setReconciliationCandidates([])
                    setIsModalOpen(false)
                }
            }
        )
    }

    const handleReconciliationConfirm = (ids: string[]) => {
        bulkDelete(ids, {
            onSuccess: () => {
                setIsModalOpen(false)
                setReconciliationCandidates([])
                setMessage((prev) => `${prev} Additionally, reconciled ${ids.length} manual transactions.`)
            },
            onError: () => {
                alert("Failed to reconcile transactions.")
            }
        })
    }

    const removeFiles = () => {
        setSelectedFiles([])
        setUploadStatus('idle')
        setMessage('')
        if (inputRef.current) inputRef.current.value = ''
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    Import Transactions
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Reference Period Selector */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">
                            Reference Period (Competência)
                        </label>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="auto-date"
                                checked={useAutoDate}
                                onChange={(e) => setUseAutoDate(e.target.checked)}
                            />
                            <label htmlFor="auto-date" className="text-xs text-muted-foreground cursor-pointer select-none">
                                Auto (Use File Date)
                            </label>
                        </div>
                    </div>
                    <div className={cn("flex gap-2 transition-opacity", useAutoDate && "opacity-50 pointer-events-none")}>
                        <Select
                            value={selectedMonth}
                            disabled={useAutoDate}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="flex-1"
                        >
                            {MONTHS.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </Select>
                        <Select
                            value={selectedYear}
                            disabled={useAutoDate}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-24"
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </Select>
                    </div>
                </div>

                {/* Drag & Drop Zone */}
                <div
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full min-h-[160px] border-2 border-dashed rounded-lg transition-colors cursor-pointer",
                        dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                        uploadStatus === 'error' && "border-destructive/50 bg-destructive/5"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        accept=".csv"
                        multiple
                        onChange={handleChange}
                    />

                    {selectedFiles.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 text-center p-4">
                            <UploadCloud className={cn("h-10 w-10 text-muted-foreground transition-colors", dragActive && "text-primary")} />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">
                                    Click or drag files to this area to upload
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Support for multiple CSV files
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 p-4 w-full max-h-[200px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                            {selectedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-2 rounded-md bg-background/50 border">
                                    <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {(file.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions & Status */}
                <div className="flex flex-col gap-3">
                    {selectedFiles.length > 0 && (
                        <div className="flex gap-2">
                            <Button
                                onClick={onUploadClick}
                                disabled={isPending || uploadStatus === 'success'}
                                className="flex-1"
                            >
                                {isPending ? "Uploading & Categorizing with AI... (May take seconds)" : `Upload ${selectedFiles.length} Files`}
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={removeFiles}
                                disabled={isPending}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Feedback Messages */}
                    {uploadStatus === 'success' && (
                        <div className="flex items-center gap-2 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                            <CheckCircle className="h-4 w-4" />
                            <span>{message}</span>
                        </div>
                    )}

                    {uploadStatus === 'error' && (
                        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            <AlertCircle className="h-4 w-4" />
                            <span>{message}</span>
                        </div>
                    )}

                    {/* Template Download (Mock) */}
                    <div className="flex justify-between items-center pt-2 border-t mt-2">
                        <span className="text-xs text-muted-foreground">Need help formatting?</span>
                        <Button variant="link" size="sm" className="h-auto p-0 gap-1 text-xs">
                            <Download className="h-3 w-3" />
                            Download Template
                        </Button>
                    </div>
                </div>
            </CardContent>

            <ReconciliationModal
                candidates={reconciliationCandidates}
                isOpen={isModalOpen}
                onConfirm={handleReconciliationConfirm}
                onCancel={() => setIsModalOpen(false)}
                isPending={isDeleting}
            />
        </Card>
    )
}
