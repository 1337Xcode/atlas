import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// fn: resolve utility conflicts when shared components receive local styles
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
