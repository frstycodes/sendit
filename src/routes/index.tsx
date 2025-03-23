import { Button } from '@/components/ui/button'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Send } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <h1 className='text-3xl font-bold'>SendIt</h1>
      <div className='flex flex-col justify-center gap-4 py-4'>
        <SendButton />
        <ReceiveButton />
      </div>
    </div>
  )
}

function SendButton() {
  const [hovered, setHovered] = useState(false)
  const navigate = Route.useNavigate()

  const firstIconVariants = {
    hovered: {
      scale: 0,
      y: -40,
      x: 40,
    },
    default: {
      scale: 1,
      y: 0,
      x: 0,
    },
  }

  const secondIconVariants = {
    default: {
      scale: 0,
      y: 40,
      x: -40,
    },
    hovered: {
      scale: 1,
      y: 0,
      x: 0,
    },
  }
  return (
    <Button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate({ to: '/send' })}
      className='h-fit flex-col gap-6 py-6 text-xl font-bold hover:border-transparent hover:bg-teal-500 hover:shadow-xl hover:shadow-teal-600 dark:hover:bg-teal-700'
    >
      <div className='relative'>
        <motion.div
          transition={{ delay: hovered ? 0 : 0.2 }}
          className='absolute'
          animate={hovered ? 'hovered' : 'default'}
          variants={firstIconVariants}
        >
          <Send className='!size-7 fill-foreground' />
        </motion.div>
        <motion.div
          transition={{ delay: hovered ? 0.2 : 0 }}
          animate={hovered ? 'hovered' : 'default'}
          variants={secondIconVariants}
        >
          <Send className='!size-7 fill-foreground' />
        </motion.div>
      </div>
      Send
    </Button>
  )
}

function ReceiveButton() {
  const [hovered, setHovered] = useState(false)
  const navigate = Route.useNavigate()

  const firstIconVariants = {
    hovered: {
      scale: 0,
      y: 30,
      x: 0,
    },
    default: {
      scale: 1,
      y: 0,
      x: 0,
    },
  }

  const secondIconVariants = {
    default: {
      scale: 0,
      y: -30,
      x: 0,
    },
    hovered: {
      scale: 1,
      y: 0,
      x: 0,
    },
  }
  return (
    <Button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate({ to: '/receive' })}
      className='h-fit flex-col gap-6 py-6 text-xl font-bold transition-all hover:border-transparent hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-600 dark:hover:bg-emerald-700'
    >
      <div className='relative'>
        <motion.div
          transition={{ delay: hovered ? 0 : 0.2 }}
          className='absolute'
          animate={hovered ? 'hovered' : 'default'}
          variants={firstIconVariants}
        >
          <Download className='!size-7 stroke-[3px]' />
        </motion.div>
        <motion.div
          transition={{ delay: hovered ? 0.2 : 0 }}
          animate={hovered ? 'hovered' : 'default'}
          variants={secondIconVariants}
        >
          <Download className='!size-7 stroke-[3px]' />
        </motion.div>
      </div>
      Receive
    </Button>
  )
}
