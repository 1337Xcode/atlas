import type { WorldModelDescriptor } from '../wire.ts'

// docs: https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema
// note: 1664x960 at 48fps, chunk is 3 latents (~12 pixel frames)
export const LINGBOT_WORLD_2: WorldModelDescriptor = {
  id: 'lingbot-world-2',
  slug: 'reactor/lingbot-world-2',
  capabilities: {
    promptCharBudget: 2000,
    hotSwapPrompt: true,
    move: { lateral: true },
    // why: the reference app routes all look and vertical motion through the pose channel
    look: { mode: 'camera-pose' },
    vertical: true,
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
    // feat: two independent axes, so W+A drives a diagonal
    move: (prev, next) => {
      const commands = []
      if (next.longitudinal !== prev.longitudinal) {
        commands.push({
          name: 'set_move_longitudinal',
          data: { move_longitudinal: next.longitudinal },
        })
      }
      if (next.lateral !== prev.lateral) {
        commands.push({ name: 'set_move_lateral', data: { move_lateral: next.lateral } })
      }
      return commands
    },
    // note: unused while look runs on the pose channel, kept for parity with the schema
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
    setCameraPose: (pose) => ({ name: 'set_camera_pose', data: { camera_pose: [...pose] } }),
    setKvCacheReset: (mode) => ({ name: 'set_kv_cache_reset', data: { mode } }),
    triggerKvCacheReset: () => ({ name: 'trigger_kv_cache_reset', data: {} }),
    setAttnWindow: (window) => ({ name: 'set_attn_window', data: { attn_window: window } }),
  },
}
