import { motion } from 'framer-motion';

export function FinaleScene() {
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, backgroundColor: '#1b1713' }}
      animate={{ opacity: 1, backgroundColor: '#07080d' }}
      exit={{ opacity: 1, transition: { duration: 0.01 } }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_49%,rgba(57,45,34,.34),transparent_56%)]" />
      <div className="film-corner tl" />
      <div className="film-corner tr" />
      <div className="film-corner bl" />
      <div className="film-corner br" />

      <motion.div
        className="absolute left-1/2 top-[47%] z-0 h-[66vmin] w-[82vmin]"
        style={{ left: 'calc(50% - 41vmin)', top: 'calc(47% - 33vmin)' }}
        initial={{ scale: 0.72, rotate: -24, opacity: 0 }}
        animate={{ scale: [0.72, 1.03, 1], rotate: [-24, -12, -12], opacity: [0, .78, .52] }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 rounded-[50%] border border-solar/55" />
        <div className="absolute inset-[7%] rounded-[50%] border border-bone/10" />
        <motion.div
          className="absolute left-1/2 top-[-.6vmin] h-[1.2vmin] w-[1.2vmin] rounded-full bg-solar"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '0 33vmin' }}
        />
      </motion.div>
      <motion.div
        className="absolute left-[19%] top-[42%] z-10 w-[62%]"
        initial={{ opacity: 0, scale: .94, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ delay: .5, duration: .72, ease: [0.18, 1, .25, 1] }}
      >
        <img
          src={`${import.meta.env.BASE_URL}images/war-for-mars-logo.jpg`}
          alt="WAR FOR MARS"
          className="logo-art block w-full"
          style={{ objectFit: 'contain' }}
        />
      </motion.div>
      <motion.div
        className="absolute left-[19%] top-[66%] z-10 w-[62%]"
        initial={{ scaleX: 0, opacity: 0, transformOrigin: 'center' }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 1.12, duration: .48, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="hairline w-full bg-solar/60" />
        <p className="film-label mt-[1.25vmin] text-center text-bone/70">
          LIVE 5V5 <span className="px-[.8vmin] text-solar">·</span> HUMAN PILOTS + AI WINGS
        </p>
      </motion.div>
      <motion.p
        className="film-kicker absolute bottom-[8%] left-1/2 z-10 m-0 -translate-x-1/2 text-center text-bone/35"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: .5 }}
      >
        CONTACT THE FRONT
      </motion.p>
      <motion.div
        className="absolute left-0 top-[57%] z-20 h-px w-[100vw] bg-solar"
        style={{ transformOrigin: 'left', rotate: '-7deg' }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 1, 0], opacity: [0, .8, .48, 0] }}
        transition={{ delay: 4.62, duration: .48, times: [0, .18, .55, 1], ease: 'linear' }}
      />
      <motion.div
        className="absolute left-0 right-0 top-[57%] z-20 h-px bg-solar"
        initial={{ scaleX: 0, opacity: 0, transformOrigin: 'left' }}
        animate={{ scaleX: [0, 1, 0], opacity: [0, .8, 0] }}
        transition={{ delay: 5.08, duration: .3, times: [0, .28, 1], ease: 'linear' }}
      />
    </motion.section>
  );
}
