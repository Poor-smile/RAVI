"use client";

import { motion, useReducedMotion } from "motion/react";

const DURATION_SECONDS = 6;

const nodeOpacity = [0, 0, 0.92, 0.92, 0, 0, 0.92, 0.92, 0, 0];
const nodeY = [10, 10, 0, 0, 10, 10, 0, 0, 10];
const shineOpacity = [0, 0, 1, 0, 0, 1, 0, 0];
const shineX = (distance: number) => [0, 0, distance, distance, 0, 0, distance, distance, 0];

const glassNodes = [
  {
    left: "17.93%", top: "27.16%", width: "19.15%", distance: 218,
    opacityTimes: [0, 0.0946, 0.1412, 0.1912, 0.2446, 0.5946, 0.6412, 0.6912, 0.7446, 1],
    yTimes: [0, 0.0583, 0.1217, 0.4999, 0.5, 0.5583, 0.6217, 0.9999, 1],
    shineOpacityTimes: [0, 0.1379, 0.1746, 0.2179, 0.6379, 0.6746, 0.7179, 1],
    shineXTimes: [0, 0.1379, 0.2179, 0.4999, 0.5, 0.6379, 0.7179, 0.9999, 1],
  },
  {
    left: "43.47%", top: "21.40%", width: "17.02%", distance: 204,
    opacityTimes: [0, 0.1664, 0.2131, 0.2631, 0.3164, 0.6664, 0.7131, 0.7631, 0.8164, 1],
    yTimes: [0, 0.115, 0.1783, 0.4999, 0.5, 0.615, 0.6783, 0.9999, 1],
    shineOpacityTimes: [0, 0.2098, 0.2464, 0.2898, 0.7098, 0.7464, 0.7898, 1],
    shineXTimes: [0, 0.2098, 0.2898, 0.4999, 0.5, 0.7098, 0.7898, 0.9999, 1],
  },
  {
    left: "65.65%", top: "38.68%", width: "17.02%", distance: 204,
    opacityTimes: [0, 0.2316, 0.2783, 0.3283, 0.3816, 0.7316, 0.7783, 0.8283, 0.8816, 1],
    yTimes: [0, 0.1717, 0.235, 0.4999, 0.5, 0.6717, 0.735, 0.9999, 1],
    shineOpacityTimes: [0, 0.2749, 0.3116, 0.3549, 0.7749, 0.8116, 0.8549, 1],
    shineXTimes: [0, 0.2749, 0.3549, 0.4999, 0.5, 0.7749, 0.8549, 0.9999, 1],
  },
  {
    left: "37.39%", top: "64.61%", width: "17.02%", distance: 204,
    opacityTimes: [0, 0.1486, 0.1952, 0.2452, 0.2986, 0.6486, 0.6952, 0.7452, 0.7986, 1],
    yTimes: [0, 0.2283, 0.2917, 0.4999, 0.5, 0.7283, 0.7917, 0.9999, 1],
    shineOpacityTimes: [0, 0.1919, 0.2286, 0.2719, 0.6919, 0.7286, 0.7719, 1],
    shineXTimes: [0, 0.1919, 0.2719, 0.4999, 0.5, 0.6919, 0.7719, 0.9999, 1],
  },
  {
    left: "60.79%", top: "61.73%", width: "17.02%", distance: 204,
    opacityTimes: [0, 0.2173, 0.264, 0.314, 0.3673, 0.7173, 0.764, 0.814, 0.8673, 1],
    yTimes: [0, 0.285, 0.3483, 0.4999, 0.5, 0.785, 0.8483, 0.9999, 1],
    shineOpacityTimes: [0, 0.2607, 0.2973, 0.3407, 0.7607, 0.7973, 0.8407, 1],
    shineXTimes: [0, 0.2607, 0.3407, 0.4999, 0.5, 0.7607, 0.8407, 0.9999, 1],
  },
] as const;

const particleEasing = (t: number) =>
  1 - Math.exp(-t * 7.4426) * (Math.cos(t * 10.5254) + 0.7071 * Math.sin(t * 10.5254));

const raaviPulseEasing = (t: number) =>
  1 - Math.exp(-t * 7.6657) * (Math.cos(t * 6.7605) + 1.1339 * Math.sin(t * 6.7605));

const particleVariants = [
  [0, 0.025, 0.0617, 0.15, 0.525, 0.5617, 0.65, 1],
  [0, 0.095, 0.1317, 0.22, 0.595, 0.6317, 0.72, 1],
  [0, 0.165, 0.2017, 0.29, 0.665, 0.7017, 0.79, 1],
  [0, 0.235, 0.2717, 0.36, 0.735, 0.7717, 0.86, 1],
] as const;

const particles = [
  { left: "11.55%", top: "19.75%", size: 7, variant: 0 },
  { left: "83.28%", top: "23.05%", size: 4, variant: 1 },
  { left: "89.67%", top: "53.91%", size: 4, variant: 2 },
  { left: "13.98%", top: "73.25%", size: 7, variant: 3 },
  { left: "79.03%", top: "86.01%", size: 4, variant: 0 },
  { left: "49.54%", top: "13.17%", size: 4, variant: 1 },
  { left: "24.32%", top: "53.50%", size: 7, variant: 2 },
  { left: "60.49%", top: "60.08%", size: 4, variant: 3 },
] as const;

const copyStages = [
  {
    text: "ساختار متن را می‌خوانم…",
    opacityTimes: [0, 0.0166, 0.0167, 0.2583, 0.2917, 1],
    revealTimes: [0, 0.0167, 0.15, 0.9999, 1],
  },
  {
    text: "گره‌ها و تصمیم‌ها را استخراج می‌کنم…",
    opacityTimes: [0, 0.3332, 0.3333, 0.575, 0.6083, 1],
    revealTimes: [0, 0.3333, 0.4667, 0.9999, 1],
  },
  {
    text: "ارتباط‌ها را بررسی می‌کنم…",
    opacityTimes: [0, 0.6499, 0.65, 0.8917, 0.925, 1],
    revealTimes: [0, 0.65, 0.7833, 0.9999, 1],
  },
] as const;

export function MermaidBuildingPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mermaid-building-preview" role="status" aria-live="polite" aria-label="راوی در حال ساخت نمودار است">
      <div className="mermaid-building-atmosphere" aria-hidden="true">
        <motion.div
          className="mermaid-building-sweep-wrap"
          initial={reduceMotion ? false : { opacity: 0, x: 0 }}
          animate={reduceMotion ? { opacity: 0.2, x: 0 } : {
            opacity: [0, 0.85, 0.85, 0, 0, 0.85, 0.85, 0, 0],
            x: [0, 1120, 1120, 0, 1120, 1120, 0],
          }}
          transition={reduceMotion ? { duration: 0 } : {
            opacity: { duration: DURATION_SECONDS, times: [0, 0.0417, 0.4417, 0.47, 0.5, 0.5417, 0.9417, 0.97, 1], ease: ["easeOut", "linear", "easeOut", "linear", "easeOut", "linear", "easeOut", "linear"], repeat: Infinity },
            x: { duration: DURATION_SECONDS, times: [0, 0.47, 0.4999, 0.5, 0.97, 0.9999, 1], ease: ["easeInOut", "linear", "linear", "easeInOut", "linear", "linear"], repeat: Infinity },
          }}
        >
          <div className="mermaid-building-sweep-rotation"><div className="mermaid-building-sweep" /></div>
        </motion.div>

        {glassNodes.map((node, index) => (
          <motion.div
            key={index}
            className="mermaid-building-glass-node"
            data-building-node={index + 1}
            style={{ left: node.left, top: node.top, width: node.width }}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? { opacity: 0.58, y: 0 } : { opacity: nodeOpacity, y: nodeY }}
            transition={reduceMotion ? { duration: 0 } : {
              opacity: { duration: DURATION_SECONDS, times: [...node.opacityTimes], ease: ["linear", "easeOut", "linear", "easeOut", "linear", "easeOut", "linear", "easeOut", "linear"], repeat: Infinity },
              y: { duration: DURATION_SECONDS, times: [...node.yTimes], ease: ["linear", "easeOut", "linear", "linear", "linear", "easeOut", "linear", "linear"], repeat: Infinity },
            }}
          >
            <motion.div
              className="mermaid-building-inner-shine"
              initial={reduceMotion ? false : { opacity: 0, x: 0 }}
              animate={reduceMotion ? { opacity: 0, x: 0 } : { opacity: shineOpacity, x: shineX(node.distance) }}
              transition={reduceMotion ? { duration: 0 } : {
                opacity: { duration: DURATION_SECONDS, times: [...node.shineOpacityTimes], ease: ["linear", "easeOut", "easeOut", "linear", "easeOut", "easeOut", "linear"], repeat: Infinity },
                x: { duration: DURATION_SECONDS, times: [...node.shineXTimes], ease: ["linear", "easeInOut", "linear", "linear", "linear", "easeInOut", "linear", "linear"], repeat: Infinity },
              }}
            >
              <i />
            </motion.div>
          </motion.div>
        ))}

        {particles.map((particle, index) => {
          const times = particleVariants[particle.variant];
          return (
            <motion.img
              key={index}
              className="mermaid-building-particle"
              src={`/graph-studio/magic-particle-${index + 1}.svg`}
              alt=""
              style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size }}
              initial={reduceMotion ? false : { opacity: 0, scaleX: 0.6, scaleY: 0.6 }}
              animate={reduceMotion ? { opacity: 0, scaleX: 0.7, scaleY: 0.7 } : {
                opacity: [0, 0, 1, 0, 0, 1, 0, 0],
                scaleX: [0.6, 0.6, 1.3, 0.7, 0.6, 1.3, 0.7, 0.7],
                scaleY: [0.6, 0.6, 1.3, 0.7, 0.6, 1.3, 0.7, 0.7],
              }}
              transition={reduceMotion ? { duration: 0 } : {
                opacity: { duration: DURATION_SECONDS, times: [...times], ease: ["linear", "easeOut", "easeOut", "linear", "easeOut", "easeOut", "linear"], repeat: Infinity },
                scaleX: { duration: DURATION_SECONDS, times: [...times], ease: ["linear", particleEasing, "easeOut", [0.5, 0, 0.5, 1], particleEasing, "easeOut", "linear"], repeat: Infinity },
                scaleY: { duration: DURATION_SECONDS, times: [...times], ease: ["linear", particleEasing, "easeOut", [0.5, 0, 0.5, 1], particleEasing, "easeOut", "linear"], repeat: Infinity },
              }}
            />
          );
        })}
      </div>

      <div className="mermaid-building-message">
        <motion.div
          className="mermaid-building-raavi-mark"
          initial={reduceMotion ? false : { opacity: 0.75, scaleX: 1, scaleY: 1 }}
          animate={reduceMotion ? { opacity: 1, scaleX: 1, scaleY: 1 } : {
            opacity: [0.75, 1, 0.75, 1, 0.75, 1, 0.75, 1, 0.75],
            scaleX: [1, 1.08, 1, 1.08, 1, 1.08, 1, 1.08, 1],
            scaleY: [1, 1.08, 1, 1.08, 1, 1.08, 1, 1.08, 1],
          }}
          transition={reduceMotion ? { duration: 0 } : {
            opacity: { duration: DURATION_SECONDS, times: [0, 0.1333, 0.2667, 0.4, 0.5, 0.6333, 0.7667, 0.9, 1], ease: "easeOut", repeat: Infinity },
            scaleX: { duration: DURATION_SECONDS, times: [0, 0.1333, 0.2667, 0.4, 0.5, 0.6333, 0.7667, 0.9, 1], ease: [raaviPulseEasing, [0.5, 0, 0.5, 1], raaviPulseEasing, [0.5, 0, 0.5, 1], raaviPulseEasing, [0.5, 0, 0.5, 1], raaviPulseEasing, [0.5, 0, 0.5, 1]], repeat: Infinity },
            scaleY: { duration: DURATION_SECONDS, times: [0, 0.1333, 0.2667, 0.4, 0.5, 0.6333, 0.7667, 0.9, 1], ease: [raaviPulseEasing, [0.5, 0, 0.5, 1], raaviPulseEasing, [0.5, 0, 0.5, 1], raaviPulseEasing, [0.5, 0, 0.5, 1], raaviPulseEasing, [0.5, 0, 0.5, 1]], repeat: Infinity },
          }}
        >
          {/* Exact approved Raavi AI asset exported from Figma. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/graph-studio/raavi-ai-approved.svg" alt="" />
        </motion.div>
        <strong>راوی در حال ساخت نمودار است…</strong>
        <div className="mermaid-building-microcopy" aria-hidden="true">
          {copyStages.map((stage, index) => (
            <motion.span
              key={stage.text}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={reduceMotion ? { opacity: index === 0 ? 1 : 0 } : { opacity: [0, 0, 1, 1, 0, 0] }}
              transition={reduceMotion ? { duration: 0 } : { opacity: { duration: DURATION_SECONDS, times: [...stage.opacityTimes], ease: ["linear", "linear", "linear", "easeOut", "linear"], repeat: Infinity } }}
            >
              <motion.i
                initial={reduceMotion ? false : { clipPath: "inset(0 0 0 99.75%)" }}
                animate={reduceMotion ? { clipPath: "inset(0 0 0 0)" } : { clipPath: ["inset(0 0 0 99.75%)", "inset(0 0 0 99.75%)", "inset(0 0 0 0)", "inset(0 0 0 0)", "inset(0 0 0 99.75%)"] }}
                transition={reduceMotion ? { duration: 0 } : { clipPath: { duration: DURATION_SECONDS, times: [...stage.revealTimes], ease: "linear", repeat: Infinity } }}
              >
                {stage.text}
              </motion.i>
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
