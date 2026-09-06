"""Persistent local TTS worker used by Raavi's Electron main process.

The protocol is deliberately tiny: one JSON object per stdin line and one
JSON result per stdout line. Model/runtime logs are redirected to stderr so
they can never corrupt the protocol stream.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import shutil
import sys
import tempfile
import unicodedata
import wave
from collections import OrderedDict
from pathlib import Path


def ascii_tokenizer_view(source: Path, name: str, files: tuple[str, ...]) -> Path:
    """Mirror small tokenizer assets to an ASCII-only path on Windows.

    Some native SentencePiece Windows builds cannot open an otherwise valid model
    file when one of its parent directories contains Persian characters.  Python
    and PyTorch handle those paths correctly, so only the tiny tokenizer assets
    need this compatibility view.
    """
    if os.name != "nt" or str(source).isascii():
        return source
    target = Path(tempfile.gettempdir()) / "raavi-tts-tokenizers" / name
    target.mkdir(parents=True, exist_ok=True)
    for relative in files:
        source_file = source / relative
        if source_file.exists():
            target_file = target / relative
            target_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_file, target_file)
    return target


def load_engine(engine: str, model_root: Path, cache_root: Path):
    if engine == "mana":
        with contextlib.redirect_stdout(sys.stderr):
            from piper import PiperVoice, SynthesisConfig

            voice = PiperVoice.load(
                str(model_root / "fa_IR-mana-medium.onnx"),
                config_path=str(model_root / "fa_IR-mana-medium.onnx.json"),
                use_cuda=False,
            )

        def synthesize(text: str, output: Path, speed: float) -> None:
            config = SynthesisConfig(length_scale=1.0 / max(0.5, min(2.0, speed)))
            with wave.open(str(output), "wb") as wav_file:
                with contextlib.redirect_stdout(sys.stderr):
                    voice.synthesize_wav(text, wav_file, syn_config=config)

        return synthesize

    if engine == "ava":
        with contextlib.redirect_stdout(sys.stderr):
            from ava_tts import Ava

            voice = Ava(local_dir=str(model_root), cache_dir=str(cache_root))

        def synthesize(text: str, output: Path, speed: float) -> None:
            with contextlib.redirect_stdout(sys.stderr):
                voice.save(text=text, output=str(output), speed=max(0.5, min(2.0, speed)))

        return synthesize

    if engine == "mms":
        with contextlib.redirect_stdout(sys.stderr):
            import soundfile as sf
            import torch
            from transformers import AutoTokenizer, VitsModel

            tokenizer = AutoTokenizer.from_pretrained(
                str(model_root),
                local_files_only=True,
            )
            voice = VitsModel.from_pretrained(
                str(model_root),
                local_files_only=True,
            ).eval()
            sample_rate = int(voice.config.sampling_rate)

        def synthesize(text: str, output: Path, speed: float) -> None:
            speaking_rate = max(0.5, min(2.0, speed))
            with contextlib.redirect_stdout(sys.stderr), torch.inference_mode():
                inputs = tokenizer(text, return_tensors="pt")
                voice.speaking_rate = speaking_rate
                waveform = voice(**inputs).waveform.squeeze().cpu().numpy()
            sf.write(output, waveform, sample_rate, subtype="PCM_16")

        return synthesize

    if engine == "gooya":
        with contextlib.redirect_stdout(sys.stderr):
            import soundfile as sf
            import torch
            from transformers import AutoModel, AutoModelForCausalLM, AutoModelForSeq2SeqLM, AutoTokenizer

            gooya_root = model_root / "gooya"
            g2p_root = model_root / "g2p"
            codec_root = model_root / "codec"
            reference_path = model_root / "reference.wav"
            required = (gooya_root, g2p_root, codec_root, reference_path)
            if not all(value.exists() for value in required):
                raise FileNotFoundError("Gooya package is incomplete")

            gooya_tokenizer_root = ascii_tokenizer_view(
                gooya_root,
                "gooya",
                (
                    "__init__.py",
                    "config.json",
                    "configuration_moss_tts_nano.py",
                    "special_tokens_map.json",
                    "tokenization_moss_tts_nano.py",
                    "tokenizer_config.json",
                    "tokenizer.model",
                ),
            )

            g2p_tokenizer = AutoTokenizer.from_pretrained(str(g2p_root), local_files_only=True)
            g2p_model = AutoModelForSeq2SeqLM.from_pretrained(
                str(g2p_root), local_files_only=True
            ).eval()
            overlay_data = json.loads((g2p_root / "overlay.json").read_text(encoding="utf-8"))
            overlay = {
                (row["surface"], row["raw"]): row["target"]
                for row in overlay_data.get("rules", [])
            }
            text_tokenizer = AutoTokenizer.from_pretrained(
                str(gooya_tokenizer_root), trust_remote_code=True, local_files_only=True
            )
            voice = AutoModelForCausalLM.from_pretrained(
                str(gooya_root), trust_remote_code=True, local_files_only=True
            ).to(device="cpu", dtype=torch.float32).eval()
            codec = AutoModel.from_pretrained(
                str(codec_root), trust_remote_code=True, local_files_only=True
            ).to("cpu").eval()
            if hasattr(codec, "set_attention_implementation"):
                codec.set_attention_implementation("sdpa")
            if hasattr(codec, "set_compute_dtype"):
                codec.set_compute_dtype("fp32")

        def surface_words(value: str) -> list[str]:
            words: list[str] = []
            cursor = 0
            while cursor < len(value):
                if value[cursor].isspace():
                    cursor += 1
                    continue
                is_word = value[cursor] == "\u200c" or unicodedata.category(value[cursor])[0] in {"L", "M", "N"}
                if not is_word:
                    cursor += 1
                    continue
                start = cursor
                cursor += 1
                while cursor < len(value) and (
                    value[cursor] == "\u200c" or unicodedata.category(value[cursor])[0] in {"L", "M", "N"}
                ):
                    cursor += 1
                words.append(value[start:cursor])
            return words

        def phonemize(value: str) -> str:
            normalized = value.translate(str.maketrans({"ي": "ی", "ى": "ی", "ك": "ک"})).strip()
            encoded = g2p_tokenizer(normalized, return_tensors="pt", add_special_tokens=False)
            with torch.inference_mode():
                ids = g2p_model.generate(
                    **encoded,
                    max_new_tokens=512,
                    num_beams=5,
                    early_stopping=True,
                )
            raw = g2p_tokenizer.batch_decode(ids, skip_special_tokens=True)[0].strip()
            phones = raw.split()
            surfaces = surface_words(normalized)
            if len(phones) == len(surfaces):
                phones = [
                    overlay.get((surface, phone), phone)
                    for surface, phone in zip(surfaces, phones, strict=True)
                ]
            return " ".join(phones) or normalized

        def synthesize(text: str, output: Path, speed: float) -> None:
            del speed  # Gooya speed is applied by Chromium to preserve pitch.
            phones = phonemize(text)
            seed = int.from_bytes(hashlib.sha256(phones.encode("utf-8")).digest()[:4], "big")
            torch.manual_seed(seed)
            word_count = max(1, len(phones.split()))
            max_new_frames = max(180, min(420, 72 + word_count * 22))
            with contextlib.redirect_stdout(sys.stderr), torch.inference_mode():
                result = voice.inference(
                    text=phones,
                    output_audio_path=str(output),
                    mode="voice_clone",
                    prompt_audio_path=str(reference_path),
                    text_tokenizer=text_tokenizer,
                    audio_tokenizer=codec,
                    device=torch.device("cpu"),
                    max_new_frames=max_new_frames,
                    do_sample=True,
                    text_temperature=1.0,
                    text_top_p=1.0,
                    text_top_k=50,
                    audio_temperature=0.6,
                    audio_top_p=0.9,
                    audio_top_k=25,
                    audio_repetition_penalty=1.15,
                    voice_clone_max_text_tokens=45,
                    tts_max_batch_size=1,
                    codec_max_batch_size=1,
                )
                waveform = result["waveform"].detach().cpu().float().numpy()
                if waveform.ndim == 2:
                    waveform = waveform.transpose(1, 0)
                sf.write(
                    str(output),
                    waveform,
                    int(result["sample_rate"]),
                    subtype="PCM_16",
                )

        return synthesize

    if engine == "f5ipa":
        with contextlib.redirect_stdout(sys.stderr):
            import soundfile as sf
            import torch
            from f5_tts.api import F5TTS
            from f5_tts.infer import utils_infer as f5_infer
            from transformers import AutoTokenizer, T5Config, T5ForConditionalGeneration

            speech_root = model_root / "speech"
            g2p_root = model_root / "g2p"
            vocos_root = model_root / "vocos"
            reference_path = model_root / "reference.wav"
            required = (
                speech_root / "model.safetensors",
                speech_root / "vocab.txt",
                g2p_root / "model.safetensors",
                vocos_root / "pytorch_model.bin",
                reference_path,
            )
            if not all(value.exists() for value in required):
                raise FileNotFoundError("Persian IPA F5 package is incomplete")

            g2p_tokenizer = AutoTokenizer.from_pretrained(
                str(g2p_root),
                extra_special_tokens={},
                local_files_only=True,
            )
            # The published checkpoint intentionally contains different shared
            # embedding and LM-head tensors while its config still says to tie
            # them. Transformers 4 follows that stale flag and produces EOS only;
            # preserving the published output head restores the expected IPA.
            g2p_config = T5Config.from_pretrained(str(g2p_root), local_files_only=True)
            g2p_config.tie_word_embeddings = False
            g2p_model = T5ForConditionalGeneration.from_pretrained(
                str(g2p_root),
                config=g2p_config,
                local_files_only=True,
            ).to("cpu").eval()

            # This checkpoint was trained on raw Unicode IPA. Upstream F5-TTS
            # otherwise applies its Chinese pinyin converter to every string.
            f5_infer.convert_char_to_pinyin = lambda values: values
            voice = F5TTS(
                model="F5TTS_v1_Base",
                ckpt_file=str(speech_root / "model.safetensors"),
                vocab_file=str(speech_root / "vocab.txt"),
                vocoder_local_path=str(vocos_root),
                device="cpu",
                hf_cache_dir=str(cache_root),
            )
            reference_audio, reference_ipa = f5_infer.preprocess_ref_audio_text(
                str(reference_path),
                "ɡole: ɾoz, vɒːɣeʔæn ziːbɒːst.",
                show_info=lambda *_args, **_kwargs: None,
            )

        ipa_cache: OrderedDict[str, str] = OrderedDict()

        def phonemize_f5(value: str) -> str:
            normalized = unicodedata.normalize(
                "NFC",
                value.translate(str.maketrans({"ي": "ی", "ى": "ی", "ك": "ک"})).strip(),
            )
            cached = ipa_cache.get(normalized)
            if cached is not None:
                ipa_cache.move_to_end(normalized)
                return cached
            encoded = g2p_tokenizer(normalized, return_tensors="pt")
            with torch.inference_mode():
                output_ids = g2p_model.generate(**encoded, max_new_tokens=512)
            ipa = g2p_tokenizer.decode(output_ids[0], skip_special_tokens=True)
            ipa = unicodedata.normalize("NFC", " ".join(ipa.split()))
            if not ipa:
                raise ValueError("Persian text could not be converted to IPA")
            ipa_cache[normalized] = ipa
            if len(ipa_cache) > 512:
                ipa_cache.popitem(last=False)
            return ipa

        def synthesize(text: str, output: Path, speed: float) -> None:
            del speed  # Playback rate is applied by Chromium so cached audio is reusable.
            ipa = phonemize_f5(text)
            seed = int.from_bytes(hashlib.sha256(ipa.encode("utf-8")).digest()[:8], "big")
            torch.manual_seed(seed)
            with contextlib.redirect_stdout(sys.stderr), torch.inference_mode():
                waveform, sample_rate, _spectrogram = f5_infer.infer_process(
                    reference_audio,
                    reference_ipa,
                    ipa,
                    voice.ema_model,
                    voice.vocoder,
                    voice.mel_spec_type,
                    show_info=lambda *_args, **_kwargs: None,
                    progress=None,
                    nfe_step=24,
                    speed=1.0,
                    device="cpu",
                )
            if waveform is None:
                raise RuntimeError("Persian IPA F5 did not generate audio")
            sf.write(str(output), waveform, int(sample_rate), subtype="PCM_16")

        return synthesize

    raise ValueError(f"Unknown engine: {engine}")


def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def wav_metadata(file_path: Path) -> dict:
    with wave.open(str(file_path), "rb") as wav_file:
        frames = int(wav_file.getnframes())
        sample_rate = int(wav_file.getframerate())
        channels = int(wav_file.getnchannels())
        sample_width = int(wav_file.getsampwidth())
    duration_ms = round((frames / max(1, sample_rate)) * 1000)
    return {
        "frames": frames,
        "sampleRate": sample_rate,
        "channels": channels,
        "sampleWidth": sample_width,
        "durationMs": duration_ms,
    }


def concat_wavs(
    inputs: list[Path],
    output: Path,
    inter_pause_ms: int = 80,
    final_pause_ms: int = 0,
) -> dict:
    if not inputs:
        raise ValueError("No WAV inputs to concatenate")
    first_metadata = wav_metadata(inputs[0])
    params = (
        first_metadata["channels"],
        first_metadata["sampleWidth"],
        first_metadata["sampleRate"],
    )
    temporary = output.with_name(f"{output.stem}.merge.part{output.suffix}")
    temporary.unlink(missing_ok=True)
    speech_frames = 0
    try:
        with wave.open(str(temporary), "wb") as target:
            target.setnchannels(params[0])
            target.setsampwidth(params[1])
            target.setframerate(params[2])
            for index, input_path in enumerate(inputs):
                with wave.open(str(input_path), "rb") as source:
                    source_params = (
                        source.getnchannels(),
                        source.getsampwidth(),
                        source.getframerate(),
                    )
                    if source_params != params:
                        raise ValueError("WAV parameters do not match")
                    frames = source.readframes(source.getnframes())
                    target.writeframes(frames)
                    speech_frames += len(frames) // max(1, params[0] * params[1])
                if index < len(inputs) - 1 and inter_pause_ms > 0:
                    silence_frames = round(params[2] * inter_pause_ms / 1000)
                    target.writeframes(b"\x00" * silence_frames * params[0] * params[1])
                    speech_frames += silence_frames
            if final_pause_ms > 0:
                silence_frames = round(params[2] * final_pause_ms / 1000)
                target.writeframes(b"\x00" * silence_frames * params[0] * params[1])
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    metadata = wav_metadata(output)
    metadata["speechDurationMs"] = round((speech_frames / max(1, params[2])) * 1000)
    return metadata


def synthesize_atomic(synthesize, text: str, output: Path, speed: float, pause_ms: int) -> dict:
    temporary = output.with_name(f"{output.stem}.speech.part{output.suffix}")
    temporary.unlink(missing_ok=True)
    try:
        synthesize(text, temporary, speed)
        speech_metadata = wav_metadata(temporary)
        if pause_ms > 0:
            metadata = concat_wavs([temporary], output, final_pause_ms=pause_ms)
        else:
            os.replace(temporary, output)
            metadata = wav_metadata(output)
        metadata["speechDurationMs"] = speech_metadata["durationMs"]
        return metadata
    finally:
        temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=("mana", "ava", "mms", "gooya", "f5ipa"), required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--cache-root", type=Path, required=True)
    parser.add_argument("--warmup", action="store_true")
    args = parser.parse_args()

    args.cache_root.mkdir(parents=True, exist_ok=True)
    synthesize = load_engine(args.engine, args.model_root, args.cache_root)
    emit({"type": "ready", "engine": args.engine})

    if args.warmup:
        warmup_path = args.cache_root / "warmup.wav"
        metadata = synthesize_atomic(
            synthesize,
            "راوی آمادهٔ خواندن است.",
            warmup_path,
            1.0,
            0,
        )
        emit({"type": "warmup", "ok": True, **metadata})
        return 0

    for raw_line in sys.stdin:
        try:
            request = json.loads(raw_line)
            request_id = str(request.get("id", ""))
            operation = str(request.get("operation", "synthesize"))
            output = Path(str(request.get("output", "")))
            if not request_id or not output.is_absolute():
                raise ValueError("Invalid synthesis request")
            output.parent.mkdir(parents=True, exist_ok=True)
            if operation == "concat":
                inputs = [Path(str(value)) for value in request.get("inputs", [])]
                if not inputs or not all(value.is_absolute() for value in inputs):
                    raise ValueError("Invalid concatenation request")
                metadata = concat_wavs(
                    inputs,
                    output,
                    inter_pause_ms=max(0, min(500, int(request.get("interPauseMs", 80)))),
                    final_pause_ms=max(0, min(900, int(request.get("pauseMs", 0)))),
                )
            else:
                text = str(request.get("text", "")).strip()
                speed = float(request.get("speed", 1.0))
                pause_ms = max(0, min(900, int(request.get("pauseMs", 0))))
                if not text:
                    raise ValueError("Invalid synthesis text")
                metadata = synthesize_atomic(synthesize, text, output, speed, pause_ms)
            emit({"type": "result", "id": request_id, "ok": True, **metadata})
        except Exception as error:  # Keep the worker alive for later requests.
            emit(
                {
                    "type": "result",
                    "id": str(locals().get("request_id", "")),
                    "ok": False,
                    "error": str(error),
                }
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
