"use client";

import { motion, AnimatePresence } from "framer-motion";

// 1 robot pixel = 4 SVG units
const P = 4;

function rp(col: number, row: number, w = 1, h = 1) {
  return { x: col * P, y: row * P, width: w * P, height: h * P };
}

type Rect = ReturnType<typeof rp>;

interface Face {
  leftEye: Rect[];
  rightEye: Rect[];
  mouth: Rect[];
}

// ViewBox: 0 0 48 60
// Head outer: x=4, y=16, w=40, h=40
// Inner screen: x=8, y=20, w=32, h=32
// Left eye zone: cols 3-5, rows 5-7 (x=12-20, y=20-28)
// Right eye zone: cols 7-9, rows 5-7 (x=28-36, y=20-28)
// Mouth zone: rows 9-11 (y=36-44)

const FACES: Face[] = [
  // 0: Neutral — dot eyes, flat mouth
  {
    leftEye: [rp(3, 6, 2, 2)],
    rightEye: [rp(7, 6, 2, 2)],
    mouth: [rp(4, 9, 4, 1)],
  },
  // 1: Thinking — dot + squint eye, small side mouth
  {
    leftEye: [rp(3, 6, 2, 2)],
    rightEye: [rp(7, 7, 2, 1)],
    mouth: [rp(6, 9, 2, 1)],
  },
  // 2: Surprised — tall eyes, open O mouth
  {
    leftEye: [rp(3, 5, 2, 3)],
    rightEye: [rp(7, 5, 2, 3)],
    mouth: [
      rp(4, 9, 3, 1),  // top bar of O
      rp(4, 11, 3, 1), // bottom bar
      rp(4, 10, 1, 1), // left side
      rp(6, 10, 1, 1), // right side
    ],
  },
  // 3: Happy — arc ^ eyes, big smile
  {
    leftEye: [rp(3, 7), rp(4, 6), rp(5, 7)],
    rightEye: [rp(7, 7), rp(8, 6), rp(9, 7)],
    mouth: [rp(3, 9), rp(9, 9), rp(4, 10, 5, 1)],
  },
  // 4: Confused — X eyes, wavy mouth
  {
    leftEye: [rp(3, 5), rp(5, 5), rp(4, 6), rp(3, 7), rp(5, 7)],
    rightEye: [rp(7, 5), rp(9, 5), rp(8, 6), rp(7, 7), rp(9, 7)],
    mouth: [rp(3, 10), rp(4, 9), rp(5, 10), rp(6, 9), rp(7, 10)],
  },
  // 5: Excited — + star eyes, wide smile
  {
    leftEye: [rp(4, 5), rp(3, 6), rp(4, 6), rp(5, 6), rp(4, 7)],
    rightEye: [rp(8, 5), rp(7, 6), rp(8, 6), rp(9, 6), rp(8, 7)],
    mouth: [rp(3, 9), rp(9, 9), rp(4, 10, 5, 1)],
  },
];

export default function PixelRobot({ msgIdx }: { msgIdx: number }) {
  const faceIdx = msgIdx % FACES.length;
  const face = FACES[faceIdx];

  return (
    <svg
      width="48"
      height="60"
      viewBox="0 0 48 60"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Blinking antenna light */}
      <motion.rect
        x={20} y={0} width={8} height={8} rx={4}
        className="fill-primary"
        animate={{ opacity: [1, 0.15, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Antenna stem */}
      <rect x={22} y={8} width={4} height={8} className="fill-muted-foreground" opacity={0.4} />

      {/* Head outer shell */}
      <rect x={4} y={16} width={40} height={40} rx={2} className="fill-card" stroke="currentColor" strokeWidth={1.5} opacity={0.3} />
      <rect x={4} y={16} width={40} height={40} rx={2} className="fill-card" />

      {/* Ear ports */}
      <rect x={0} y={29} width={4} height={5} rx={1} className="fill-muted-foreground" opacity={0.45} />
      <rect x={44} y={29} width={4} height={5} rx={1} className="fill-muted-foreground" opacity={0.45} />

      {/* Inner screen */}
      <rect x={8} y={20} width={32} height={32} className="fill-muted" opacity={0.4} />

      {/* Corner bolts */}
      {([
        [5, 17], [40, 17], [5, 52], [40, 52],
      ] as [number, number][]).map(([x, y]) => (
        <rect key={`${x}${y}`} x={x} y={y} width={3} height={3} className="fill-muted-foreground" opacity={0.35} />
      ))}

      {/* Face — cross-fades when message changes */}
      <AnimatePresence mode="wait">
        <motion.g
          key={faceIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fill-foreground"
        >
          {face.leftEye.map((r, i) => <rect key={`le${i}`} {...r} />)}
          {face.rightEye.map((r, i) => <rect key={`re${i}`} {...r} />)}
          {face.mouth.map((r, i) => <rect key={`m${i}`} {...r} />)}
        </motion.g>
      </AnimatePresence>
    </svg>
  );
}
