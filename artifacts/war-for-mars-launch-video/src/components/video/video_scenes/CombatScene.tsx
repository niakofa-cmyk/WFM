import { motion } from 'framer-motion';
import { ShipMark } from './ShipMark';

const FIGHTERS = [
  { x: 31, y: 54, dx: 9, dy: -7, scale: 1.35, red: false, delay: 0.14, rotate: -18 },
  { x: 39, y: 43, dx: 5, dy: -10, scale: 1.02, red: false, delay: 0.3, rotate: -23 },
  { x: 43, y: 61, dx: 11, dy: -12, scale: 1.2, red: false, delay: 0.46, rotate: -30 },
  { x: 50, y: 49, dx: 12, dy: 0, scale: 1.58, red: false, delay: 0.62, rotate: -9 },
  { x: 55, y: 60, dx: 7, dy: -17, scale: 0.98, red: false, delay: 0.78, rotate: -22 },
  { x: 69, y: 39, dx: -12, dy: 12, scale: 1.34, red: true, delay: 0.42, rotate: 150 },
  { x: 73, y: 59, dx: -17, dy: -1, scale: 1.14, red: true, delay: 0.56, rotate: 168 },
  { x: 82, y: 47, dx: -14, dy: 11, scale: 0.98, red: true, delay: 0.7, rotate: 135 },
];

export function CombatScene() {
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, scale: 1.08, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.26 } }}
      transition={{ duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
    >
      <div className="absolute inset-0 bg-[#090b11]" />
      <div className="absolute inset-0 opacity-[.17]" style={{ backgroundImage: 'radial-gradient(circle, rgba(230,225,214,.5) 1px, transparent 1.5px)', backgroundSize: '4.5vmin 4.5vmin' }} />
      <motion.div
        className="absolute left-[46%] top-[50%] h-[70vmin] w-[70vmin] rounded-full"
        style={{ left: 'calc(46% - 35vmin)', top: 'calc(50% - 35vmin)', background: 'radial-gradient(circle, rgba(196,92,72,.27), rgba(196,92,72,.06) 35%, transparent 70%)' }}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.05, 1], opacity: [0, 0.95, 0.55] }}
        transition={{ delay: 1.3, duration: 0.55 }}
      />
      <div className="film-corner tl" />
      <div className="film-corner tr" />
      <div className="film-corner bl" />
      <div className="film-corner br" />

      <div className="absolute left-[6.2%] top-[7.5%] z-20">
        <motion.p
          className="film-kicker m-0 text-solar"
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: .15, duration: .28 }}
        >
          LIVE MATCH
        </motion.p>
        <motion.p
          className="film-label mt-[.8vmin] text-bone/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: .4, duration: .25 }}
        >
          WING 01 · FRONTLINE ENGAGEMENT
        </motion.p>
      </div>
      <motion.div
        className="absolute right-[6.2%] top-[8%] z-20 flex items-center gap-[.9vmin]"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.18, duration: 0.3 }}
      >
        <span className="relative flex h-[1vmin] w-[1vmin] rounded-full bg-solar">
          <span className="absolute inset-0 animate-ping rounded-full bg-solar opacity-50" />
        </span>
        <span className="film-label text-solar">SIGNAL / CONNECTED</span>
      </motion.div>

      <motion.div
        className="absolute left-[43%] top-[53%] z-10 h-[38vmin] w-[38vmin]"
        style={{ left: 'calc(43% - 19vmin)', top: 'calc(53% - 19vmin)' }}
        initial={{ scale: 1.5, opacity: 0.9, rotate: -10 }}
        animate={{ scale: [1.5, 1.05, 1.12], opacity: [0.9, 0.5, 0.72], rotate: 0 }}
        transition={{ duration: 4.6, ease: 'easeInOut' }}
      >
        <div className="reticle absolute inset-0" />
        <div className="orbit-dash absolute inset-[20%]" />
      </motion.div>
      {FIGHTERS.map((fighter, index) => (
        <motion.div
          key={`fighter-${index}`}
          className="absolute z-10"
          style={{ left: `calc(${fighter.x}% - 3.55vmin)`, top: `calc(${fighter.y}% - 3.55vmin)` }}
          initial={{ x: fighter.red ? 80 : -75, y: fighter.red ? -40 : 50, opacity: 0, scale: 0.55 }}
          animate={{
            x: [fighter.red ? 80 : -75, 0, fighter.dx],
            y: [fighter.red ? -40 : 50, 0, fighter.dy],
            opacity: [0, 1, 1, 0.9],
            scale: [0.55, fighter.scale * 1.08, fighter.scale],
            rotate: [fighter.rotate + (fighter.red ? -26 : 24), fighter.rotate, fighter.rotate - 8],
          }}
          transition={{ delay: fighter.delay, duration: 3.6, times: [0, 0.42, 1], ease: [0.16, 1, 0.3, 1] }}
        >
          <ShipMark color={fighter.red ? '#c45c48' : '#e0a15a'} size="7.1vmin" className="ship-silhouette" />
        </motion.div>
      ))}

      <svg className="absolute inset-0 z-10 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
        <motion.path
          d="M600 518 L792 420 L950 470 L1130 350"
          fill="none"
          stroke="#ffd69f"
          strokeWidth="3"
          strokeDasharray="520"
          initial={{ strokeDashoffset: 520, opacity: 0 }}
          animate={{ strokeDashoffset: [520, 0, -520], opacity: [0, 1, 0.6] }}
          transition={{ delay: 1.4, duration: 1.2, ease: 'easeInOut' }}
        />
        <motion.path
          d="M1110 355 L980 523 L830 552"
          fill="none"
          stroke="#c45c48"
          strokeWidth="2"
          strokeDasharray="370"
          initial={{ strokeDashoffset: 370, opacity: 0 }}
          animate={{ strokeDashoffset: [370, 0, -150], opacity: [0, 0.9, 0.2] }}
          transition={{ delay: 1.72, duration: 1.05, ease: 'easeInOut' }}
        />
      </svg>
      <motion.div
        className="absolute left-[67%] top-[47%] z-20 h-[13vmin] w-[13vmin] rounded-full border border-solar/75"
        style={{ left: 'calc(67% - 6.5vmin)', top: 'calc(47% - 6.5vmin)', background: 'radial-gradient(circle,rgba(255,214,159,.55),rgba(224,161,90,.1) 45%,transparent 72%)' }}
        initial={{ scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 1.2, 1.7], opacity: [0, 0.95, 0] }}
        transition={{ delay: 2.02, duration: 0.48, times: [0, 0.25, 1] }}
      />
      <motion.div
        className="absolute left-[7%] top-[43%] z-20 border-l border-solar pl-[1.2vmin]"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.65, duration: 0.28 }}
      >
        <p className="film-title m-0 text-[5.2vmin] text-bone">WING<br /><span className="text-solar">04</span></p>
      </motion.div>
      <motion.div
        className="absolute bottom-[9%] left-[7%] z-20"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.55, duration: 0.32 }}
      >
        <p className="film-kicker m-0 text-solar">LOCK ACQUIRED</p>
        <div className="mt-[.9vmin] h-px w-[21vmin] bg-solar/60" />
      </motion.div>
      <motion.div
        className="absolute bottom-[9%] right-[7%] z-20 text-right"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.6, duration: 0.32 }}
      >
        <p className="film-label text-bone/55">LEAD CRAFT / SHIELDS</p>
        <p className="film-title mono m-0 mt-[.35vmin] text-[5.2vmin] text-solar">72%</p>
      </motion.div>
      <motion.div
        className="absolute left-[calc(50%-.35vmin)] top-[calc(50%-.35vmin)] z-20 h-[.7vmin] w-[.7vmin] rounded-full bg-solar"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 80, 160], opacity: [0, 0.9, 0] }}
        transition={{ delay: 4.48, duration: 0.5, times: [0, 0.3, 1] }}
      />
    </motion.section>
  );
}
