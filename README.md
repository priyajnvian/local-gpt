# Local GPT

A Chrome extension that runs a real language model **entirely inside your browser**. No API key, no server, no network call once it's installed. Qwen2.5-0.5B-Instruct runs on WebGPU via [WebLLM](https://github.com/mlc-ai/web-llm), with the weights shipped inside the extension itself.

Turn off your wifi and it still answers.

---

## The interesting part

WebLLM expects to fetch model weights from the HuggingFace CDN at runtime. A Chrome extension can't do that — Manifest V3's Content Security Policy blocks remote code and remote fetches, and you don't want a "local" AI tool phoning home anyway.

So the extension **intercepts `fetch` before WebLLM ever reaches the network** and reroutes every model request to files bundled in the extension ([`chat.js:9-32`](chat.js)):

```js
const originalFetch = window.fetch;
window.fetch = function(url, options) {
    if (url && url.includes('huggingface.co') && url.includes('Qwen2.5-0.5B-Instruct-q4f16_1-MLC')) {
        const filename = url.split('/').pop();
        const localUrl = chrome.runtime.getURL(`models/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/${filename}`);
        return originalFetch(localUrl, options);
    }
    // ...same for ndarray-cache.json and tensor-cache.json
    return originalFetch(url, options);
};
```

WebLLM is none the wiser. It thinks it's talking to HuggingFace; it's reading from `chrome-extension://`. The model loads, WebGPU compiles the shaders, and inference runs on your GPU.

The weights are exposed to the page through `web_accessible_resources` in the manifest, and `'wasm-unsafe-eval'` is granted in the CSP so WebLLM's WebAssembly runtime can initialise.

## Three entry points

The same chat engine is wired into three surfaces, which is why there are three near-identical scripts:

| Page | Script | What it's for |
|---|---|---|
| `popup.html` | `chat.js` | The toolbar popup — click the icon and chat |
| `webpage.html` | `extension-webpage.js` | Full-tab chat inside the extension |
| `server.html` | `server-chat.js` | Served over `http://localhost` instead of `chrome-extension://` |

The `server.html` path exists because WebGPU and large-model loading behave differently across origins, and having an HTTP-origin version made debugging the loading pipeline much easier.

## Install

**1. Get the model weights.** They're 275MB and not in this repo. Download the MLC build of Qwen2.5-0.5B-Instruct from HuggingFace:

```bash
git lfs install
git clone https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC \
  "models/Qwen2.5-0.5B-Instruct-q4f16_1-MLC"
```

You should end up with `params_shard_0.bin` through `params_shard_7.bin`, plus `mlc-chat-config.json`, `ndarray-cache.json`, `tensor-cache.json`, `tokenizer.json`, `tokenizer_config.json`, and `vocab.json` in that folder. The fetch interceptor matches on filename, so the directory name must be exactly `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`.

**2. Load the extension.**

- Open `chrome://extensions/`
- Turn on **Developer mode**
- **Load unpacked** → select this folder

**3. Click the icon.** First load compiles WebGPU shaders and takes a while — progress shows in the popup. After that it's cached.

## Requirements

- Chrome 113+ (WebGPU)
- A GPU that WebGPU supports. Apple Silicon is comfortable; so is any reasonably recent discrete GPU.
- ~1GB free for weights plus shader cache

## Known limitations

- **Qwen2.5-0.5B is a 0.5-billion-parameter model.** It's quick and it's genuinely private, but it is not GPT-4. Expect short, simple answers and occasional nonsense. The point of this project is the plumbing, not the intelligence.
- **No conversation persistence.** Close the popup and the history is gone.
- **`webllm.js` is vendored** (6MB, prebuilt). MV3's CSP forbids loading it from a CDN, so it has to sit in the repo. Updating WebLLM means swapping the file by hand.
- **The three chat scripts are near-duplicates.** They should share a module. They don't yet.
- **First load is slow** — shader compilation on a cold cache can take a minute or more, and the UI only shows WebLLM's raw progress text.
- **WebGPU only.** No WASM-CPU fallback, so machines without WebGPU just fail to load.

## Credits & licenses

MIT licensed — see [LICENSE](LICENSE).

- **[WebLLM](https://github.com/mlc-ai/web-llm)** / MLC LLM — Apache-2.0 (`webllm.js` is a prebuilt bundle)
- **[Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)** — Alibaba Cloud, Apache-2.0. MLC-compiled build from [mlc-ai](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC).
