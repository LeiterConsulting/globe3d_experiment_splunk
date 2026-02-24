import type { IngestAdapter, IngestAdapterHealth } from './layerRegistry'

type SimulatedTrajectoryPoint = {
  lat: number
  lon: number
  intensity: number
}

type SimulatedTrajectoryFeed = {
  generatedAt: string
  points: SimulatedTrajectoryPoint[]
}

function jitter(base: number, maxDelta: number): number {
  return base + (Math.random() - 0.5) * maxDelta
}

export function createSimulatedTrajectoryAdapter(): IngestAdapter<SimulatedTrajectoryFeed, SimulatedTrajectoryPoint[]> {
  return {
    id: 'simulated-trajectory-pilot',
    source: 'sim://nasa/trajectory/pilot',
    async connect() {
      return
    },
    async health(): Promise<IngestAdapterHealth> {
      return {
        status: 'healthy',
        detail: 'Simulated adapter online',
        checkedAt: new Date().toISOString(),
      }
    },
    async fetch(): Promise<SimulatedTrajectoryFeed> {
      const points: SimulatedTrajectoryPoint[] = []
      for (let index = 0; index < 36; index += 1) {
        points.push({
          lat: jitter(12 + index * 0.8, 2.2),
          lon: jitter(-110 + index * 1.6, 3.1),
          intensity: Math.max(0.1, Math.min(1, 0.25 + index / 48)),
        })
      }
      return {
        generatedAt: new Date().toISOString(),
        points,
      }
    },
    normalize(input: SimulatedTrajectoryFeed): SimulatedTrajectoryPoint[] {
      return Array.isArray(input.points) ? input.points : []
    },
  }
}
