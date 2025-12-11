import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Input, Button } from '@/components/ui'
import { ChevronDown } from 'lucide-react'

export const CATEGORY_OPTIONS = [
    "Moradia",
    "Dogs",
    "Mercado",
    "Restaurante",
    "Delivery",
    "Transporte",
    "Saúde",
    "Lazer",
    "Streaming",
    "Assinaturas",
    "Compras",
    "Educação",
    "Serviços Financeiros",
    "Serviços Diversos",
    "Investimentos",
    "Salário",
    "Receita",
    "Alimentação",
    "Não Categorizado"
]

interface CategoryInputProps {
    value: string
    onChange: (val: string) => void
}

export function CategoryInput({ value, onChange }: CategoryInputProps) {
    const [open, setOpen] = useState(false)
    const [showAll, setShowAll] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filteredOptions = useMemo(() => {
        if (showAll) return CATEGORY_OPTIONS
        const lower = value.toLowerCase()
        return CATEGORY_OPTIONS.filter(cat => cat.toLowerCase().includes(lower))
    }, [value, showAll])

    const handleSelect = (cat: string) => {
        onChange(cat)
        setOpen(false)
    }

    return (
        <div className="relative" ref={ref}>
            <div className="relative">
                <Input
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value)
                        setOpen(true)
                        setShowAll(false)
                    }}
                    placeholder="Select or type category..."
                    className="pr-10"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                        setOpen(!open)
                        if (!open) setShowAll(true)
                    }}
                >
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </div>
            {open && filteredOptions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-[200px] overflow-auto py-1">
                    {filteredOptions.map((cat) => (
                        <div
                            key={cat}
                            className="px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onClick={() => handleSelect(cat)}
                        >
                            {cat}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
