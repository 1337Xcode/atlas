import { motion } from 'framer-motion';
export function ObjectiveCard({ text, visible, resolved, letterbox }: { text: string; visible: boolean; resolved: boolean; letterbox: number }) {
  return (
    <motion.div className="pointer-events-none fixed left-8 ui flex flex-col gap-1.5" style={{ top: 'calc(' + letterbox * 12 + 'vh + 24px)' }} animate={{ opacity: visible ? 1 : 0 }} transition={{ duration: 1.4 }}>
      <span style={{ opacity: 0.45 }}>Objective</span>
      <span style={{ color: resolved ? 'rgba(255,178,86,0.85)' : undefined, textDecoration: resolved ? 'line-through' : 'none' }}>{text}</span>
    </motion.div>
  );
}
