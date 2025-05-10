import { Button } from '@/components/ui/button'
import { cn } from '@/utils'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Send } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

const BUTTONS = {
  send: {
    icon: Send,
    iconProps: { className: 'size-7! fill-foreground' },
    text: 'Send',
    path: '/send',
    className:
      'hover:bg-teal-500 hover:shadow-teal-600/40 dark:hover:bg-teal-700',
    firstIconVariants: {
      hovered: { scale: 0, y: -40, x: 40 },
      default: { scale: 1, y: 0, x: 0 },
    },
    secondIconVariants: {
      default: { scale: 0, y: 40, x: -40 },
      hovered: { scale: 1, y: 0, x: 0 },
    },
  },
  receive: {
    icon: Download,
    iconProps: { className: 'size-7! stroke-[3px]' },
    text: 'Receive',
    path: '/receive',
    className:
      'hover:bg-emerald-500 hover:shadow-emerald-600/40 dark:hover:bg-emerald-700',
    firstIconVariants: {
      hovered: { scale: 0, y: 30, x: 0 },
      default: { scale: 1, y: 0, x: 0 },
    },
    secondIconVariants: {
      default: { scale: 0, y: -30, x: 0 },
      hovered: { scale: 1, y: 0, x: 0 },
    },
  },
}

export const Route = createFileRoute('/_pages/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className='flex flex-col justify-center gap-4 py-4'>
      <AnimatedButton type='send' />
      <AnimatedButton type='receive' />
    </div>
  )
}

function AnimatedButton({ type }: { type: keyof typeof BUTTONS }) {
  const [hovered, setHovered] = useState(false)
  const navigate = Route.useNavigate()

  const config = BUTTONS[type]
  const Icon = config.icon

  return (
    <Button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate({ to: config.path })}
      className={cn(
        'h-fit flex-col gap-6 py-6 text-xl font-bold hover:shadow-lg',
        config.className,
      )}
    >
      <div className='relative'>
        <motion.div
          transition={{ delay: hovered ? 0 : 0.2 }}
          className='absolute'
          animate={hovered ? 'hovered' : 'default'}
          variants={config.firstIconVariants}
        >
          <Icon {...config.iconProps} />
        </motion.div>
        <motion.div
          transition={{ delay: hovered ? 0.2 : 0 }}
          animate={hovered ? 'hovered' : 'default'}
          variants={config.secondIconVariants}
        >
          <Icon {...config.iconProps} />
        </motion.div>
      </div>
      {config.text}
    </Button>
  )
}
