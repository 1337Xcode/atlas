import type { WorldModelDescriptor } from '../wire.ts'

// docs: https://docs.reactor.inc/model-api-reference/lingbot/schema
// note: the previous generation — one movement axis, discrete look axes, 1000 char prompt cap
export const LINGBOT: WorldModelDescriptor = {
  id: 'lingbot',
  slug: 'reactor/lingbot',
  capabilities: {
    promptCharBudget: 1000,
    hotSwapPrompt: true,
    move: { lateral: false },
    look: { mode: 'axes' },
    vertical: false,
    rotationSpeed: { min: 0, max: 30, default: 5 },
    video: { width: 1664, height: 960, fps: 48 },
    chunkMs: 250,
    chunkLatents: 3,
  },
  commands: {
    setPrompt: (prompt) => ({ name: 'set_prompt', data: { prompt } }),
    setImage: (image) => ({ name: 'set_image', data: { image } }),
    setSeed: (seed) => ({ name: 'set_seed', data: { seed } }),
    setRotationSpeed: (deg) => ({
      name: 'set_rotation_speed_deg',
      data: { rotation_speed_deg: deg },
    }),
    lifecycle: (action) => ({ name: action, data: {} }),
    // why: one axis only, so forward wins over strafing — it is the more stable direction
    move: (prev, next) => {
      const previous = prev.longitudinal !== 'idle' ? prev.longitudinal : prev.lateral
      const movement = next.longitudinal !== 'idle' ? next.longitudinal : next.lateral
      return movement === previous ? [] : [{ name: 'set_movement', data: { movement } }]
    },
    look: (prev, next) => {
      const commands = []
      if (next.lookHorizontal !== prev.lookHorizontal) {
        commands.push({
          name: 'set_look_horizontal',
          data: { look_horizontal: next.lookHorizontal },
        })
      }
      if (next.lookVertical !== prev.lookVertical) {
        commands.push({ name: 'set_look_vertical', data: { look_vertical: next.lookVertical } })
      }
      return commands
    },
  },
}
