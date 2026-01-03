import { Info } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui"

interface InfoIconTooltipProps {
    text: string
}

export function InfoIconTooltip({ text }: InfoIconTooltipProps) {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                    <p className="max-w-[200px] text-sm break-words">{text}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
