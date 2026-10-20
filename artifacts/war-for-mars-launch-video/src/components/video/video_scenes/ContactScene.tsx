import { motion } from 'framer-motion';
import { ShipMark } from './ShipMark';

const CONTACTS = [
  { x: 31, y: 48, tone: 'solar', wait: 0.6 },
  { x: 37, y: 42, tone: 'solar', wait: 0.76 },
  { x: 42, y: 52, tone: 'solar', wait: 0.92 },
  { x: 47, y: 44, tone: 'solar', wait: 1.08 },
  { x: 52, y: 49, tone: 'solar', wait: 1.24 },
  { x: 66, y: 42, tone: 'red', wait: 1.45 },
  { x: 71, y: 50, tone: 'red', wait: 1.6 },
  { x: 76, y: 43, tone: 'red', wait: 1.75 },
  { x: 81, y: 52, tone: 'red', wait: 1.9 },
  { x: 86, y: 45, tone: 'red', wait: 2.05 },
];

export function ContactScene() {
  return (
    <motion.section
      className="film"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.28 } }}
      transition={{ duration: 0.25 }}
    >
      <motion.img
        alt=""
        aria-hidden="true"
        src={`${import.meta.env.BASE_URL}images/mars-front.jpg`}
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.17, x: '-1.5%' }}
        animate={{ scale: 1.04, x: '0%' }}
        transition={{ duration: 4.1, ease: [0.2, 0.7, 0.2, 1] }}
        style={{ filter: 'saturate(.86) brightness(.76)' }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,13,.85)_0%,rgba(7,8,13,.19)_43%,rgba(7,8,13,.24)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,8,13,.78)_0%,transparent_47%,rgba(7,8,13,.22)_100%)]" />
      <div className="film-corner tl" />
      <div className="film-corner tr" />
      <div className="film-corner bl" />
      <div className="film-corner br" />

      <motion.div
        className="absolute"
        style={{ left: 'calc(54% - 17.5vmin)', top: 'calc(54% - 17.5vmin)', width: '35vmin', height: '35vmin' }}
        initial={{ scale: 0.16, opacity: 0.1, rotate: -14 }}
        animate={{ scale: [0.16, 0.92, 1.05, 1], opacity: [0.12, 0.92, 0.65, 0.82], rotate: [ -14, 0, 2, 0 ] }}
        transition={{ duration: 3.8, times: [0, 0.25, 0.67, 1], ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="reticle absolute inset-0" />
        <div className="orbit-dash absolute inset-[18%] opacity-70" />
        <div className="absolute left-1/2 top-0 h-[14%] w-px bg-solar" />
        <div className="absolute left-1/2 bottom-0 h-[14%] w-px bg-solar" />
      </motion.div>

      <div className="absolute left-[6.3%] top-[8.5%] z-10">
        <motion.p
          className="film-kicker m-0 text-solar"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.46 }}
        >
          MARS / FRONTIER
        </motion.p>
        <motion.div
          className="mt-[1.2vmin] h-px w-[19vmin] bg-bone/45"
          initial={{ scaleX: 0, transformOrigin: 'left' }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        />
      </div>
      <motion.div
        className="absolute left-[6.3%] bottom-[13%] z-10"
        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ delay: 1.12, duration: 0.35 }}
      >
        <p className="film-title m-0 text-[10.5vmin] text-bone">10<br />CONTACTS</p>
        <div className="mt-[1.7vmin] flex items-center gap-[1.2vmin]">
          <span className="contact-dot" />
          <span className="film-label text-bone/70">WING SIGNAL DETECTED</span>
        </div>
      </motion.div>
      <motion.div
        className="absolute right-[6.3%] bottom-[13.2%] z-10 text-right"
        initial={{ scale: 1.8, opacity: 0, filter: 'blur(7px)' }}
        animate={{ scale: [1.8, 1.04, 1], opacity: 1, filter: 'blur(0px)' }}
        transition={{ delay: 2.2, duration: 0.4, ease: [0.12, 0.85, 0.2, 1] }}
      >
        <p className="film-title m-0 text-[12vmin] text-solar">5 <span className="text-bone/45">VS</span> 5</p>
        <p className="film-label mt-[1.2vmin] text-bone/65">LIVE WING COMBAT</p>
      </motion.div>

      {CONTACTS.map((contact, index) => {
        const enemy = contact.tone === 'red';
        return (
          <motion.div
            key={`contact-${index}`}
            className="absolute z-10"
            style={{ left: `${contact.x}%`, top: `${contact.y}%` }}
            initial={{ scale: 0, opacity: 0, rotate: enemy ? -45 : 45 }}
            animate={{ scale: [0, 1.35, 1], opacity: [0, 1, 0.82], rotate: 0, y: [12, 0, -3] }}
            transition={{ delay: contact.wait, duration: 0.4, ease: [0.15, 1, 0.3, 1] }}
          >
            <ShipMark color={enemy ? '#c45c48' : '#e0a15a'} size="2.3vmin" className="ship-silhouette" />
          </motion.div>
        );
      })}

      <motion.div
        className="absolute left-0 right-0 top-[57%] z-10 h-px bg-solar"
        initial={{ scaleX: 0, opacity: 0, transformOrigin: 'left' }}
        animate={{ scaleX: [0, 1, 1.2], opacity: [0, 0.75, 0] }}
        transition={{ duration: 1.1, times: [0, 0.72, 1], ease: 'linear' }}
      />
      <div className="absolute left-[6.3%] top-[17%] z-10 flex items-center gap-[1vmin]">
        <span className="h-[.8vmin] w-[.8vmin] rounded-full bg-alert" />
        <span className="film-label mono text-bone/55">SIGNAL / 00:04</span>
      </div>
      <motion.div
        className="absolute left-1/2 top-1/2 z-20 h-[1px] w-[1px] bg-solar"
        initial={{ scale: 1, opacity: 0 }}
        animate={{ scale: 1600, opacity: [0, 0, 1, 0] }}
        transition={{ delay: 3.68, duration: 0.45, times: [0, 0.1, 0.5, 1] }}
      />
    </motion.section>
  );
}
