import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function AnimatedCheckMark({
  tooltipContent,
}: {
  tooltipContent?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <Check className='!size-3 rounded-full bg-emerald-500 stroke-[6px] p-0.5 text-muted' />
        </motion.div>
      </TooltipTrigger>
      {!!tooltipContent && <TooltipContent>{tooltipContent}</TooltipContent>}
    </Tooltip>
  )
}
