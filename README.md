# streamlit-audio-editor

A browser-based audio editor component for Streamlit. Load any audio file, visualize the waveform, trim with draggable handles, adjust gain, loop a region, and export a clean WAV — all client-side via the Web Audio API, no ffmpeg or server processing required.

![Audio editor screenshot](https://raw.githubusercontent.com/yourusername/streamlit-audio-editor/main/docs/screenshot.png)

## Features

- Waveform rendering from raw PCM via Web Audio API `decodeAudioData`
- Draggable IN/OUT trim handles directly on the waveform canvas
- Click-to-seek, live animated playhead
- Loop mode with correct `loopStart` / `loopEnd` on the AudioBufferSourceNode
- Zoom (scroll wheel or ±) + horizontal scrollbar for long files
- Gain slider — live update via GainNode, no re-render
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

if result:
    st.success(
        f"Trimmed {result['trimStart']:.2f}s → {result['trimEnd']:.2f}s "
        f"({result['trimEnd'] - result['trimStart']:.2f}s)"
    )
    wav_bytes = base64.b64decode(result["wavBase64"])
    st.audio(wav_bytes, format="audio/wav")
    st.download_button("Download trimmed WAV", wav_bytes, "trimmed.wav", "audio/wav")
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

**Returns** `dict` on export:

```python
{
    "trimStart": float,   # trim in-point, seconds
    "trimEnd":   float,   # trim out-point, seconds
    "duration":  float,   # total file duration, seconds
    "gain":      float,   # gain multiplier (0.0 – 2.0)
    "wavBase64": str,     # base64-encoded 16-bit PCM WAV of the trimmed region
}
```

Returns `None` before the user clicks Export.

## Development

```bash
git clone https://github.com/yourusername/streamlit-audio-editor
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
