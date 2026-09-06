"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReadingNarrationSpeed } from "../settings/reading-preferences";
import type { TtsEngineId, TtsNarrationSegment, TtsSynthesisResult } from "./types";
import {
  collectReadableBlocks,
  rangeFromElementOffsets,
  type ReadableBlock,
  type ReadableSentence,
} from "./reading-text";

export type NarrationStatus =
  | "idle"
  | "directing"
  | "buffering"
  | "ready"
  | "preparing"
  | "playing"
  | "paused"
  | "error";
export type NarrationRect = { left: number; top: number; width: number; height: number };
export type NarrationPreparation = {
  message: string;
  progress: number | null;
  mode: "local" | "smart";
};

type Options = {
  active: boolean;
  documentKey: string;
  articleRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  speed: ReadingNarrationSpeed;
  smartNarration: boolean;
  onSpeedChange: (speed: ReadingNarrationSpeed) => void;
  onNeedsEngine: () => void;
  onNotice: (message: string) => void;
};

type Position = { block: number; sentence: number };

const SPEEDS: readonly ReadingNarrationSpeed[] = [0.75, 1, 1.25, 1.5, 2];

function prefetchCount(engine: TtsEngineId | null) {
  return engine === "ava" || engine === "gooya" || engine === "f5ipa" ? 5 : 3;
}

function sentencePause(text: string) {
  if (/[.!؟!]\s*$/u.test(text)) return 360;
  if (/[؛;:]\s*$/u.test(text)) return 240;
  if (/[،,]\s*$/u.test(text)) return 140;
  return 180;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("input,textarea,select,[contenteditable='true'],[role='dialog'],[role='menu'],[role='listbox']"),
  );
}

function positionsAfter(
  blocks: readonly ReadableBlock[],
  blockIndex: number,
  sentenceIndex: number,
  count: number,
  includeCurrent = false,
) {
  const positions: Position[] = [];
  let block = blockIndex;
  let sentence = includeCurrent ? sentenceIndex : sentenceIndex + 1;
  while (positions.length < count && block < blocks.length) {
    if (sentence < blocks[block].sentences.length) {
      positions.push({ block, sentence });
      sentence += 1;
    } else {
      block += 1;
      sentence = 0;
    }
  }
  return positions;
}

function smartSentence(
  source: ReadableSentence,
  prepared: TtsNarrationSegment | undefined,
): ReadableSentence {
  if (!prepared || prepared.sourceText !== source.text) return source;
  return {
    ...source,
    sourceText: source.text,
    text: prepared.spokenText,
    pauseAfterMs: prepared.pauseAfterMs,
  };
}

function narrationErrorMessage(error: unknown) {
  const value = error instanceof Error ? error.message : "";
  if (/TTS_AUDIO_INCOMPLETE/u.test(value)) {
    return "این بخش کامل ساخته نشد. راوی آن را کوچک‌تر می‌کند؛ دوباره تلاش کنید.";
  }
  return "ساخت صدای این بخش کامل نشد؛ دوباره تلاش کنید.";
}

export function useReadingNarration({
  active,
  documentKey,
  articleRef,
  scrollRef,
  speed,
  smartNarration,
  onSpeedChange,
  onNeedsEngine,
  onNotice,
}: Options) {
  const [status, setStatus] = useState<NarrationStatus>("idle");
  const [engineLabel, setEngineLabel] = useState("");
  const [position, setPosition] = useState<Position>({ block: 0, sentence: 0 });
  const [blockCount, setBlockCount] = useState(0);
  const [highlightRects, setHighlightRects] = useState<NarrationRect[]>([]);
  const [preparation, setPreparation] = useState<NarrationPreparation | null>(null);
  const blocksRef = useRef<ReadableBlock[]>([]);
  const positionRef = useRef(position);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const generatedSpeedRef = useRef<ReadingNarrationSpeed>(speed);
  const engineRef = useRef<TtsEngineId | null>(null);
  const activeBlockRef = useRef<HTMLElement | null>(null);
  const prefetchedAudioRef = useRef(new Map<string, Promise<TtsSynthesisResult>>());

  useEffect(() => { positionRef.current = position; }, [position]);

  const clearHighlight = useCallback(() => {
    activeBlockRef.current?.classList.remove("is-reading-aloud");
    activeBlockRef.current = null;
    setHighlightRects([]);
  }, []);

  const updateHighlight = useCallback((blockIndex: number, sentenceIndex: number) => {
    const block = blocksRef.current[blockIndex];
    const sentence = block?.sentences[sentenceIndex];
    const scroll = scrollRef.current;
    if (!block || !sentence || !scroll) return;
    activeBlockRef.current?.classList.remove("is-reading-aloud");
    activeBlockRef.current = block.element;
    block.element.classList.add("is-reading-aloud");
    const range = rangeFromElementOffsets(block.element, sentence.start, sentence.end);
    const scrollRect = scroll.getBoundingClientRect();
    setHighlightRects(
      range
        ? Array.from(range.getClientRects())
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => ({
              left: rect.left - scrollRect.left + scroll.scrollLeft,
              top: rect.top - scrollRect.top + scroll.scrollTop,
              width: rect.width,
              height: rect.height,
            }))
        : [],
    );
    const rect = block.element.getBoundingClientRect();
    const safeTop = 124;
    const safeBottom = window.innerHeight - 112;
    if (rect.top < safeTop || rect.bottom > safeBottom) {
      block.element.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
    }
  }, [scrollRef]);

  const stop = useCallback((notifyDesktop = true) => {
    requestRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;
    prefetchedAudioRef.current.clear();
    if (notifyDesktop) void window.raaviDesktop?.cancelTts?.();
    blocksRef.current = [];
    setBlockCount(0);
    setStatus("idle");
    setPreparation(null);
    engineRef.current = null;
    setEngineLabel("");
    setPosition({ block: 0, sentence: 0 });
    clearHighlight();
  }, [clearHighlight]);

  const getSynthesis = useCallback((blockIndex: number, sentenceIndex: number) => {
    const desktop = window.raaviDesktop;
    const engine = engineRef.current;
    const sentence = blocksRef.current[blockIndex]?.sentences[sentenceIndex];
    if (!desktop?.synthesizeTts || !engine || !sentence) return null;
    const pauseAfterMs = sentence.pauseAfterMs ?? sentencePause(sentence.text);
    const key = `${engine}:${speed}:${blockIndex}:${sentenceIndex}:${pauseAfterMs}:${sentence.text}`;
    let pendingAudio = prefetchedAudioRef.current.get(key);
    if (!pendingAudio) {
      pendingAudio = desktop.synthesizeTts({
        engine,
        text: sentence.text,
        speed,
        pauseAfterMs,
      });
      prefetchedAudioRef.current.set(key, pendingAudio);
      void pendingAudio.catch(() => {
        if (prefetchedAudioRef.current.get(key) === pendingAudio) {
          prefetchedAudioRef.current.delete(key);
        }
      });
    }
    return { key, promise: pendingAudio };
  }, [speed]);

  const playAtRef = useRef<(block: number, sentence: number) => Promise<void>>(async () => {});
  const playAt = useCallback(async (blockIndex: number, sentenceIndex: number) => {
    const block = blocksRef.current[blockIndex];
    const sentence = block?.sentences[sentenceIndex];
    if (!block || !sentence || !engineRef.current) {
      stop(false);
      return;
    }
    const request = ++requestRef.current;
    audioRef.current?.pause();
    setPosition({ block: blockIndex, sentence: sentenceIndex });
    updateHighlight(blockIndex, sentenceIndex);
    setStatus("preparing");
    const synthesis = getSynthesis(blockIndex, sentenceIndex);
    if (!synthesis) {
      stop(false);
      return;
    }
    try {
      const result = await synthesis.promise;
      prefetchedAudioRef.current.delete(synthesis.key);
      if (request !== requestRef.current) return;
      const audio = new Audio(result.source);
      audioRef.current = audio;
      const resultNativeSpeed = result.nativeSpeed as ReadingNarrationSpeed | undefined;
      generatedSpeedRef.current = resultNativeSpeed && SPEEDS.includes(resultNativeSpeed)
        ? resultNativeSpeed
        : speed;
      audio.playbackRate = speed / generatedSpeedRef.current;
      audio.addEventListener("ended", () => {
        if (request !== requestRef.current) return;
        const nextSentence = sentenceIndex + 1;
        if (nextSentence < block.sentences.length) {
          void playAtRef.current(blockIndex, nextSentence);
        } else if (blockIndex + 1 < blocksRef.current.length) {
          void playAtRef.current(blockIndex + 1, 0);
        } else {
          stop(false);
          onNotice("خواندن سند به پایان رسید.");
        }
      }, { once: true });
      audio.addEventListener("error", () => {
        if (request !== requestRef.current) return;
        setStatus("error");
        onNotice("پخش صدای ساخته‌شده ممکن نشد؛ موتور را دوباره امتحان کنید.");
      }, { once: true });
      await audio.play();
      if (request !== requestRef.current) return;
      setStatus("playing");
      setPreparation(null);
      const upcoming = positionsAfter(
        blocksRef.current,
        blockIndex,
        sentenceIndex,
        prefetchCount(engineRef.current),
      );
      let chain = Promise.resolve();
      for (const candidate of upcoming) {
        chain = chain.then(async () => {
          if (request !== requestRef.current) return;
          await getSynthesis(candidate.block, candidate.sentence)?.promise;
        });
      }
      void chain.catch(() => {});
    } catch (error) {
      prefetchedAudioRef.current.delete(synthesis.key);
      if (request !== requestRef.current) return;
      setStatus("error");
      onNotice(narrationErrorMessage(error));
    }
  }, [getSynthesis, onNotice, speed, stop, updateHighlight]);
  useEffect(() => { playAtRef.current = playAt; }, [playAt]);

  const start = useCallback(async () => {
    if (status === "paused") {
      await audioRef.current?.play();
      setStatus("playing");
      return;
    }
    if (status === "ready") {
      void playAtRef.current(positionRef.current.block, positionRef.current.sentence);
      return;
    }
    if (["directing", "buffering", "preparing", "playing"].includes(status)) return;
    const article = articleRef.current;
    const desktop = window.raaviDesktop;
    if (!active || !article || !desktop?.getTtsModelState) {
      onNotice("شنیدن محلی در نسخهٔ دسکتاپ راوی در دسترس است.");
      return;
    }
    const state = await desktop.getTtsModelState();
    const selected = state.engines.find((item) => item.id === state.activeEngine && item.installed);
    if (!state.supported || !selected) {
      onNeedsEngine();
      return;
    }
    const localBlocks = collectReadableBlocks(article);
    if (!localBlocks.length) {
      onNotice("در این سند متن قابل خواندنی پیدا نشد.");
      return;
    }

    const preparationRequest = ++requestRef.current;
    engineRef.current = selected.id;
    setEngineLabel(selected.label);
    setBlockCount(localBlocks.length);
    setPosition({ block: 0, sentence: 0 });
    prefetchedAudioRef.current.clear();
    let preparedBlocks = localBlocks;
    let preparationMode: NarrationPreparation["mode"] = "local";

    if (smartNarration && desktop.prepareTtsNarration) {
      setStatus("directing");
      setPreparation({
        mode: "smart",
        progress: null,
        message: "کارگردان فارسی در حال تنظیم تلفظ و مکث‌هاست…",
      });
      try {
        const aiPreferences = await desktop.getAiPreferences?.();
        const inputs = localBlocks.flatMap((block, blockIndex) => (
          block.sentences.map((sentence, sentenceIndex) => ({
            id: `${blockIndex}:${sentenceIndex}`,
            sourceText: sentence.text,
          }))
        ));
        const result = await desktop.prepareTtsNarration({
          model: aiPreferences?.model,
          segments: inputs,
        });
        if (preparationRequest !== requestRef.current) return;
        const directed = new Map(result.segments.map((segment) => [segment.id, segment]));
        preparedBlocks = localBlocks.map((block, blockIndex) => ({
          ...block,
          sentences: block.sentences.map((sentence, sentenceIndex) => (
            smartSentence(sentence, directed.get(`${blockIndex}:${sentenceIndex}`))
          )),
        }));
        preparationMode = "smart";
      } catch {
        if (preparationRequest !== requestRef.current) return;
        preparationMode = "local";
        onNotice("آماده‌سازی هوشمند در دسترس نبود؛ نسخهٔ محلی و کامل آماده می‌شود.");
      }
    }

    blocksRef.current = preparedBlocks;
    setStatus("buffering");
    const initial = positionsAfter(
      preparedBlocks,
      0,
      0,
      prefetchCount(selected.id),
      true,
    );
    try {
      for (let index = 0; index < initial.length; index += 1) {
        if (preparationRequest !== requestRef.current) return;
        setPreparation({
          mode: preparationMode,
          progress: index / Math.max(1, initial.length),
          message: `در حال ساخت بخش‌های ابتدایی؛ ${index.toLocaleString("fa-IR")} از ${initial.length.toLocaleString("fa-IR")}`,
        });
        const candidate = initial[index];
        const synthesis = getSynthesis(candidate.block, candidate.sentence);
        if (!synthesis) throw new Error("TTS_UNAVAILABLE");
        await synthesis.promise;
      }
      if (preparationRequest !== requestRef.current) return;
      updateHighlight(0, 0);
      setPreparation({
        mode: preparationMode,
        progress: 1,
        message: preparationMode === "smart"
          ? "خوانش هوشمند آماده است؛ پخش را بزنید."
          : "خوانش محلی آماده است؛ پخش را بزنید.",
      });
      setStatus("ready");
    } catch (error) {
      if (preparationRequest !== requestRef.current) return;
      setStatus("error");
      onNotice(narrationErrorMessage(error));
    }
  }, [active, articleRef, getSynthesis, onNeedsEngine, onNotice, smartNarration, status, updateHighlight]);

  const pauseOrResume = useCallback(() => {
    if (status === "ready") {
      void playAtRef.current(positionRef.current.block, positionRef.current.sentence);
    } else if (status === "playing") {
      audioRef.current?.pause();
      setStatus("paused");
    } else if (status === "paused") {
      void audioRef.current?.play().then(() => setStatus("playing"));
    }
  }, [status]);

  const skipBlock = useCallback(async (delta: -1 | 1) => {
    if (status === "idle" || status === "directing" || status === "buffering") return;
    const next = Math.max(0, Math.min(blocksRef.current.length - 1, positionRef.current.block + delta));
    if (next === positionRef.current.block && positionRef.current.sentence === 0) return;
    requestRef.current += 1;
    audioRef.current?.pause();
    prefetchedAudioRef.current.clear();
    await window.raaviDesktop?.cancelTts?.();
    void playAtRef.current(next, 0);
  }, [status]);

  const changeSpeed = useCallback((next: ReadingNarrationSpeed) => {
    if (!SPEEDS.includes(next)) return;
    onSpeedChange(next);
    prefetchedAudioRef.current.clear();
    const audio = audioRef.current;
    if (audio) audio.playbackRate = next / generatedSpeedRef.current;
  }, [onSpeedChange]);

  useEffect(() => () => stop(), [active, documentKey, stop]);

  useEffect(() => {
    if (status === "idle") return;
    const handleKey = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        void skipBlock(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        void skipBlock(1);
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [skipBlock, status]);

  useEffect(() => {
    if (status === "idle") return;
    const refresh = () => updateHighlight(positionRef.current.block, positionRef.current.sentence);
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  }, [status, updateHighlight]);

  return {
    status,
    engineLabel,
    position,
    blockCount,
    highlightRects,
    preparation,
    start,
    stop: () => stop(),
    pauseOrResume,
    previousBlock: () => void skipBlock(-1),
    nextBlock: () => void skipBlock(1),
    speed,
    changeSpeed,
  };
}
