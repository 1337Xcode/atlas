import { AnimatePresence, motion } from 'framer-motion'
export function TitleCard({
  text,
  kind,
  letterbox,
}: {
  text: string
  kind: 'voice' | 'archive' | 'read'
  letterbox: number
}) {
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 flex justify-center ui"
      style={{ bottom: 'calc(' + letterbox * 12 + 'vh + 28px)' }}
    >
      <AnimatePresence mode="wait">
        {text && (
          <motion.div
            key={text}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              maxWidth: '56ch',
              textAlign: 'center',
              lineHeight: 1.55,
              fontStyle: kind === 'archive' ? 'italic' : 'normal',
              opacity: kind === 'archive' ? 0.55 : 0.78,
            }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
