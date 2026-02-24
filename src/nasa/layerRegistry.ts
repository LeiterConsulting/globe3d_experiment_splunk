export type LayerHealth = 'healthy' | 'warning' | 'critical'

export type LayerRegistryEntry = {
  id: string
  label: string
  source: string
  enabled: boolean
  confidence: number
  entityCount: number
  updatedAt: string
  health: LayerHealth
  tags?: string[]
}

export type IngestAdapterHealth = {
  status: LayerHealth
  detail: string
  checkedAt: string
}

export type IngestAdapter<TInput = unknown, TOutput = unknown> = {
  id: string
  source: string
  connect: () => Promise<void>
  health: () => Promise<IngestAdapterHealth>
  fetch: () => Promise<TInput>
  normalize: (input: TInput) => TOutput
}

export type LayerRegistrySummary = {
  total: number
  enabled: number
  healthy: number
  warning: number
  critical: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function scoreToHealth(confidence: number): LayerHealth {
  const score = clamp(Number(confidence) || 0, 0, 1)
  if (score < 0.55) return 'critical'
  if (score < 0.75) return 'warning'
  return 'healthy'
}

export function summarizeLayerRegistry(entries: LayerRegistryEntry[]): LayerRegistrySummary {
  return entries.reduce<LayerRegistrySummary>(
    (acc, entry) => {
      acc.total += 1
      if (entry.enabled) acc.enabled += 1
      if (entry.health === 'healthy') acc.healthy += 1
      else if (entry.health === 'warning') acc.warning += 1
      else acc.critical += 1
      return acc
    },
    { total: 0, enabled: 0, healthy: 0, warning: 0, critical: 0 },
  )
}
