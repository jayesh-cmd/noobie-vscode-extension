# noobie

A tiny VS Code companion that reacts to your coding state with cute blob faces.

![noobie](./faces/happy_blush_face.PNG)

---

## What it does

| State | Trigger | Face |
|---|---|---|
| **happy** | No errors in workspace | 😊 happy blush |
| **focus** | You're actively typing | 🎯 big eyes |
| **error** | 1–2 errors detected | 😵 x_x face |
| **many errors** | 3+ errors | 🌀 spinning out |
| **zzz** | 50 seconds of no activity | 💤 sleeping |

noobie is smart about priority — while you're typing it stays in **focus** mode and only checks for errors **1.5 seconds after you stop**, so it never flickers mid-sentence.

---

## Install

### Option A — From VSIX (quickest)

1. Download `noobie-1.0.0.vsix` from the [Releases](../../releases) page
2. In VS Code / Antigravity IDE:
   - `Cmd+Shift+P` → **Extensions: Install from VSIX...**
   - Pick the downloaded file

Or via terminal:
```bash
code --install-extension noobie-1.0.0.vsix
```

### Option B — Build from source

```bash
git clone https://github.com/jayesh-cmd/noobie-vscode-extension.git
cd noobie-vscode-extension
npm install
npm run compile
```

Then press **F5** in VS Code to launch a development host with noobie running.

To build your own `.vsix`:
```bash
npm install -g @vscode/vsce
vsce package --allow-missing-repository
code --install-extension noobie-1.0.0.vsix
```

---

## Usage

- noobie **auto-opens** in a panel when VS Code starts
- Click **`noobie`** in the bottom-right status bar to reopen it anytime
- `Cmd+Shift+P` → **noobie: Show** to bring it back

---

## Works with

- ✅ VS Code
- ✅ Antigravity IDE
