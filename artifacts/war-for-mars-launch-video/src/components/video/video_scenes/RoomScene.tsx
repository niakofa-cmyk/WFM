import { motion } from 'framer-motion';
import { ShipMark } from './ShipMark';

const SEATS = Array.from({ length: 5 }, (_, index) => index);

function Seat({ index, enemy, pilot = false }: { index: number; enemy?: boolean; pilot?: boolean }) {
  const color = enemy ? '#c45c48' : '#e0a15a';
  return (
    <motion.div
      className={`team-bay relative flex h-[13.6vmin] flex-col items-center justify-center ${enemy ? 'red' : ''}`}
      initial={{ opacity: 0, scale: 0.52, y: enemy ? 20 : -20, rotateX: enemy ? 16 : -16 }}
      animate={{ opacity: 1, scale: [0.52, 1.06, 1], y: 0, rotateX: 0 }}
      transition={{ delay: 0.32 + index * 0.15 + (enemy ? 0.8 : 0), duration: 0.42, ease: [0.18, 1, 0.25, 1] }}
      style={{ borderColor: `${color}88`, transformStyle: 'preserve-3d' }}
    >
      <span className="absolute left-[15%] top-[15%] font-display text-[1.8vmin] font-bold tracking-widest text-bone/30">
        {String(index + 1).padStart(2, '0')}
      </span>
      <ShipMark color={color} size="4.2vmin" className="ship-silhouette" />
      <span className="film-label mt-[.9vmin]" style={{ color: pilot ? '#e6e1d6' : `${color}cc` }}>
        {pilot ? 'PILOT' : 'AI WING'}
      </span>
      <motion.span
        className="absolute bottom-[1.2vmin] h-[.55vmin] w-[38%]"
        style={{ backgroundColor: color }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pilot ? 1 : 0.45, opacity: [0.28, 0.8, 0.45] }}
        transition={{ delay: 0.45 + index * 0.16, duration: 0.35 }}
      />
    </motion.div>
  );
}

export function RoomScene() {
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, scale: 1.025, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.25 } }}
      transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,#252019_0%,#11131a_38%,#07080d_78%)]" />
      <div className="absolute inset-0 opacity-[.11]" style={{ backgroundImage: 'linear-gradient(rgba(230,225,214,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(230,225,214,.18) 1px, transparent 1px)', backgroundSize: '5.8vmin 5.8vmin' }} />
      <div className="film-corner tl" />
      <div className="film-corner tr" />
      <div className="film-corner bl" />
      <div className="film-corner br" />

      <motion.div
        className="reticle absolute left-1/2 top-1/2 z-0 h-[56vmin] w-[56vmin]"
        style={{ left: 'calc(50% - 28vmin)', top: 'calc(50% - 28vmin)' }}
        initial={{ scale: 1.35, opacity: 0.8, rotate: -8 }}
        animate={{ scale: [1.35, 1, 1.08], opacity: [0.8, 0.36, 0.66], rotate: 0 }}
        transition={{ duration: 3.8, ease: 'easeInOut' }}
      />
      <div className="absolute left-[6.4%] top-[7.2%] z-10">
        <p className="film-kicker m-0 text-solar">LIVE ROOM</p>
        <p className="film-label mt-[.8vmin] text-bone/48">PHOBOS YARD · PRIVATE WING</p>
      </div>
      <motion.div
        className="absolute left-1/2 top-[8%] z-10 -translate-x-1/2 text-center"
        initial={{ opacity: 0, scale: 0.4, y: -18 }}
        animate={{ opacity: 1, scale: [0.4, 1.1, 1], y: 0 }}
        transition={{ delay: 0.38, duration: 0.45 }}
      >
        <p className="film-title m-0 text-[7.2vmin] text-bone">5 <span className="text-solar">/</span> 5</p>
        <p className="film-label mt-[.4vmin] text-bone/45">WING STRENGTH</p>
      </motion.div>
      <motion.div className="absolute left-[8%] right-[8%] top-[30%] z-10 flex items-center gap-[1.6vmin]">
        <span className="film-kicker text-solar">YOUR WING</span>
        <span className="hairline flex-1 bg-solar/50" />
        <span className="film-label mono text-bone/55">ACCORD · 01–05</span>
      </motion.div>
      <div className="absolute left-[8%] right-[8%] top-[38%] z-10 grid grid-cols-5 gap-[.75vmin]">
        {SEATS.map((seat) => <Seat key={`ally-${seat}`} index={seat} pilot={seat === 0} />)}
      </div>
      <motion.div className="absolute left-[8%] right-[8%] top-[56.5%] z-10 flex items-center gap-[1.6vmin]">
        <span className="film-kicker text-alert">THE ACCORD</span>
        <span className="hairline flex-1 bg-alert/55" />
        <span className="film-label mono text-bone/55">OPPOSITION · 06–10</span>
      </motion.div>
      <div className="absolute left-[8%] right-[8%] top-[64.5%] z-10 grid grid-cols-5 gap-[.75vmin]">
        {SEATS.map((seat) => <Seat key={`enemy-${seat}`} index={seat} enemy />)}
      </div>

      <motion.div
        className="absolute bottom-[6.8%] left-[8%] z-10 flex items-center gap-[1.1vmin]"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.15, duration: 0.3 }}
      >
        <span className="h-[1.15vmin] w-[1.15vmin] rounded-full bg-solar shadow-[0_0_1.2vmin_#e0a15a]" />
        <span className="film-label text-bone/70">OPEN SEATS · AI CONTROLLED</span>
      </motion.div>
      <motion.p
        className="film-title absolute bottom-[6.1%] right-[8%] z-10 m-0 text-right text-[4.7vmin] text-bone"
        initial={{ opacity: 0, x: 20, filter: 'blur(7px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ delay: 3.1, duration: 0.4 }}
      >
        10 PILOTS.<br /><span className="text-solar">ONE MATCH.</span>
      </motion.p>
      <motion.div
        className="absolute left-1/2 top-1/2 z-20 h-[1px] w-[1px] bg-bone"
        initial={{ scale: 1, opacity: 0 }}
        animate={{ scale: 1700, opacity: [0, 0, 0.85, 0] }}
        transition={{ delay: 3.6, duration: 0.46, times: [0, 0.05, 0.52, 1] }}
      />
    </motion.section>
  );
}
