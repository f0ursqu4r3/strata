import {
  Circle,
  CircleDot,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  CirclePause,
} from 'lucide-vue-next'
import type { Component } from 'vue'

const iconMap: Record<string, Component> = {
  'circle': Circle,
  'circle-dot': CircleDot,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheckBig,
  'circle-x': CircleX,
  'circle-pause': CirclePause,
}

export const AVAILABLE_ICONS = Object.keys(iconMap)

export function resolveStatusIcon(key: string): Component {
  return iconMap[key] ?? Circle
}

export const STATUS_COLOR_PALETTE = [
  '#94a3b8', // slate
  '#6b7280', // gray
  '#3b82f6', // blue
  '#2563eb', // blue-600
  '#22c55e', // green
  '#16a34a', // green-600
  '#ef4444', // red
  '#dc2626', // red-600
  '#f59e0b', // amber
  '#ea580c', // orange
  '#8b5cf6', // violet
  '#7c3aed', // violet-600
  '#ec4899', // pink
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#84cc16', // lime
]
