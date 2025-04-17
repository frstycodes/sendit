import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Check } from 'lucide-react'

export function AnimatedCheckMark({
  tooltipContent,
}: {
  tooltipContent?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className='duration-100 animate-in zoom-in-0'
          style={{ willChange: 'transform' }} // Optimize browser rendering
        >
          <Check className='size-3! rounded-full bg-emerald-500 stroke-[6px] p-0.5 text-muted' />
        </div>
      </TooltipTrigger>
      {!!tooltipContent && <TooltipContent>{tooltipContent}</TooltipContent>}
    </Tooltip>
  )
}
