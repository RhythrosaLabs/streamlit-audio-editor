import { useState, useRef, useEffect, useCallback } from "react";
import { Streamlit } from "streamlit-component-lib";

// ─── constants ────────────────────────────────────────────────────────────────
const ACCENT = "#00e5a0";
const ACCENT2 = "#7c6cfa";
const BG = "#0d0d12";
const SURFACE = "#13131c";
const SURFACE2 = "#1a1a28";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#e2e8f0";
const MUTED = "#475569";

// ─── utils ────────────────────────────────────────────────────────────────────
function fmtTime(s) {
  if (!isFinite(s)) return "0:00.000";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(3).padStart(6, "0")}`;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── Waveform canvas ──────────────────────────────────────────────────────────
function WaveformCanvas({ audioBuffer, zoom, scrollLeft, trimStart, trimEnd, playhead,
  duration, onSeek, onTrimChange, width }) {
  const canvasRef = useRef(null);
  const dragging = useRef(null); // "trimStart" | "trimEnd" | "seek"

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = SURFACE2;
    ctx.fillRect(0, 0, W, H);

    if (!audioBuffer) {
      // Empty state prompt
      ctx.fillStyle = MUTED;
      ctx.font = "12px 'Space Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("load audio to begin", W / 2, H / 2);
      return;
    }

    const totalPx = W * zoom;
    const pxPerSec = totalPx / duration;
    const startSec = scrollLeft / pxPerSec;

    // Muted zones (outside trim)
    const trimStartPx = trimStart * pxPerSec - scrollLeft;
    const trimEndPx = trimEnd * pxPerSec - scrollLeft;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    if (trimStartPx > 0) ctx.fillRect(0, 0, trimStartPx, H);
    if (trimEndPx < W) ctx.fillRect(trimEndPx, 0, W - trimEndPx, H);

    // Waveform
    const data = audioBuffer.getChannelData(0);
    const samples = data.length;
    const visibleSec = W / pxPerSec;
    const startSample = Math.floor((startSec / duration) * samples);
    const endSample = Math.ceil(((startSec + visibleSec) / duration) * samples);
    const step = Math.max(1, Math.floor((endSample - startSample) / W));

    ctx.beginPath();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    const mid = H / 2;
    for (let x = 0; x < W; x++) {
      const si = startSample + Math.floor((x / W) * (endSample - startSample));
      let min = 0, max = 0;
      for (let j = 0; j < step && si + j < samples; j++) {
        const v = data[si + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      // dim outside trim
      const sec = startSec + (x / pxPerSec);
      const inTrim = sec >= trimStart && sec <= trimEnd;
      ctx.strokeStyle = inTrim ? ACCENT : "rgba(0,229,160,0.25)";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, mid + min * mid * 0.92);
      ctx.lineTo(x + 0.5, mid + max * mid * 0.92);
      ctx.stroke();
    }

    // Trim handles
    const handleW = 3;
    [{ sec: trimStart, color: ACCENT }, { sec: trimEnd, color: "#f59e0b" }].forEach(({ sec, color }) => {
      const px = sec * pxPerSec - scrollLeft;
      if (px < -10 || px > W + 10) return;
      ctx.fillStyle = color;
      ctx.fillRect(px - handleW / 2, 0, handleW, H);
      // top tab
      ctx.beginPath();
      ctx.roundRect(px - 8, 0, 16, 18, 3);
      ctx.fill();
    });

    // Playhead
    if (playhead !== null && isFinite(playhead)) {
      const px = playhead * pxPerSec - scrollLeft;
      if (px >= 0 && px <= W) {
        ctx.fillStyle = "white";
        ctx.fillRect(px - 1, 0, 2, H);
        // playhead head
        ctx.beginPath();
        ctx.moveTo(px - 6, 0);
        ctx.lineTo(px + 6, 0);
        ctx.lineTo(px, 10);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Time ruler
    ctx.fillStyle = SURFACE;
    ctx.fillRect(0, 0, W, 20);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 20); ctx.lineTo(W, 20); ctx.stroke();

    const tickInterval = duration / zoom > 30 ? 10 : duration / zoom > 10 ? 5 : duration / zoom > 3 ? 1 : 0.5;
    const firstTick = Math.ceil(startSec / tickInterval) * tickInterval;
    ctx.fillStyle = MUTED;
    ctx.font = "9px 'Space Mono', monospace";
    ctx.textAlign = "center";
    for (let t = firstTick; t <= startSec + W / pxPerSec + tickInterval; t += tickInterval) {
      const px = t * pxPerSec - scrollLeft;
      if (px < 0 || px > W) continue;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.moveTo(px, 20); ctx.lineTo(px, H); ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.fillText(fmtTime(t), px, 14);
    }
  }, [audioBuffer, zoom, scrollLeft, trimStart, trimEnd, playhead, duration, width]);

  // Mouse interaction
  const getPxPerSec = () => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return 1;
    return (canvas.width * zoom) / duration;
  };

  const secFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pxPerSec = getPxPerSec();
    return clamp((x + scrollLeft) / pxPerSec, 0, duration);
  };

  const handleMouseDown = (e) => {
    const sec = secFromEvent(e);
    const pxPerSec = getPxPerSec();
    const dStart = Math.abs(sec - trimStart) * pxPerSec;
    const dEnd = Math.abs(sec - trimEnd) * pxPerSec;
    if (dStart < 10) dragging.current = "trimStart";
    else if (dEnd < 10) dragging.current = "trimEnd";
    else { dragging.current = "seek"; onSeek(sec); }
  };

  const handleMouseMove = (e) => {
    if (!dragging.current) return;
    const sec = secFromEvent(e);
    if (dragging.current === "trimStart") onTrimChange(clamp(sec, 0, trimEnd - 0.05), trimEnd);
    else if (dragging.current === "trimEnd") onTrimChange(trimStart, clamp(sec, trimStart + 0.05, duration));
    else onSeek(sec);
  };

  const handleMouseUp = () => { dragging.current = null; };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={140}
      style={{ display: "block", cursor: "crosshair", borderRadius: 8, width: "100%", height: 140 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AudioEditor() {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioCtx] = useState(() => new (window.AudioContext || window.webkitAudioContext)());
  const [fileName, setFileName] = useState(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [gain, setGain] = useState(1.0);
  const [loop, setLoop] = useState(false);
  const [waveWidth, setWaveWidth] = useState(800);
  const [exportData, setExportData] = useState(null);
  const [exportMsg, setExportMsg] = useState("");

  // Effects state
  const [delayTime, setDelayTime] = useState(0);      // 0 = off, up to 1s
  const [delayFeedback, setDelayFeedback] = useState(0.3);
  const [reverbMix, setReverbMix] = useState(0);       // 0 = dry, 1 = full wet
  const [distortion, setDistortion] = useState(0);      // 0 = off, 1 = max

  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const startTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const rafRef = useRef(null);
  const waveContainerRef = useRef(null);

  // Persistent effect node refs (created once, params updated live)
  const delayNodeRef = useRef(null);
  const delayFbRef = useRef(null);
  const delayWetRef = useRef(null);
  const delayDryRef = useRef(null);
  const waveShaperRef = useRef(null);
  const reverbConvRef = useRef(null);
  const reverbDryRef = useRef(null);
  const reverbWetRef = useRef(null);
  const chainBuiltRef = useRef(false);

  // ── Streamlit lifecycle ──────────────────────────────────────────────────
  const readyRef = useRef(false);

  useEffect(() => {
    const onRender = (event) => {
      const args = event.detail.args || {};
      if (!readyRef.current && args.audio_url) {
        fetch(args.audio_url)
          .then(r => r.arrayBuffer())
          .then(ab => audioCtx.decodeAudioData(ab))
          .then(buf => {
            setAudioBuffer(buf);
            setDuration(buf.duration);
            setTrimStart(0);
            setTrimEnd(buf.duration);
            setFileName(args.audio_url.split("/").pop() || "audio");
          })
          .catch(() => {});
      }
      readyRef.current = true;
      Streamlit.setFrameHeight();
    };
    Streamlit.events.addEventListener(Streamlit.RENDER_EVENT, onRender);
    Streamlit.setComponentReady();
    return () => Streamlit.events.removeEventListener(Streamlit.RENDER_EVENT, onRender);
  }, [audioCtx]);

  useEffect(() => { Streamlit.setFrameHeight(); });

  // Observe container width
  useEffect(() => {
    if (!waveContainerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setWaveWidth(entries[0].contentRect.width || 800);
    });
    ro.observe(waveContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Load audio file
  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(arrayBuffer);
    setAudioBuffer(buf);
    setDuration(buf.duration);
    setTrimStart(0);
    setTrimEnd(buf.duration);
    setPlayhead(0);
    setZoom(1);
    setScrollLeft(0);
    setExportData(null);
    setExportMsg("");
    stopPlayback();
  };

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback((fromSec) => {
    if (!audioBuffer) return;
    stopPlayback();
    if (audioCtx.state === "suspended") audioCtx.resume();

    // Build persistent effects chain once: gain → delay mix → waveshaper → reverb mix → destination
    if (!chainBuiltRef.current) {
      const g = audioCtx.createGain();
      gainNodeRef.current = g;

      // Delay nodes (always connected; delayTime=0 means pass-through)
      const del = audioCtx.createDelay(2.0);
      const fb = audioCtx.createGain();
      const dDry = audioCtx.createGain();
      const dWet = audioCtx.createGain();
      const dMix = audioCtx.createGain();
      delayNodeRef.current = del;
      delayFbRef.current = fb;
      delayDryRef.current = dDry;
      delayWetRef.current = dWet;

      // Waveshaper (linear curve = pass-through)
      const ws = audioCtx.createWaveShaper();
      ws.oversample = "4x";
      waveShaperRef.current = ws;

      // Reverb nodes
      const conv = audioCtx.createConvolver();
      const irLen = audioCtx.sampleRate * 2;
      const ir = audioCtx.createBuffer(2, irLen, audioCtx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let j = 0; j < irLen; j++) {
          d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / irLen, 2.5);
        }
      }
      conv.buffer = ir;
      const rDry = audioCtx.createGain();
      const rWet = audioCtx.createGain();
      const rMix = audioCtx.createGain();
      reverbConvRef.current = conv;
      reverbDryRef.current = rDry;
      reverbWetRef.current = rWet;

      // Wire: gain → delay dry/wet mix → waveshaper → reverb dry/wet mix → destination
      g.connect(dDry); dDry.connect(dMix);
      g.connect(del); del.connect(fb); fb.connect(del); del.connect(dWet); dWet.connect(dMix);
      dMix.connect(ws);
      ws.connect(rDry); rDry.connect(rMix);
      ws.connect(conv); conv.connect(rWet); rWet.connect(rMix);
      rMix.connect(audioCtx.destination);

      chainBuiltRef.current = true;
    }

    // Apply current parameter values to nodes
    gainNodeRef.current.gain.value = gain;
    delayNodeRef.current.delayTime.value = delayTime;
    delayFbRef.current.gain.value = delayFeedback;
    delayDryRef.current.gain.value = 1;
    delayWetRef.current.gain.value = delayTime > 0 ? 0.6 : 0;

    // Distortion curve
    const amount = distortion * 400;
    const n = 44100;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = amount > 0
        ? ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x))
        : x; // linear pass-through
    }
    waveShaperRef.current.curve = curve;

    reverbDryRef.current.gain.value = 1 - reverbMix;
    reverbWetRef.current.gain.value = reverbMix;

    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.loop = loop;
    if (loop) { src.loopStart = trimStart; src.loopEnd = trimEnd; }
    src.connect(gainNodeRef.current);

    const offset = clamp(fromSec, trimStart, trimEnd);
    src.start(0, offset, loop ? undefined : trimEnd - offset);
    sourceRef.current = src;
    startTimeRef.current = audioCtx.currentTime;
    startOffsetRef.current = offset;
    setIsPlaying(true);

    src.onended = () => {
      if (!loop) {
        setIsPlaying(false);
        setPlayhead(trimStart);
        cancelAnimationFrame(rafRef.current);
      }
    };

    const tick = () => {
      const elapsed = audioCtx.currentTime - startTimeRef.current;
      let pos = startOffsetRef.current + elapsed;
      if (loop) pos = trimStart + ((pos - trimStart) % (trimEnd - trimStart));
      pos = clamp(pos, 0, trimEnd);
      setPlayhead(pos);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [audioBuffer, audioCtx, loop, trimStart, trimEnd, stopPlayback, gain, delayTime, delayFeedback, distortion, reverbMix]);

  // ── Live parameter updates (no restart needed) ──────────────────────────
  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = gain;
  }, [gain]);

  useEffect(() => {
    if (delayNodeRef.current) delayNodeRef.current.delayTime.value = delayTime;
    if (delayWetRef.current) delayWetRef.current.gain.value = delayTime > 0 ? 0.6 : 0;
  }, [delayTime]);

  useEffect(() => {
    if (delayFbRef.current) delayFbRef.current.gain.value = delayFeedback;
  }, [delayFeedback]);

  useEffect(() => {
    if (waveShaperRef.current) {
      const amount = distortion * 400;
      const n = 44100;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = amount > 0
          ? ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x))
          : x;
      }
      waveShaperRef.current.curve = curve;
    }
  }, [distortion]);

  useEffect(() => {
    if (reverbDryRef.current) reverbDryRef.current.gain.value = 1 - reverbMix;
    if (reverbWetRef.current) reverbWetRef.current.gain.value = reverbMix;
  }, [reverbMix]);

  const togglePlay = () => {
    if (isPlaying) stopPlayback();
    else startPlayback(playhead < trimStart || playhead >= trimEnd ? trimStart : playhead);
  };

  const handleSeek = (sec) => {
    setPlayhead(sec);
    if (isPlaying) startPlayback(sec);
  };

  const handleTrimChange = (s, e) => {
    setTrimStart(s);
    setTrimEnd(e);
    if (isPlaying) startPlayback(clamp(playhead, s, e));
  };

  // Export trimmed audio
  const handleExport = () => {
    if (!audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(trimStart * sampleRate);
    const endSample = Math.ceil(trimEnd * sampleRate);
    const length = endSample - startSample;
    const out = audioCtx.createBuffer(audioBuffer.numberOfChannels, length, sampleRate);
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      const src = audioBuffer.getChannelData(c).slice(startSample, endSample);
      out.copyToChannel(src, c);
    }
    // Encode to WAV
    const wav = encodeWAV(out);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    setExportData(url);
    setExportMsg(`✓ Trimmed: ${fmtTime(trimStart)} → ${fmtTime(trimEnd)} (${fmtTime(trimEnd - trimStart)})`);

    // Send to Streamlit
    const bytes = new Uint8Array(wav);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    Streamlit.setComponentValue({
      trimStart, trimEnd, duration, gain,
      delayTime, delayFeedback, reverbMix, distortion,
      wavBase64: btoa(binary),
    });
  };

  const handleScroll = (e) => {
    const maxScroll = waveWidth * (zoom - 1);
    setScrollLeft(s => clamp(s + e.deltaX + e.deltaY * 0.5, 0, maxScroll));
  };

  const handleZoom = (delta) => {
    setZoom(z => clamp(z + delta, 1, 20));
  };

  const trimDuration = trimEnd - trimStart;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=range] { -webkit-appearance: none; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.1); outline: none; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${ACCENT}; cursor: grab; }
        input[type=range]::-webkit-slider-thumb:active { cursor: grabbing; }
        ::-webkit-scrollbar { height: 4px; } 
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        label { color: ${MUTED}; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.1em; }
      `}</style>

      <div style={{ minHeight: "100vh", background: BG, padding: "28px 28px 40px", fontFamily: "'Syne', sans-serif" }}>

        {/* Header */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", gap: 16, justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: ACCENT, letterSpacing: "0.2em", marginBottom: 5 }}>AUDIO EDITOR</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>
              {fileName || "No file loaded"}
            </h1>
            {duration > 0 && (
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: MUTED, marginTop: 4 }}>
                {fmtTime(duration)} total · {fmtTime(trimDuration)} selected
              </div>
            )}
          </div>

          {/* File loader */}
          <label htmlFor="audio-file" style={{
            display: "inline-block", padding: "9px 18px",
            background: "rgba(0,229,160,0.1)", border: `1px solid rgba(0,229,160,0.3)`,
            borderRadius: 8, color: ACCENT, cursor: "pointer",
            fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: "0.08em",
            transition: "all 0.15s"
          }}>
            LOAD FILE
          </label>
          <input id="audio-file" type="file" accept="audio/*" style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])} />
        </div>

        {/* Waveform */}
        <div style={{
          background: SURFACE, borderRadius: 12,
          border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 16
        }}>
          <div ref={waveContainerRef} onWheel={handleScroll} style={{ padding: "12px 12px 8px" }}>
            <WaveformCanvas
              audioBuffer={audioBuffer}
              zoom={zoom}
              scrollLeft={scrollLeft}
              trimStart={trimStart}
              trimEnd={trimEnd}
              playhead={playhead}
              duration={duration || 1}
              onSeek={handleSeek}
              onTrimChange={handleTrimChange}
              width={waveWidth - 24}
            />
          </div>

          {/* Scrollbar */}
          {zoom > 1 && (
            <div style={{ padding: "0 12px 8px" }}>
              <input type="range" min={0} max={waveWidth * (zoom - 1)}
                value={scrollLeft}
                onChange={e => setScrollLeft(Number(e.target.value))}
                style={{ width: "100%", accentColor: ACCENT }} />
            </div>
          )}
        </div>

        {/* Transport + controls */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>

          {/* Transport */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            {/* Play/pause */}
            <button onClick={togglePlay} disabled={!audioBuffer} style={{
              width: 44, height: 44, borderRadius: "50%",
              background: audioBuffer ? ACCENT : "rgba(255,255,255,0.05)",
              border: "none", cursor: audioBuffer ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: BG, fontSize: 18, transition: "all 0.15s",
              boxShadow: audioBuffer ? `0 0 16px rgba(0,229,160,0.3)` : "none"
            }}>
              {isPlaying ? "⏸" : "▶"}
            </button>

            {/* Stop */}
            <button onClick={() => { stopPlayback(); setPlayhead(trimStart); }} disabled={!audioBuffer} style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`,
              cursor: audioBuffer ? "pointer" : "not-allowed",
              color: TEXT, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center"
            }}>⏹</button>

            {/* Loop */}
            <button onClick={() => { setLoop(l => !l); }} disabled={!audioBuffer} style={{
              width: 36, height: 36, borderRadius: "50%",
              background: loop ? "rgba(124,108,250,0.2)" : "rgba(255,255,255,0.05)",
              border: loop ? `1px solid ${ACCENT2}` : `1px solid ${BORDER}`,
              cursor: audioBuffer ? "pointer" : "not-allowed",
              color: loop ? ACCENT2 : MUTED, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>⟳</button>

            <div style={{ width: 1, height: 32, background: BORDER }} />

            {/* Playhead time */}
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: ACCENT, minWidth: 80 }}>
              {fmtTime(playhead)}
            </div>
          </div>

          {/* Zoom */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
            <label>ZOOM</label>
            <button onClick={() => handleZoom(-1)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>−</button>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: TEXT, minWidth: 30, textAlign: "center" }}>{zoom}×</span>
            <button onClick={() => handleZoom(1)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>+</button>
          </div>

          {/* Gain */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 180 }}>
            <label>GAIN</label>
            <input type="range" min={0} max={2} step={0.01} value={gain}
              onChange={e => setGain(Number(e.target.value))}
              style={{ flex: 1, accentColor: ACCENT2 }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: TEXT, minWidth: 36, textAlign: "right" }}>
              {(gain * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Effects rack */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch", marginTop: 12 }}>

          {/* Delay */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: ACCENT2, letterSpacing: "0.15em", marginBottom: 10 }}>DELAY</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <label style={{ minWidth: 36 }}>TIME</label>
              <input type="range" min={0} max={1} step={0.01} value={delayTime}
                onChange={e => setDelayTime(Number(e.target.value))}
                style={{ flex: 1, accentColor: ACCENT2 }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: TEXT, minWidth: 40, textAlign: "right" }}>
                {delayTime === 0 ? "OFF" : `${(delayTime * 1000).toFixed(0)}ms`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ minWidth: 36 }}>FDBK</label>
              <input type="range" min={0} max={0.9} step={0.01} value={delayFeedback}
                onChange={e => setDelayFeedback(Number(e.target.value))}
                style={{ flex: 1, accentColor: ACCENT2 }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: TEXT, minWidth: 40, textAlign: "right" }}>
                {(delayFeedback * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Reverb */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", flex: 1, minWidth: 160 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#f59e0b", letterSpacing: "0.15em", marginBottom: 10 }}>REVERB</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ minWidth: 28 }}>MIX</label>
              <input type="range" min={0} max={1} step={0.01} value={reverbMix}
                onChange={e => setReverbMix(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#f59e0b" }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: TEXT, minWidth: 40, textAlign: "right" }}>
                {reverbMix === 0 ? "OFF" : `${(reverbMix * 100).toFixed(0)}%`}
              </span>
            </div>
          </div>

          {/* Distortion */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", flex: 1, minWidth: 160 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#f87171", letterSpacing: "0.15em", marginBottom: 10 }}>DISTORTION</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ minWidth: 28 }}>AMT</label>
              <input type="range" min={0} max={1} step={0.01} value={distortion}
                onChange={e => setDistortion(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#f87171" }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: TEXT, minWidth: 40, textAlign: "right" }}>
                {distortion === 0 ? "OFF" : `${(distortion * 100).toFixed(0)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Trim controls */}
        <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "16px 18px", marginTop: 12 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: MUTED, letterSpacing: "0.15em", marginBottom: 12 }}>TRIM REGION</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ACCENT }} />
              <label>IN</label>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: ACCENT }}>{fmtTime(trimStart)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b" }} />
              <label>OUT</label>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#f59e0b" }}>{fmtTime(trimEnd)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label>DURATION</label>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: TEXT }}>{fmtTime(trimDuration)}</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => { setTrimStart(0); setTrimEnd(duration); }} disabled={!audioBuffer}
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: 7, color: MUTED, padding: "7px 13px", cursor: audioBuffer ? "pointer" : "not-allowed", fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
                RESET
              </button>
              <button onClick={handleExport} disabled={!audioBuffer}
                style={{ background: audioBuffer ? "rgba(124,108,250,0.15)" : "rgba(255,255,255,0.03)", border: audioBuffer ? `1px solid ${ACCENT2}` : `1px solid ${BORDER}`, borderRadius: 7, color: audioBuffer ? ACCENT2 : MUTED, padding: "7px 18px", cursor: audioBuffer ? "pointer" : "not-allowed", fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em", transition: "all 0.15s" }}>
                EXPORT TRIM
              </button>
            </div>
          </div>
        </div>

        {/* Export result */}
        {exportData && (
          <div style={{ background: "rgba(124,108,250,0.08)", border: `1px solid rgba(124,108,250,0.25)`, borderRadius: 12, padding: "14px 18px", marginTop: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: ACCENT2, flex: 1 }}>{exportMsg}</span>
            <audio controls src={exportData} style={{ height: 32 }} />
            <a href={exportData} download={`trim_${fileName || "audio.wav"}`}
              style={{ background: ACCENT2, color: "white", borderRadius: 7, padding: "7px 16px", textDecoration: "none", fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
              DOWNLOAD
            </a>
          </div>
        )}

        {/* Instructions */}
        {!audioBuffer && (
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              ["🎵", "Load any audio file", "MP3, WAV, OGG, M4A — anything your browser can decode"],
              ["✂️", "Drag to trim", "Grab the green (in) or amber (out) handles on the waveform"],
              ["🔍", "Scroll to zoom", "Mouse wheel to zoom, then scroll the scrollbar"],
              ["💾", "Export selection", "Click Export Trim to get a clean WAV of your selection"],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ background: SURFACE, borderRadius: 10, border: `1px solid ${BORDER}`, padding: "14px 16px" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, color: TEXT, fontSize: 13, marginBottom: 4 }}>{title}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: MUTED, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── WAV encoder ──────────────────────────────────────────────────────────────
function encodeWAV(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataLength = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeString(off, s) { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = clamp(audioBuffer.getChannelData(ch)[i], -1, 1);
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return buffer;
}
