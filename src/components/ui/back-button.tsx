import { useRouter } from '@tanstack/react-router'
import { Button } from './button'
import { ChevronLeft } from 'lucide-react'
export function BackButton() {
  const router = useRouter()
  return (
    <Button
      variant='ghost'
      color='primary'
      className='w-fit px-0 -ml-1 gap-0.5 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground'
      onClick={() => router.history.back()}
    >
      <ChevronLeft /> Back
    </Button>
  )
}
