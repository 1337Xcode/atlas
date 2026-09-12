import { motion } from 'framer-motion'
export function Letterbox({ amount }: { amount: number }) {
  const h = amount * 12 + 'vh'
  return (
    <>
      <motion.div
        className="pointer-events-none fixed left-0 right-0 top-0 bg-black"
        animate={{ height: h }}
        transition={{ duration: 0 }}
      />
      <motion.div
        className="pointer-events-none fixed left-0 right-0 bottom-0 bg-black"
        animate={{ height: h }}
        transition={{ duration: 0 }}
      />
    </>
  )
}
