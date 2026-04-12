'use client'

import * as React from 'react'

type ToastVariant = 'default' | 'destructive'

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  action?: React.ReactNode
}

interface ToastState {
  toasts: Toast[]
}

const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(toast: Toast) {
  memoryState = { toasts: [...memoryState.toasts, toast] }
  listeners.forEach(l => l(memoryState))
  setTimeout(() => {
    memoryState = { toasts: memoryState.toasts.filter(t => t.id !== toast.id) }
    listeners.forEach(l => l(memoryState))
  }, 4000)
}

export function toast(props: Omit<Toast, 'id'>) {
  dispatch({ id: Math.random().toString(36).slice(2), ...props })
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return { toasts: state.toasts, toast }
}
