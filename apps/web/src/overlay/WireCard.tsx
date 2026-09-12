import { motion } from 'framer-motion';
export function WireCard({ time, agency, text, visible }: { time: string; agency: string; text: string; visible: boolean }) {
  return (
    <motion.div className="pointer-events-none fixed left-1/2 top-1/2 ui flex flex-col gap-2.5 border px-7 py-5" style={{ transform: 'translate(-50%,-50%)', background: 'rgba(8,7,6,0.82)', borderColor: 'rgba(235,230,220,0.18)', minWidth: 260 }} animate={{ opacity: visible ? 1 : 0 }} transition={{ duration: 0.6 }}>
      <span className="uppercase" style={{ opacity: 0.45 }}>{time} {agency} flash</span>
      <span className="uppercase" style={{ letterSpacing: '0.12em', opacity: 0.9 }}>{text}</span>
    </motion.div>
  );
}
