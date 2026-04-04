# streamlit-audio-editor

A browser-based audio editor and jam-session recorder for Streamlit. Load any audio file, route your microphone through a full effects rack, tweak parameters in real time, and record the effected output — all client-side via the Web Audio API, no ffmpeg or server processing required.

![Audio editor screenshot](https://raw.githubusercontent.com/RhythrosaLabs/streamlit-audio-editor/main/screenshot.png)

## Features

- **Waveform** rendering from raw PCM via Web Audio API `decodeAudioData`
- Draggable IN/OUT **trim handles** directly on the waveform canvas
- Click-to-seek, live animated playhead
- Loop mode with correct `loopStart` / `loopEnd` on the AudioBufferSourceNode
- Zoom (scroll wheel or ±) + horizontal scrollbar for long files
- **Full effects rack** — all real-time, no playback restart:
  - **3-Band EQ** (low shelf · mid peak · high shelf)
  - **Filter** (lowpass / highpass / bandpass / notch) with frequency + resonance
  - **Compressor** (threshold, ratio, attack, release)
  - **Delay** with feedback loop
  - **Chorus** (LFO-modulated delay, rate + depth + mix)
  - **Distortion** (waveshaper overdrive)
  - **Tremolo** (LFO amplitude modulation, rate + depth)
  - **Reverb** (convolution with synthetic impulse response)
  - **Stereo Pan**
  - **Speed / Pitch** (tape-style playback rate)
  - **Gain** control
- **Microphone input** — route live mic audio through the entire effects chain
- **Jam Session recording** — capture the effected output (file + mic) via MediaRecorder, then preview, download, or send to Streamlit
- Export: slices raw PCM, encodes 16-bit WAV in the browser, previews inline, provides download
- Supports MP3, WAV, OGG, M4A, FLAC — anything the browser can decode
- Zero server-side dependencies (no ffmpeg, no pydub)

## Installation

```bash
pip install streamlit-audio-editor
```

## Quickstart

```python
import base64
import streamlit as st
from streamlit_audio_editor import st_audio_editor

st.title("Audio Editor")

result = st_audio_editor(key="editor")

if result and result.get("type") == "export":
    st.success(
        f"Trimmed {result['trimStart']:.2f}s → {result['trimEnd']:.2f}s "
        f"({result['trimEnd'] - result['trimStart']:.2f}s)"
    )
    wav_bytes = base64.b64decode(result["wavBase64"])
    st.audio(wav_bytes, format="audio/wav")
    st.download_button("Download trimmed WAV", wav_bytes, "trimmed.wav", "audio/wav")

if result and result.get("type") == "recording":
    audio_bytes = base64.b64decode(result["recordingBase64"])
    st.audio(audio_bytes, format=result["mimeType"])
    st.download_button("Download recording", audio_bytes, "jam.webm", result["mimeType"])
```

### Pre-loading a file

```python
# Load from a URL
result = st_audio_editor(audio_url="https://example.com/sample.mp3", key="editor")

# Load from a local file via data URI
with open("sample.wav", "rb") as f:
    import base64
    b64 = base64.b64encode(f.read()).decode()
result = st_audio_editor(audio_url=f"data:audio/wav;base64,{b64}", key="editor")
```

## API

```python
st_audio_editor(audio_url=None, key=None)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `audio_url` | `str \| None` | URL or data-URI to pre-load |
| `key` | `str` | Streamlit widget key |

**Returns** `dict` on export or recording:

```python
# On Export Trim (type="export"):
{
    "type":      "export",
    "trimStart": float,   # trim in-point, seconds
    "trimEnd":   float,   # trim out-point, seconds
    "duration":  float,   # total file duration, seconds
    "gain":      float,   # gain multiplier (0.0 – 2.0)
    "wavBase64": str,     # base64-encoded 16-bit PCM WAV of the trimmed region
    # … plus all current effect parameters (eqLow, filterFreq, delayTime, etc.)
}

# On Send Recording (type="recording"):
{
    "type":            "recording",
    "mimeType":        str,    # e.g. "audio/webm;codecs=opus"
    "recordingBase64": str,    # base64-encoded audio blob
    "durationSec":     float,  # recording length in seconds
}
```

Returns `None` before the user clicks Export.

## Development

```bash
git clone https://github.com/RhythrosaLabs/streamlit-audio-editor
cd streamlit-audio-editor

cd streamlit_audio_editor/frontend
npm install
npm start   # dev server on :3002

# separate terminal
cd ../..
pip install -e .
# Set _RELEASE = False in streamlit_audio_editor/__init__.py
streamlit run example.py
```

## License

MIT
