import { useState, useRef, useEffect, useCallback } from "react";
import { Streamlit } from "streamlit-component-lib";

// ─── constants ────────────────────────────────────────────────────────────────
const ACCENT  = "#00e5a0";
const ACCENT2 = "#7c6cfa";
const BG      = "#0d0d12";
const SURFACE = "#13131c";
const SURFACE2= "#1a1a28";
const BORDER  = "rgba(255,255,255,0.07)";
const TEXT    = "#e2e8f0";
const MUTED   = "#475569";

const FX_COLORS = {
  eq:       "#a78bfa",
  filter:   "#60a5fa",
  comp:     "#2dd4bf",
  delay:    ACCENT2,
  chorus:   "#f472b6",
  dist:     "#f87171",
  tremolo:  "#fb923c",
  reverb:   "#f59e0b",
  pan:      "#34d399",
  speed:    ACCENT,
};

// ─── utils ────────────────────────────────────────────────────────────────────
function fmtTime(s) {
  if (!isFinite(s)) return "0:00.000";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(3).padStart(6, "0")}`;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── reusable slider row ──────────────────────────────────────────────────────
function Knob({ label, value, min, max, step, fmt, color, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <label style={{ minWidth: 48, color: MUTED, fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.1em" }}>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: color || ACCENT2 }} />
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: TEXT, minWidth: 44, textAlign: "right" }}>
        {fmt ? fmt(value) : value}
      </span>
    </div>
  );
}

// ─── Waveform canvas ──────────────────────────────────────────────────────────
function WaveformCanvas({ audioBuffer, zoom, scrollLeft, trimStart, trimEnd, playhead,
  duration, onSeek, onTrimChange, width, isRecording }) {
  const canvasRef = useRef(null);
  const dragging = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = SURFACE2;
    ctx.fillRect(0, 0, W, H);

    if (!audioBuffer) {
      ctx.fillStyle = MUTED;
      ctx.font = "12px 'Space Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("load audio or enable mic to begin", W / 2, H / 2);
      return;
    }

    const totalPx = W * zoom;
    const pxPerSec = totalPx / duration;
    const startSec = scrollLeft / pxPerSec;

    const trimStartPx = trimStart * pxPerSec - scrollLeft;
    const trimEndPx = trimEnd * pxPerSec - scrollLeft;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    if (trimStartPx > 0) ctx.fillRect(0, 0, trimStartPx, H);
    if (trimEndPx < W) ctx.fillRect(trimEndPx, 0, W - trimEndPx, H);

    const data = audioBuffer.getChannelData(0);
    const samples = data.length;
    const visibleSec = W / pxPerSec;
    const startSample = Math.floor((startSec / duration) * samples);
    const endSample = Math.ceil(((startSec + visibleSec) / duration) * samples);
    const step = Math.max(1, Math.floor((endSample - startSample) / W));

    for (let x = 0; x < W; x++) {
      const si = startSample + Math.floor((x / W) * (endSample - startSample));
      let min = 0, max = 0;
      for (let j = 0; j < step && si + j < samples; j++) {
        const v = data[si + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const sec = startSec + (x / pxPerSec);
      const inTrim = sec >= trimStart && sec <= trimEnd;
      ctx.strokeStyle = inTrim ? ACCENT : "rgba(0,229,160,0.25)";
      ctx.beginPath();
      const mid = H / 2;
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
        ctx.beginPath();
        ctx.moveTo(px - 6, 0); ctx.lineTo(px + 6, 0); ctx.lineTo(px, 10); ctx.closePath();
        ctx.fill();
      }
    }

    // Time ruler
    ctx.fillStyle = SURFACE;
    ctx.fillRect(0, 0, W, 20);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(W, 20); ctx.stroke();

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

    // Recording indicator
    if (isRecording) {
      ctx.fillStyle = "rgba(248,113,113,0.15)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f87171";
      ctx.beginPath(); ctx.arc(W - 14, 30, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 9px 'Space Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText("REC", W - 24, 34);
    }
  }, [audioBuffer, zoom, scrollLeft, trimStart, trimEnd, playhead, duration, width, isRecording]);

  const getPxPerSec = () => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return 1;
    return (canvas.width * zoom) / duration;
  };

  const secFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return clamp((x + scrollLeft) / getPxPerSec(), 0, duration);
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
    <canvas ref={canvasRef} width={width} height={140}
      style={{ display: "block", cursor: "crosshair", borderRadius: 8, width: "100%", height: 140 }}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AudioEditor() {
  // ── core state ──
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
  const [loop, setLoop] = useState(false);
  const [waveWidth, setWaveWidth] = useState(800);
  const [exportData, setExportData] = useState(null);
  const [exportMsg, setExportMsg] = useState("");
  const [fxOpen, setFxOpen] = useState(true);

  // ── effects state ──
  const [gain, setGain] = useState(1.0);
  const [eqLow, setEqLow] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);
  const [filterType, setFilterType] = useState("lowpass");
  const [filterFreq, setFilterFreq] = useState(20000);
  const [filterQ, setFilterQ] = useState(1);
  const [compThreshold, setCompThreshold] = useState(0);
  const [compRatio, setCompRatio] = useState(1);
  const [compAttack, setCompAttack] = useState(0.003);
  const [compRelease, setCompRelease] = useState(0.25);
  const [delayTime, setDelayTime] = useState(0);
  const [delayFeedback, setDelayFeedback] = useState(0.3);
  const [chorusRate, setChorusRate] = useState(1.5);
  const [chorusDepth, setChorusDepth] = useState(0);
  const [chorusMix, setChorusMix] = useState(0.5);
  const [distortion, setDistortion] = useState(0);
  const [tremoloRate, setTremoloRate] = useState(5);
  const [tremoloDepth, setTremoloDepth] = useState(0);
  const [reverbMix, setReverbMix] = useState(0);
  const [pan, setPan] = useState(0);
  const [speed, setSpeed] = useState(1.0);

  // ── recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [micActive, setMicActive] = useState(false);

  // ── refs: playback ──
  const sourceRef = useRef(null);
  const startTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const rafRef = useRef(null);
  const waveContainerRef = useRef(null);
  const readyRef = useRef(false);

  // ── refs: effect nodes (persistent chain) ──
  const chainBuiltRef = useRef(false);
  const gainNodeRef = useRef(null);
  const eqLowRef = useRef(null);
  const eqMidRef = useRef(null);
  const eqHighRef = useRef(null);
  const filterRef = useRef(null);
  const compressorRef = useRef(null);
  const delayNodeRef = useRef(null);
  const delayFbRef = useRef(null);
  const delayDryRef = useRef(null);
  const delayWetRef = useRef(null);
  const chorusDelayRef = useRef(null);
  const chorusLFORef = useRef(null);
  const chorusDepthGainRef = useRef(null);
  const chorusDryRef = useRef(null);
  const chorusWetRef = useRef(null);
  const waveShaperRef = useRef(null);
  const tremoloGainRef = useRef(null);
  const tremoloLFORef = useRef(null);
  const tremoloDepthGainRef = useRef(null);
  const reverbConvRef = useRef(null);
  const reverbDryRef = useRef(null);
  const reverbWetRef = useRef(null);
  const panNodeRef = useRef(null);
  const mediaDestRef = useRef(null);

  // ── refs: recording ──
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const recStartRef = useRef(0);

  // ── refs: mic ──
  const micSourceRef = useRef(null);
  const micStreamRef = useRef(null);

  // ──────────────────────────────────────────────────────────────────────────
  // Build the persistent effects chain (called once)
  // ──────────────────────────────────────────────────────────────────────────
  const ensureChain = useCallback(() => {
    if (chainBuiltRef.current) return;

    // — Gain —
    const g = audioCtx.createGain();
    gainNodeRef.current = g;

    // — 3-Band EQ —
    const eqL = audioCtx.createBiquadFilter();
    eqL.type = "lowshelf"; eqL.frequency.value = 320; eqL.gain.value = 0;
    eqLowRef.current = eqL;

    const eqM = audioCtx.createBiquadFilter();
    eqM.type = "peaking"; eqM.frequency.value = 1000; eqM.Q.value = 1.5; eqM.gain.value = 0;
    eqMidRef.current = eqM;

    const eqH = audioCtx.createBiquadFilter();
    eqH.type = "highshelf"; eqH.frequency.value = 3200; eqH.gain.value = 0;
    eqHighRef.current = eqH;

    // — Filter —
    const flt = audioCtx.createBiquadFilter();
    flt.type = "lowpass"; flt.frequency.value = 20000; flt.Q.value = 1;
    filterRef.current = flt;

    // — Compressor —
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = 0; comp.ratio.value = 1;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    compressorRef.current = comp;

    // — Delay (dry/wet mix) —
    const del = audioCtx.createDelay(2.0);
    const dFb = audioCtx.createGain(); dFb.gain.value = 0.3;
    const dDry = audioCtx.createGain(); dDry.gain.value = 1;
    const dWet = audioCtx.createGain(); dWet.gain.value = 0;
    const dMix = audioCtx.createGain();
    delayNodeRef.current = del; delayFbRef.current = dFb;
    delayDryRef.current = dDry; delayWetRef.current = dWet;

    // — Chorus (LFO → delay modulation, dry/wet) —
    const cDel = audioCtx.createDelay(0.1);
    cDel.delayTime.value = 0.025;
    const cDry = audioCtx.createGain(); cDry.gain.value = 1;
    const cWet = audioCtx.createGain(); cWet.gain.value = 0;
    const cMix = audioCtx.createGain();
    const cLFO = audioCtx.createOscillator(); cLFO.type = "sine"; cLFO.frequency.value = 1.5;
    const cDepth = audioCtx.createGain(); cDepth.gain.value = 0;
    chorusDelayRef.current = cDel; chorusDryRef.current = cDry;
    chorusWetRef.current = cWet; chorusLFORef.current = cLFO;
    chorusDepthGainRef.current = cDepth;

    // — Distortion (waveshaper) —
    const ws = audioCtx.createWaveShaper();
    ws.oversample = "4x";
    const linCurve = new Float32Array(44100);
    for (let i = 0; i < 44100; i++) linCurve[i] = (i * 2) / 44100 - 1;
    ws.curve = linCurve;
    waveShaperRef.current = ws;

    // — Tremolo (LFO → gain modulation) —
    const tGain = audioCtx.createGain(); tGain.gain.value = 1;
    const tLFO = audioCtx.createOscillator(); tLFO.type = "sine"; tLFO.frequency.value = 5;
    const tDepthG = audioCtx.createGain(); tDepthG.gain.value = 0;
    tremoloGainRef.current = tGain;
    tremoloLFORef.current = tLFO;
    tremoloDepthGainRef.current = tDepthG;

    // — Reverb (convolver, dry/wet) —
    const conv = audioCtx.createConvolver();
    const irLen = audioCtx.sampleRate * 2;
    const ir = audioCtx.createBuffer(2, irLen, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let j = 0; j < irLen; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / irLen, 2.5);
    }
    conv.buffer = ir;
    const rDry = audioCtx.createGain(); rDry.gain.value = 1;
    const rWet = audioCtx.createGain(); rWet.gain.value = 0;
    const rMix = audioCtx.createGain();
    reverbConvRef.current = conv; reverbDryRef.current = rDry; reverbWetRef.current = rWet;

    // — Stereo Pan —
    const panN = audioCtx.createStereoPanner(); panN.pan.value = 0;
    panNodeRef.current = panN;

    // — Media destination for recording —
    const mediaDest = audioCtx.createMediaStreamDestination();
    mediaDestRef.current = mediaDest;

    // ── WIRE everything ────────────────────────────────────────────────────
    // gain → EQ chain → filter → compressor
    g.connect(eqL); eqL.connect(eqM); eqM.connect(eqH); eqH.connect(flt); flt.connect(comp);

    // Delay: comp → dry/wet mix
    comp.connect(dDry); dDry.connect(dMix);
    comp.connect(del); del.connect(dFb); dFb.connect(del);
    del.connect(dWet); dWet.connect(dMix);

    // Chorus: dMix → dry/wet mix, LFO modulation
    dMix.connect(cDry); cDry.connect(cMix);
    dMix.connect(cDel); cDel.connect(cWet); cWet.connect(cMix);
    cLFO.connect(cDepth); cDepth.connect(cDel.delayTime);

    // Distortion + Tremolo
    cMix.connect(ws); ws.connect(tGain);
    tLFO.connect(tDepthG); tDepthG.connect(tGain.gain);

    // Reverb: tGain → dry/wet mix
    tGain.connect(rDry); rDry.connect(rMix);
    tGain.connect(conv); conv.connect(rWet); rWet.connect(rMix);

    // Pan → outputs
    rMix.connect(panN);
    panN.connect(audioCtx.destination);
    panN.connect(mediaDest);

    // Start oscillators
    cLFO.start();
    tLFO.start();

    chainBuiltRef.current = true;
  }, [audioCtx]);

  // ── Streamlit lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    const onRender = (event) => {
      const args = event.detail.args || {};
      if (!readyRef.current && args.audio_url) {
        fetch(args.audio_url)
          .then(r => r.arrayBuffer())
          .then(ab => audioCtx.decodeAudioData(ab))
          .then(buf => {
            setAudioBuffer(buf); setDuration(buf.duration);
            setTrimStart(0); setTrimEnd(buf.duration);
            setFileName(args.audio_url.split("/").pop() || "audio");
          }).catch(() => {});
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
    const ro = new ResizeObserver(entries => setWaveWidth(entries[0].contentRect.width || 800));
    ro.observe(waveContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── File loading ─────────────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(arrayBuffer);
    setAudioBuffer(buf); setDuration(buf.duration);
    setTrimStart(0); setTrimEnd(buf.duration);
    setPlayhead(0); setZoom(1); setScrollLeft(0);
    setExportData(null); setExportMsg("");
    stopPlayback();
  };

  // ── Playback ─────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} sourceRef.current = null; }
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback((fromSec) => {
    if (!audioBuffer) return;
    stopPlayback();
    if (audioCtx.state === "suspended") audioCtx.resume();
    ensureChain();

    // Apply current values to all nodes
    gainNodeRef.current.gain.value = gain;
    eqLowRef.current.gain.value = eqLow;
    eqMidRef.current.gain.value = eqMid;
    eqHighRef.current.gain.value = eqHigh;
    filterRef.current.type = filterType;
    filterRef.current.frequency.value = filterFreq;
    filterRef.current.Q.value = filterQ;
    compressorRef.current.threshold.value = compThreshold;
    compressorRef.current.ratio.value = compRatio;
    compressorRef.current.attack.value = compAttack;
    compressorRef.current.release.value = compRelease;
    delayNodeRef.current.delayTime.value = delayTime;
    delayFbRef.current.gain.value = delayFeedback;
    delayDryRef.current.gain.value = 1;
    delayWetRef.current.gain.value = delayTime > 0 ? 0.6 : 0;
    chorusLFORef.current.frequency.value = chorusRate;
    chorusDepthGainRef.current.gain.value = chorusDepth / 1000;
    chorusDryRef.current.gain.value = chorusDepth > 0 ? (1 - chorusMix) : 1;
    chorusWetRef.current.gain.value = chorusDepth > 0 ? chorusMix : 0;

    const amt = distortion * 400;
    const n = 44100, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = amt > 0 ? ((3 + amt) * x * 20 * (Math.PI / 180)) / (Math.PI + amt * Math.abs(x)) : x;
    }
    waveShaperRef.current.curve = curve;

    tremoloLFORef.current.frequency.value = tremoloRate;
    tremoloDepthGainRef.current.gain.value = tremoloDepth / 2;
    tremoloGainRef.current.gain.value = 1 - tremoloDepth / 2;

    reverbDryRef.current.gain.value = 1 - reverbMix;
    reverbWetRef.current.gain.value = reverbMix;
    panNodeRef.current.pan.value = pan;

    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.playbackRate.value = speed;
    src.loop = loop;
    if (loop) { src.loopStart = trimStart; src.loopEnd = trimEnd; }
    src.connect(gainNodeRef.current);

    const offset = clamp(fromSec, trimStart, trimEnd);
    src.start(0, offset, loop ? undefined : (trimEnd - offset) / speed);
    sourceRef.current = src;
    startTimeRef.current = audioCtx.currentTime;
    startOffsetRef.current = offset;
    setIsPlaying(true);

    src.onended = () => {
      if (!loop) { setIsPlaying(false); setPlayhead(trimStart); cancelAnimationFrame(rafRef.current); }
    };

    const tick = () => {
      const elapsed = (audioCtx.currentTime - startTimeRef.current) * speed;
      let pos = startOffsetRef.current + elapsed;
      if (loop) pos = trimStart + ((pos - trimStart) % (trimEnd - trimStart));
      setPlayhead(clamp(pos, 0, trimEnd));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [audioBuffer, audioCtx, loop, trimStart, trimEnd, stopPlayback, ensureChain,
      gain, eqLow, eqMid, eqHigh, filterType, filterFreq, filterQ,
      compThreshold, compRatio, compAttack, compRelease,
      delayTime, delayFeedback, chorusRate, chorusDepth, chorusMix,
      distortion, tremoloRate, tremoloDepth, reverbMix, pan, speed]);

  // ── Live parameter updates (no playback restart needed) ──────────────────
  useEffect(() => { if (gainNodeRef.current) gainNodeRef.current.gain.value = gain; }, [gain]);
  useEffect(() => { if (eqLowRef.current) eqLowRef.current.gain.value = eqLow; }, [eqLow]);
  useEffect(() => { if (eqMidRef.current) eqMidRef.current.gain.value = eqMid; }, [eqMid]);
  useEffect(() => { if (eqHighRef.current) eqHighRef.current.gain.value = eqHigh; }, [eqHigh]);
  useEffect(() => { if (filterRef.current) filterRef.current.type = filterType; }, [filterType]);
  useEffect(() => { if (filterRef.current) filterRef.current.frequency.value = filterFreq; }, [filterFreq]);
  useEffect(() => { if (filterRef.current) filterRef.current.Q.value = filterQ; }, [filterQ]);
  useEffect(() => { if (compressorRef.current) compressorRef.current.threshold.value = compThreshold; }, [compThreshold]);
  useEffect(() => { if (compressorRef.current) compressorRef.current.ratio.value = compRatio; }, [compRatio]);
  useEffect(() => { if (compressorRef.current) compressorRef.current.attack.value = compAttack; }, [compAttack]);
  useEffect(() => { if (compressorRef.current) compressorRef.current.release.value = compRelease; }, [compRelease]);
  useEffect(() => {
    if (delayNodeRef.current) delayNodeRef.current.delayTime.value = delayTime;
    if (delayWetRef.current) delayWetRef.current.gain.value = delayTime > 0 ? 0.6 : 0;
  }, [delayTime]);
  useEffect(() => { if (delayFbRef.current) delayFbRef.current.gain.value = delayFeedback; }, [delayFeedback]);
  useEffect(() => { if (chorusLFORef.current) chorusLFORef.current.frequency.value = chorusRate; }, [chorusRate]);
  useEffect(() => { if (chorusDepthGainRef.current) chorusDepthGainRef.current.gain.value = chorusDepth / 1000; }, [chorusDepth]);
  useEffect(() => {
    if (chorusDryRef.current) chorusDryRef.current.gain.value = chorusDepth > 0 ? (1 - chorusMix) : 1;
    if (chorusWetRef.current) chorusWetRef.current.gain.value = chorusDepth > 0 ? chorusMix : 0;
  }, [chorusDepth, chorusMix]);
  useEffect(() => {
    if (!waveShaperRef.current) return;
    const amt = distortion * 400, n = 44100, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = amt > 0 ? ((3 + amt) * x * 20 * (Math.PI / 180)) / (Math.PI + amt * Math.abs(x)) : x;
    }
    waveShaperRef.current.curve = curve;
  }, [distortion]);
  useEffect(() => { if (tremoloLFORef.current) tremoloLFORef.current.frequency.value = tremoloRate; }, [tremoloRate]);
  useEffect(() => {
    if (tremoloGainRef.current) tremoloGainRef.current.gain.value = 1 - tremoloDepth / 2;
    if (tremoloDepthGainRef.current) tremoloDepthGainRef.current.gain.value = tremoloDepth / 2;
  }, [tremoloDepth]);
  useEffect(() => {
    if (reverbDryRef.current) reverbDryRef.current.gain.value = 1 - reverbMix;
    if (reverbWetRef.current) reverbWetRef.current.gain.value = reverbMix;
  }, [reverbMix]);
  useEffect(() => { if (panNodeRef.current) panNodeRef.current.pan.value = pan; }, [pan]);
  useEffect(() => { if (sourceRef.current) sourceRef.current.playbackRate.value = speed; }, [speed]);

  // ── Mic input ────────────────────────────────────────────────────────────
  const toggleMic = async () => {
    if (micActive) {
      if (micSourceRef.current) micSourceRef.current.disconnect();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      micSourceRef.current = null; micStreamRef.current = null;
      setMicActive(false);
    } else {
      try {
        if (audioCtx.state === "suspended") await audioCtx.resume();
        ensureChain();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const src = audioCtx.createMediaStreamSource(stream);
        src.connect(gainNodeRef.current);
        micSourceRef.current = src;
        setMicActive(true);
      } catch (err) {
        console.error("Mic access denied:", err);
      }
    }
  };

  // ── Recording ────────────────────────────────────────────────────────────
  const startRecording = () => {
    if (audioCtx.state === "suspended") audioCtx.resume();
    ensureChain();
    recordingChunksRef.current = [];
    setRecordingUrl(null); setRecordingBlob(null);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";

    const opts = mimeType ? { mimeType } : {};
    const mr = new MediaRecorder(mediaDestRef.current.stream, opts);
    mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: mr.mimeType });
      const url = URL.createObjectURL(blob);
      setRecordingBlob(blob); setRecordingUrl(url);
      clearInterval(recTimerRef.current);
    };

    mediaRecorderRef.current = mr;
    mr.start(250); // collect data every 250ms
    recStartRef.current = Date.now();
    setIsRecording(true); setRecordingTime(0);

    recTimerRef.current = setInterval(() => {
      setRecordingTime(Date.now() - recStartRef.current);
    }, 100);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(recTimerRef.current);
  };

  const sendRecording = () => {
    if (!recordingBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result.split(",")[1];
      Streamlit.setComponentValue({
        type: "recording",
        mimeType: recordingBlob.type,
        recordingBase64: b64,
        durationSec: recordingTime / 1000,
      });
    };
    reader.readAsDataURL(recordingBlob);
  };

  // ── Playback controls ───────────────────────────────────────────────────
  const togglePlay = () => {
    if (isPlaying) stopPlayback();
    else startPlayback(playhead < trimStart || playhead >= trimEnd ? trimStart : playhead);
  };

  const handleSeek = (sec) => { setPlayhead(sec); if (isPlaying) startPlayback(sec); };

  const handleTrimChange = (s, e) => {
    setTrimStart(s); setTrimEnd(e);
    if (isPlaying) startPlayback(clamp(playhead, s, e));
  };

  // ── Export trimmed audio ─────────────────────────────────────────────────
  const handleExport = () => {
    if (!audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(trimStart * sampleRate);
    const endSample = Math.ceil(trimEnd * sampleRate);
    const length = endSample - startSample;
    const out = audioCtx.createBuffer(audioBuffer.numberOfChannels, length, sampleRate);
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      out.copyToChannel(audioBuffer.getChannelData(c).slice(startSample, endSample), c);
    }
    const wav = encodeWAV(out);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    setExportData(url);
    setExportMsg(`✓ Trimmed: ${fmtTime(trimStart)} → ${fmtTime(trimEnd)} (${fmtTime(trimEnd - trimStart)})`);

    const bytes = new Uint8Array(wav);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    Streamlit.setComponentValue({
      type: "export", trimStart, trimEnd, duration, gain,
      eqLow, eqMid, eqHigh, filterType, filterFreq: Math.round(filterFreq), filterQ,
      compThreshold, compRatio, compAttack, compRelease,
      delayTime, delayFeedback, chorusRate, chorusDepth, chorusMix,
      distortion, tremoloRate, tremoloDepth, reverbMix, pan, speed,
      wavBase64: btoa(binary),
    });
  };

  const handleScroll = (e) => {
    setScrollLeft(s => clamp(s + e.deltaX + e.deltaY * 0.5, 0, waveWidth * (zoom - 1)));
  };

  const trimDuration = trimEnd - trimStart;

  // ── card style helper ────────────────────────────────────────────────────
  const card = (title, color, minW, children) => (
    <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", flex: 1, minWidth: minW || 200 }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color, letterSpacing: "0.15em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );

  // ── small button helper ──────────────────────────────────────────────────
  const sBtn = (label, active, color, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "7px 14px", borderRadius: 8, border: active ? `1px solid ${color}` : `1px solid ${BORDER}`,
      background: active ? `${color}22` : "rgba(255,255,255,0.04)",
      color: active ? color : (disabled ? "rgba(255,255,255,0.15)" : MUTED),
      fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em",
      cursor: disabled ? "not-allowed" : "pointer", transition: "all .15s",
    }}>{label}</button>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
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
        select { background: ${SURFACE2}; color: ${TEXT}; border: 1px solid ${BORDER}; border-radius: 6px; padding: 4px 8px; font-family: 'Space Mono', monospace; font-size: 10px; outline: none; cursor: pointer; }
        @keyframes pulse-rec { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <div style={{ minHeight: "100vh", background: BG, padding: "28px 28px 40px", fontFamily: "'Syne', sans-serif" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: ACCENT, letterSpacing: "0.2em", marginBottom: 5 }}>AUDIO EDITOR</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>
              {fileName || "No file loaded"}
            </h1>
            {duration > 0 && (
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: MUTED, marginTop: 4 }}>
                {fmtTime(duration)} total · {fmtTime(trimDuration)} selected
                {micActive && <span style={{ color: "#f87171", marginLeft: 10 }}>● MIC LIVE</span>}
              </div>
            )}
          </div>
          <label htmlFor="audio-file" style={{
            display: "inline-block", padding: "9px 18px",
            background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)",
            borderRadius: 8, color: ACCENT, cursor: "pointer",
            fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: "0.08em",
          }}>LOAD FILE</label>
          <input id="audio-file" type="file" accept="audio/*" style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])} />
        </div>

        {/* ── Waveform ────────────────────────────────────────────────────── */}
        <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 16 }}>
          <div ref={waveContainerRef} onWheel={handleScroll} style={{ padding: "12px 12px 8px" }}>
            <WaveformCanvas audioBuffer={audioBuffer} zoom={zoom} scrollLeft={scrollLeft}
              trimStart={trimStart} trimEnd={trimEnd} playhead={playhead}
              duration={duration || 1} onSeek={handleSeek} onTrimChange={handleTrimChange}
              width={waveWidth - 24} isRecording={isRecording} />
          </div>
          {zoom > 1 && (
            <div style={{ padding: "0 12px 8px" }}>
              <input type="range" min={0} max={waveWidth * (zoom - 1)} value={scrollLeft}
                onChange={e => setScrollLeft(Number(e.target.value))} style={{ width: "100%", accentColor: ACCENT }} />
            </div>
          )}
        </div>

        {/* ── Transport row ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          {/* Transport buttons */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={togglePlay} disabled={!audioBuffer} style={{
              width: 44, height: 44, borderRadius: "50%",
              background: audioBuffer ? ACCENT : "rgba(255,255,255,0.05)",
              border: "none", cursor: audioBuffer ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: BG, fontSize: 18, boxShadow: audioBuffer ? "0 0 16px rgba(0,229,160,0.3)" : "none"
            }}>{isPlaying ? "⏸" : "▶"}</button>

            <button onClick={() => { stopPlayback(); setPlayhead(trimStart); }} disabled={!audioBuffer} style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`,
              cursor: audioBuffer ? "pointer" : "not-allowed", color: TEXT, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>⏹</button>

            <button onClick={() => setLoop(l => !l)} disabled={!audioBuffer} style={{
              width: 36, height: 36, borderRadius: "50%",
              background: loop ? "rgba(124,108,250,0.2)" : "rgba(255,255,255,0.05)",
              border: loop ? `1px solid ${ACCENT2}` : `1px solid ${BORDER}`,
              cursor: audioBuffer ? "pointer" : "not-allowed",
              color: loop ? ACCENT2 : MUTED, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>⟳</button>

            <div style={{ width: 1, height: 32, background: BORDER }} />
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: ACCENT, minWidth: 80 }}>{fmtTime(playhead)}</div>
          </div>

          {/* Zoom */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ color: MUTED, fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.1em" }}>ZOOM</label>
            <button onClick={() => setZoom(z => clamp(z - 1, 1, 20))} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>−</button>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: TEXT, minWidth: 30, textAlign: "center" }}>{zoom}×</span>
            <button onClick={() => setZoom(z => clamp(z + 1, 1, 20))} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>+</button>
          </div>

          {/* Gain */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 180 }}>
            <label style={{ color: MUTED, fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.1em" }}>GAIN</label>
            <input type="range" min={0} max={2} step={0.01} value={gain}
              onChange={e => setGain(Number(e.target.value))} style={{ flex: 1, accentColor: ACCENT2 }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: TEXT, minWidth: 36, textAlign: "right" }}>
              {(gain * 100).toFixed(0)}%
            </span>
          </div>

          {/* Speed / Pitch */}
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, minWidth: 160 }}>
            <label style={{ color: FX_COLORS.speed, fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.1em" }}>SPEED</label>
            <input type="range" min={0.25} max={3} step={0.05} value={speed}
              onChange={e => setSpeed(Number(e.target.value))} style={{ flex: 1, accentColor: FX_COLORS.speed }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: TEXT, minWidth: 36, textAlign: "right" }}>
              {speed.toFixed(2)}×
            </span>
          </div>
        </div>

        {/* ── Effects Rack ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setFxOpen(o => !o)} style={{
            background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            fontFamily: "'Space Mono', monospace", fontSize: 10, color: ACCENT2, letterSpacing: "0.15em", marginBottom: 10, padding: 0,
          }}>
            <span style={{ transform: fxOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform .15s", display: "inline-block" }}>▸</span>
            EFFECTS RACK
          </button>

          {fxOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Row 1: EQ · Filter · Compressor */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {card("3-BAND EQ", FX_COLORS.eq, 210, <>
                  <Knob label="LOW" value={eqLow} min={-12} max={12} step={0.5} color={FX_COLORS.eq}
                    fmt={v => v === 0 ? "0 dB" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`} onChange={setEqLow} />
                  <Knob label="MID" value={eqMid} min={-12} max={12} step={0.5} color={FX_COLORS.eq}
                    fmt={v => v === 0 ? "0 dB" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`} onChange={setEqMid} />
                  <Knob label="HIGH" value={eqHigh} min={-12} max={12} step={0.5} color={FX_COLORS.eq}
                    fmt={v => v === 0 ? "0 dB" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`} onChange={setEqHigh} />
                </>)}

                {card("FILTER", FX_COLORS.filter, 210, <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {["lowpass", "highpass", "bandpass", "notch"].map(t => (
                      <button key={t} onClick={() => setFilterType(t)} style={{
                        padding: "3px 8px", borderRadius: 5, fontSize: 9, fontFamily: "'Space Mono', monospace",
                        background: filterType === t ? `${FX_COLORS.filter}33` : "rgba(255,255,255,0.04)",
                        border: filterType === t ? `1px solid ${FX_COLORS.filter}` : `1px solid ${BORDER}`,
                        color: filterType === t ? FX_COLORS.filter : MUTED, cursor: "pointer",
                      }}>{t.toUpperCase().replace("PASS", "")}</button>
                    ))}
                  </div>
                  <Knob label="FREQ" value={filterFreq} min={20} max={20000} step={1} color={FX_COLORS.filter}
                    fmt={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`} onChange={setFilterFreq} />
                  <Knob label="Q" value={filterQ} min={0.1} max={20} step={0.1} color={FX_COLORS.filter}
                    fmt={v => v.toFixed(1)} onChange={setFilterQ} />
                </>)}

                {card("COMPRESSOR", FX_COLORS.comp, 210, <>
                  <Knob label="THRESH" value={compThreshold} min={-60} max={0} step={1} color={FX_COLORS.comp}
                    fmt={v => v === 0 ? "OFF" : `${v} dB`} onChange={setCompThreshold} />
                  <Knob label="RATIO" value={compRatio} min={1} max={20} step={0.5} color={FX_COLORS.comp}
                    fmt={v => v === 1 ? "OFF" : `${v.toFixed(1)}:1`} onChange={setCompRatio} />
                  <Knob label="ATTACK" value={compAttack} min={0} max={1} step={0.001} color={FX_COLORS.comp}
                    fmt={v => `${(v * 1000).toFixed(0)}ms`} onChange={setCompAttack} />
                  <Knob label="RELEASE" value={compRelease} min={0.01} max={1} step={0.01} color={FX_COLORS.comp}
                    fmt={v => `${(v * 1000).toFixed(0)}ms`} onChange={setCompRelease} />
                </>)}
              </div>

              {/* Row 2: Delay · Chorus · Distortion */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {card("DELAY", FX_COLORS.delay, 200, <>
                  <Knob label="TIME" value={delayTime} min={0} max={1} step={0.01} color={FX_COLORS.delay}
                    fmt={v => v === 0 ? "OFF" : `${(v * 1000).toFixed(0)}ms`} onChange={setDelayTime} />
                  <Knob label="FDBK" value={delayFeedback} min={0} max={0.9} step={0.01} color={FX_COLORS.delay}
                    fmt={v => `${(v * 100).toFixed(0)}%`} onChange={setDelayFeedback} />
                </>)}

                {card("CHORUS", FX_COLORS.chorus, 200, <>
                  <Knob label="RATE" value={chorusRate} min={0.1} max={10} step={0.1} color={FX_COLORS.chorus}
                    fmt={v => `${v.toFixed(1)} Hz`} onChange={setChorusRate} />
                  <Knob label="DEPTH" value={chorusDepth} min={0} max={20} step={0.5} color={FX_COLORS.chorus}
                    fmt={v => v === 0 ? "OFF" : `${v.toFixed(1)}ms`} onChange={setChorusDepth} />
                  <Knob label="MIX" value={chorusMix} min={0} max={1} step={0.01} color={FX_COLORS.chorus}
                    fmt={v => `${(v * 100).toFixed(0)}%`} onChange={setChorusMix} />
                </>)}

                {card("DISTORTION", FX_COLORS.dist, 160, <>
                  <Knob label="DRIVE" value={distortion} min={0} max={1} step={0.01} color={FX_COLORS.dist}
                    fmt={v => v === 0 ? "OFF" : `${(v * 100).toFixed(0)}%`} onChange={setDistortion} />
                </>)}
              </div>

              {/* Row 3: Tremolo · Reverb · Pan */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {card("TREMOLO", FX_COLORS.tremolo, 200, <>
                  <Knob label="RATE" value={tremoloRate} min={0.5} max={20} step={0.5} color={FX_COLORS.tremolo}
                    fmt={v => `${v.toFixed(1)} Hz`} onChange={setTremoloRate} />
                  <Knob label="DEPTH" value={tremoloDepth} min={0} max={1} step={0.01} color={FX_COLORS.tremolo}
                    fmt={v => v === 0 ? "OFF" : `${(v * 100).toFixed(0)}%`} onChange={setTremoloDepth} />
                </>)}

                {card("REVERB", FX_COLORS.reverb, 160, <>
                  <Knob label="MIX" value={reverbMix} min={0} max={1} step={0.01} color={FX_COLORS.reverb}
                    fmt={v => v === 0 ? "OFF" : `${(v * 100).toFixed(0)}%`} onChange={setReverbMix} />
                </>)}

                {card("STEREO PAN", FX_COLORS.pan, 180, <>
                  <Knob label="PAN" value={pan} min={-1} max={1} step={0.01} color={FX_COLORS.pan}
                    fmt={v => v === 0 ? "C" : v < 0 ? `L ${(Math.abs(v) * 100).toFixed(0)}` : `R ${(v * 100).toFixed(0)}`} onChange={setPan} />
                </>)}
              </div>
            </div>
          )}
        </div>

        {/* ── Jam Session / Recording bar ──────────────────────────────────── */}
        <div style={{
          background: SURFACE, borderRadius: 12, border: isRecording ? "1px solid rgba(248,113,113,0.4)" : `1px solid ${BORDER}`,
          padding: "14px 18px", marginTop: 16,
        }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: isRecording ? "#f87171" : MUTED, letterSpacing: "0.15em", marginBottom: 12 }}>
            JAM SESSION
            {isRecording && (
              <span style={{ marginLeft: 8, animation: "pulse-rec 1s infinite" }}>● RECORDING</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Mic toggle */}
            {sBtn(micActive ? "🎤 MIC ON" : "🎤 MIC", micActive, "#f87171", toggleMic, false)}

            {/* Record / Stop */}
            {!isRecording ? (
              <button onClick={startRecording} style={{
                padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.4)",
                background: "rgba(248,113,113,0.12)", color: "#f87171",
                fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", display: "inline-block" }} />
                REC
              </button>
            ) : (
              <button onClick={stopRecording} style={{
                padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.6)",
                background: "rgba(248,113,113,0.2)", color: "#f87171",
                fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer",
                animation: "pulse-rec 1s infinite",
              }}>⏹ STOP</button>
            )}

            {/* Timer */}
            {(isRecording || recordingUrl) && (
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: isRecording ? "#f87171" : TEXT, minWidth: 80 }}>
                {fmtTime(recordingTime / 1000)}
              </span>
            )}

            <div style={{ width: 1, height: 28, background: BORDER, margin: "0 4px" }} />

            {/* Preview / Download / Send */}
            {recordingUrl && !isRecording && (
              <>
                <audio controls src={recordingUrl} style={{ height: 32, maxWidth: 200 }} />
                <a href={recordingUrl} download={`jam_${Date.now()}.webm`}
                  style={{
                    padding: "7px 14px", borderRadius: 7, background: "rgba(124,108,250,0.15)",
                    border: `1px solid ${ACCENT2}`, color: ACCENT2, textDecoration: "none",
                    fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em",
                  }}>⬇ DOWNLOAD</a>
                {sBtn("📤 SEND TO STREAMLIT", false, ACCENT, sendRecording, false)}
              </>
            )}

            {!recordingUrl && !isRecording && (
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: MUTED }}>
                Hit REC to capture your jam with all effects applied
              </span>
            )}
          </div>
        </div>

        {/* ── Trim controls ───────────────────────────────────────────────── */}
        <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: "16px 18px", marginTop: 12 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: MUTED, letterSpacing: "0.15em", marginBottom: 12 }}>TRIM REGION</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ACCENT }} />
              <label style={{ color: MUTED, fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.1em" }}>IN</label>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: ACCENT }}>{fmtTime(trimStart)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b" }} />
              <label style={{ color: MUTED, fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.1em" }}>OUT</label>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#f59e0b" }}>{fmtTime(trimEnd)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ color: MUTED, fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.1em" }}>DURATION</label>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: TEXT }}>{fmtTime(trimDuration)}</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              {sBtn("RESET", false, MUTED, () => { setTrimStart(0); setTrimEnd(duration); }, !audioBuffer)}
              <button onClick={handleExport} disabled={!audioBuffer} style={{
                background: audioBuffer ? "rgba(124,108,250,0.15)" : "rgba(255,255,255,0.03)",
                border: audioBuffer ? `1px solid ${ACCENT2}` : `1px solid ${BORDER}`,
                borderRadius: 7, color: audioBuffer ? ACCENT2 : MUTED, padding: "7px 18px",
                cursor: audioBuffer ? "pointer" : "not-allowed",
                fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em",
              }}>EXPORT TRIM</button>
            </div>
          </div>
        </div>

        {/* ── Export result ────────────────────────────────────────────────── */}
        {exportData && (
          <div style={{ background: "rgba(124,108,250,0.08)", border: "1px solid rgba(124,108,250,0.25)", borderRadius: 12, padding: "14px 18px", marginTop: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: ACCENT2, flex: 1 }}>{exportMsg}</span>
            <audio controls src={exportData} style={{ height: 32 }} />
            <a href={exportData} download={`trim_${fileName || "audio.wav"}`}
              style={{ background: ACCENT2, color: "white", borderRadius: 7, padding: "7px 16px", textDecoration: "none", fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "0.08em" }}>
              DOWNLOAD
            </a>
          </div>
        )}

        {/* ── Instructions (when no file loaded) ──────────────────────────── */}
        {!audioBuffer && (
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              ["🎵", "Load any audio file", "MP3, WAV, OGG, M4A — anything your browser can decode"],
              ["🎤", "Or use your mic", "Click MIC to route live audio through the effects chain"],
              ["🎛️", "Tweak effects", "EQ, filter, compressor, delay, chorus, distortion, tremolo, reverb, pan"],
              ["⏺", "Record your jam", "Hit REC to capture effected audio, then download or send to Streamlit"],
              ["✂️", "Drag to trim", "Grab the green (in) or amber (out) handles on the waveform"],
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
  view.setUint16(20, 1, true); // PCM
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
