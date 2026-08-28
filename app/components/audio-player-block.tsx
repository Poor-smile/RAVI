"use client";

import "./audio-transcription.css";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pause,
  PlayArrow,
  SpeechToText,
} from "@/app/icons/material-symbols";
import type {
  AudioDescriptor,
  AudioSourceResolution,
} from "../audio/types";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "۰:۰۰";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")
    .replace(/\d/gu, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  return `${minutes.toLocaleString("fa-IR")}:${remainder}`;
}

export function AudioPlayerBlock({
  descriptor,
  resolveSource,
  onTranscribe,
}: {
  descriptor: AudioDescriptor;
  resolveSource: (
    source: string,
  ) => AudioSourceResolution | Promise<AudioSourceResolution>;
  onTranscribe: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAtRef = useRef<number | null>(null);
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("در حال آماده‌سازی پخش…");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve(resolveSource(descriptor.source)).then((resolved) => {
      if (!active) return;
      if (resolved.status === "blocked") {
        setMessage(resolved.message);
        return;
      }
      setSource(resolved.source);
    });
    return () => {
      active = false;
    };
  }, [descriptor.source, resolveSource]);

  const sync = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaying(!audio.paused);
    setCurrentTime(audio.currentTime);
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    if (stopAtRef.current !== null && audio.currentTime >= stopAtRef.current) {
      stopAtRef.current = null;
      audio.pause();
    }
  }, []);

  useEffect(() => {
    const playSegment = (event: Event) => {
      const detail = (event as CustomEvent<{
        source?: string;
        startMs?: number;
        endMs?: number;
      }>).detail;
      const audio = audioRef.current;
      if (!audio || detail?.source !== descriptor.source) return;
      audio.currentTime = Math.max(0, Number(detail.startMs ?? 0) / 1000);
      const end = Number(detail.endMs ?? 0) / 1000;
      stopAtRef.current = end > audio.currentTime ? end : null;
      void audio.play();
    };
    window.addEventListener("raavi:play-audio-segment", playSegment);
    return () =>
      window.removeEventListener("raavi:play-audio-segment", playSegment);
  }, [descriptor.source]);

  return (
    <figure
      className={`audio-player-block ${source ? "is-ready" : "is-loading"}`}
      data-audio-source={descriptor.source}
      aria-label={`فایل صوتی ${descriptor.fileName}`}
    >
      <figcaption className="audio-player-heading">
        <small>{message}</small>
        <strong dir="auto">{descriptor.fileName}</strong>
      </figcaption>
      <div className="audio-player-controls">
        <button
          className="audio-transcribe-action"
          type="button"
          onClick={onTranscribe}
        >
          <SpeechToText size={18} aria-hidden="true" />
          تبدیل به متن
        </button>
        <div className="audio-player-timeline">
          <input
            type="range"
            dir="ltr"
            min={0}
            max={1000}
            value={duration ? Math.round((currentTime / duration) * 1000) : 0}
            onInput={(event) => {
              const audio = audioRef.current;
              if (!audio || !duration) return;
              const nextTime = (Number(event.currentTarget.value) / 1000) * duration;
              stopAtRef.current = null;
              audio.currentTime = nextTime;
              setCurrentTime(nextTime);
            }}
            aria-label="موقعیت پخش صوت"
          />
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        <button
          className="audio-play-action"
          type="button"
          onClick={() => {
            const audio = audioRef.current;
            if (!audio || !source) return;
            if (audio.paused) void audio.play();
            else audio.pause();
          }}
          aria-label={playing ? "توقف موقت صوت" : "پخش صوت"}
          disabled={!source}
        >
          {playing ? (
            <Pause size={24} aria-hidden="true" />
          ) : (
            <PlayArrow size={24} aria-hidden="true" />
          )}
        </button>
        <audio
          ref={audioRef}
          src={source || undefined}
          preload="metadata"
          onLoadedMetadata={() => {
            setMessage("آمادهٔ پخش");
            sync();
          }}
          onDurationChange={sync}
          onTimeUpdate={sync}
          onPlay={sync}
          onPause={sync}
          onEnded={sync}
          onError={() => setMessage("فایل صوتی در دسترس نیست")}
        >
          پخش صوت در این مرورگر پشتیبانی نمی‌شود.
        </audio>
      </div>
    </figure>
  );
}
