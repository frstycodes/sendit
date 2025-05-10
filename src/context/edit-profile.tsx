import { avatars } from '@/assets/avatars'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { api, getRandomElFromArray } from '@/lib/tauri'
import { User } from '@/lib/tauri/api'
import { AppState } from '@/state/appstate'
import { ReactNode } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { motion } from 'motion/react'
import * as React from 'react'

export const RAND_PREFIX_LIST = [
  'Cool',
  'Awesome',
  'Great',
  'Fantastic',
  'Super',
  'Epic',
  'Legendary',
  'Mighty',
  'Brave',
  'Fearless',
  'Bold',
  'Daring',
  'Courageous',
  'Valiant',
  'Gallant',
]
export const RAND_SUFFIX_LIST = [
  'Warrior',
  'Knight',
  'Mage',
  'Rogue',
  'Paladin',
  'Hunter',
  'Bard',
  'Druid',
  'Sorcerer',
  'Assassin',
  'Guardian',
  'Champion',
  'Defender',
  'Avenger',
  'Savior',
]

function getRandomName() {
  const prefix = getRandomElFromArray(RAND_PREFIX_LIST)
  const suffix = getRandomElFromArray(RAND_SUFFIX_LIST)
  return `${prefix} ${suffix}`
}

const defaultUser = {
  name: getRandomName(),
  avatar: Math.floor(Math.random() * avatars.length),
}

export function EditProfile({
  buttonLabel,
  user: prefillUser,
}: {
  buttonLabel?: ReactNode
  user?: User
}) {
  const [user, setUser] = React.useState(prefillUser || defaultUser)
  const [saveSuccess, setSaveSuccess] = React.useState(false)

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setUser((prev) => ({ ...prev, name: value }))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const res = await api.updateUser(user)
    if (res.isOk()) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
      AppState.set({ user })
    }
  }

  return (
    <div className='flex size-full flex-col items-center gap-4 p-6'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <img
            src={avatars[user.avatar]}
            className='h-24 w-24 cursor-pointer rounded-full'
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent className='grid grid-cols-3 grid-rows-4 gap-2'>
          {avatars.map((avatar, index) => (
            <DropdownMenuItem
              className='cursor-pointer rounded-full'
              key={index}
              onClick={() => setUser((prev) => ({ ...prev, avatar: index }))}
            >
              <img src={avatar} className='h-16 w-16 rounded-full' />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <form className='contents' onSubmit={onSubmit}>
        <Input value={user.name} onChange={handleNameChange} />
        <div className='flex w-full justify-center'>
          <motion.div layout>
            <Button className='rounded-sm'>
              {saveSuccess && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  className='flex items-center'
                >
                  <Check className='size-4 text-emerald-500' />
                </motion.span>
              )}
              <motion.span layout='position'>
                {buttonLabel ?? (
                  <>
                    Get Started <ArrowRight className='ml-1' />
                  </>
                )}
              </motion.span>
            </Button>
          </motion.div>
        </div>
      </form>
    </div>
  )
}
