import { motion } from 'framer-motion';
import { ShipMark } from './ShipMark';

const MAP_CONTACTS = [
  { x: 50, y: 18, red: false, wait: 0.32 },
  { x: 35, y: 25, red: false, wait: 0.46 },
  { x: 65, y: 27, red: false, wait: 0.6 },
  { x: 30, y: 42, red: false, wait: 0.74 },
  { x: 69, y: 43, red: false, wait: 0.88 },
  { x: 49, y: 76, red: true, wait: 0.4 },
  { x: 37, y: 68, red: true, wait: 0.55 },
  { x: 61, y: 66, red: true, wait: 0.7 },
  { x: 31, y: 57, red: true, wait: 0.84 },
  { x: 69, y: 56, red: true, wait: 0.98 },
];

export function TouchScene() {
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.28 } }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0 bg-[#0a0c12]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(224,161,90,.1),transparent_38%,rgba(196,92,72,.09))]" />
      <div className="absolute left-[50%] top-0 h-full w-px bg-bone/12" />
      <div className="film-corner tl" />
      <div className="film-corner tr" />
      <div className="film-corner bl" />
      <div className="film-corner br" />
      <motion.div
        className="absolute left-[6.2%] top-[7%] z-20"
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: .22, duration: .3 }}
      >
        <p className="film-kicker m-0 text-solar">HOLD THE RELAY</p>
        <p className="film-label mt-[.7vmin] text-bone/48">TWO OBJECTIVES · TEN SHIPS</p>
      </motion.div>
      <motion.div
        className="absolute right-[7%] top-[8%] z-20 flex items-center gap-[1vmin]"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.5, duration: 0.32 }}
      >
        <span className="h-[.8vmin] w-[.8vmin] rounded-full bg-solar" />
        <span className="film-label text-solar">ACCORD +1</span>
      </motion.div>

      <motion.div
        className="absolute left-[44%] top-[16%] z-10 h-[67vmin] w-[67vmin]"
        style={{ left: 'calc(44% - 33.5vmin)' }}
        initial={{ scale: 0.75, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-[8%] rounded-full border border-bone/15" />
        <div className="absolute inset-[18%] rounded-full border border-bone/20" />
        <div className="absolute inset-[28%] rounded-full border border-bone/15" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-bone/10" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-bone/10" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 500" aria-hidden="true">
          <motion.path d="M95 120 C170 184 228 188 310 240 S394 321 416 388" fill="none" stroke="#e0a15a" strokeWidth="2" strokeDasharray="500" initial={{ strokeDashoffset: 500 }} animate={{ strokeDashoffset: 0 }} transition={{ delay: .45, duration: 1.5, ease: 'easeInOut' }} />
          <motion.path d="M398 90 C318 137 280 174 218 262 S152 333 92 385" fill="none" stroke="#c45c48" strokeWidth="1.5" strokeDasharray="470" initial={{ strokeDashoffset: 470 }} animate={{ strokeDashoffset: 0 }} transition={{ delay: .65, duration: 1.2, ease: 'easeInOut' }} />
        </svg>
        {MAP_CONTACTS.map((contact, index) => (
          <motion.div
            key={`map-${index}`}
            className="absolute z-10"
            style={{ left: `calc(${contact.x}% - 1.65vmin)`, top: `calc(${contact.y}% - 1.65vmin)` }}
            initial={{ opacity: 0, scale: 0, rotate: 90 }}
            animate={{ opacity: 1, scale: [0, 1.25, 1], rotate: 0, x: index % 2 ? 7 : -7 }}
            transition={{ delay: contact.wait, duration: .34, ease: [0.15, 1, 0.3, 1] }}
          >
            <ShipMark color={contact.red ? '#c45c48' : '#e0a15a'} size="3.3vmin" />
          </motion.div>
        ))}
        <motion.div
          className="absolute left-[30%] top-[35%] h-[11vmin] w-[11vmin] rounded-full border-2 border-alert"
          style={{ left: 'calc(30% - 5.5vmin)', top: 'calc(35% - 5.5vmin)' }}
          initial={{ scale: .4, opacity: .2 }}
          animate={{ scale: [0.4, 1.25, 0.94], opacity: [0.2, 0.95, 0.55], borderColor: ['#c45c48', '#e0a15a', '#e0a15a'] }}
          transition={{ delay: 1.5, duration: .7, times: [0, .55, 1] }}
        >
          <span className="absolute left-1/2 top-1/2 h-[2.5vmin] w-[2.5vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-solar shadow-[0_0_2vmin_#e0a15a]" />
        </motion.div>
        <div className="absolute right-[25%] top-[66%] flex h-[6vmin] w-[6vmin] items-center justify-center rounded-full border border-bone/50">
          <span className="h-[1.3vmin] w-[1.3vmin] rounded-full bg-alert" />
        </div>
      </motion.div>

      <motion.div
        className="absolute left-[6.2%] top-[26%] z-20"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.68, duration: .32 }}
      >
        <p className="film-title m-0 text-[5.8vmin] text-bone">TOUCH<br /><span className="text-solar">AIM</span><br />FIRE</p>
        <div className="mt-[1.4vmin] w-[20vmin] border-t border-solar/45 pt-[1vmin]">
          <p className="film-label m-0 text-bone/65">ON-DEVICE<br />CONTROLS</p>
        </div>
      </motion.div>
      <motion.div
        className="absolute left-[9.5%] bottom-[13%] z-20 flex flex-col items-center gap-[1vmin]"
        initial={{ opacity: 0, scale: .5 }}
        animate={{ opacity: 1, scale: [0.5, 1.08, 1] }}
        transition={{ delay: 3.02, duration: .42 }}
      >
        <div className="control-mark relative h-[13vmin] w-[13vmin]">
          <div className="absolute inset-[18%] rounded-full border border-bone/20" />
          <motion.span
            className="absolute left-1/2 top-1/2 h-[4.1vmin] w-[4.1vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-solar"
            animate={{ x: [-7, 5, -2], y: [3, -5, 1] }}
            transition={{ duration: 1.15, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
        </div>
        <span className="film-label text-bone/65">LEFT STICK · MOVE</span>
      </motion.div>
      <motion.div
        className="absolute bottom-[13%] right-[9.5%] z-20 flex flex-col items-center gap-[1vmin]"
        initial={{ opacity: 0, scale: .5 }}
        animate={{ opacity: 1, scale: [0.5, 1.08, 1] }}
        transition={{ delay: 3.7, duration: .42 }}
      >
        <div className="relative flex h-[13vmin] w-[13vmin] items-center justify-center rounded-full border border-alert/70 bg-alert/10">
          <motion.span
            className="absolute inset-[17%] rounded-full border border-alert/45"
            animate={{ scale: [0.8, 1.12, .8], opacity: [.4, .8, .4] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
          <span className="film-title text-[4vmin] text-alert">FIRE</span>
        </div>
        <span className="film-label text-bone/65">RIGHT SIDE · AIM + FIRE</span>
      </motion.div>
      <motion.div
        className="absolute bottom-[5.2%] right-[6.2%] z-20 text-right"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 4.27, duration: .3 }}
      >
        <p className="film-label m-0 text-bone/55">READY ROOM</p>
        <p className="film-title m-0 mt-[.4vmin] text-[3.6vmin] text-solar">10/10 SEATS · AI WINGS</p>
      </motion.div>
      <motion.div
        className="absolute left-1/2 top-1/2 z-30 h-[1px] w-[1px] bg-solar"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1, 480], opacity: [0, 1, 0] }}
        transition={{ delay: 4.7, duration: .38, times: [0, .1, 1] }}
      />
    </motion.section>
  );
}
