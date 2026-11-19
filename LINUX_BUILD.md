# Build and install Onlook on Linux

A source build runs locally without an Onlook account, cloud keys or an `.env` file. To chat, connect your own Claude Code or Codex account during setup.

Linux builds are unsigned. They install and run on your own machine; they are not a trusted download for other people.

## What you get

`bun run build:linux` writes two installers to `release/`, for this machine's architecture (`x64` or `arm64`). Build on the machine you will run it on: the native `node-pty` module is compiled for the build host and does not cross-compile.

| Artifact | Use |
|---|---|
| `Onlook-Source-<version>-amd64.deb` (x64) or `-arm64.deb` | Recommended on Ubuntu and Debian. Its post-install script registers the AppArmor profile Ubuntu 24.04 needs to run an Electron app inside its sandbox. |
| `Onlook-Source-<version>-x86_64.AppImage` (x64) or `-arm64.AppImage` | Portable, no install. Needs FUSE (`libfuse2t64` on Ubuntu 24.04, `libfuse2` on 22.04) and, on Ubuntu 24.04, either an AppArmor profile or `--no-sandbox`. |

## Prerequisites

- Ubuntu 22.04 or later, Debian 12 or later, or a distribution that provides the Electron 43 runtime libraries. Ubuntu 24.04 is the tested target.
- Git, Node.js 24, and Bun 1.4.2 on `PATH`. Node is needed by the packaging tools even though Bun runs the build scripts.
- A C toolchain and Python 3, which `node-pty` compiles against.
- Internet access to download dependencies and connect your coding agent.

```sh
sudo apt install -y git curl build-essential python3
```

Install Node 24 with your version manager of choice, then Bun:

```sh
curl -fsSL https://bun.sh/install | bash
```

Check the tools with `git --version`, `node --version` and `bun --version`.

## Build

```sh
git clone https://github.com/onlook-dev/onlook.git
cd onlook
bun install --frozen-lockfile --cpu='*'
bun run build:linux
```

Every checkout, including a Git worktree, needs its own install.

For the unpacked app only, without installers (faster loop while changing main-process code):

```sh
bun run build:linux:dir
./release/linux-unpacked/onlook-source        # x64
./release/linux-arm64-unpacked/onlook-source  # arm64
```

## Install and run

Install the deb, which adds the application menu entry and the `onlook-source` command:

```sh
sudo apt install ./release/Onlook-Source-*-amd64.deb   # x64
sudo apt install ./release/Onlook-Source-*-arm64.deb   # arm64
onlook-source
```

Or run the AppImage directly:

```sh
chmod +x release/Onlook-Source-*.AppImage
./release/Onlook-Source-*.AppImage
```

On Ubuntu 24.04 the AppImage may stop at the Chromium sandbox. Install the FUSE runtime first (`sudo apt install libfuse2t64`; on 22.04 the package is `libfuse2`), and if the kernel still refuses an unprivileged user namespace, run it with `--no-sandbox` or use the deb instead. Without FUSE at all, `--appimage-extract-and-run` unpacks and runs it in one step. The deb is the smoother path.

## Run from source

```sh
bun dev
```

If Electron refuses to start because the sandbox helper is not set up for a development build, give it the permissions Chromium expects:

```sh
sudo chown root apps/studio/node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 apps/studio/node_modules/electron/dist/chrome-sandbox
```

Running as root, or inside a container without user namespaces, needs `--no-sandbox` as well.

## Where it keeps data

- App data and settings: `~/.config/Onlook Source`
- Downloaded Codex runtime: `~/.cache/onlook-studio` (or `$XDG_CACHE_HOME/onlook-studio`)
- Logs: inside the app data directory

Removing the deb leaves that data in place. Delete those directories to start clean.

## Separate from official Onlook

The source build uses bundle ID `com.onlook.studio.source` and product name `Onlook Source`. It does not read official Onlook data or install its updates. To update, pull the repository, install dependencies again, and rerun `bun run build:linux`.

## Usage data

Source builds ask before sending usage data. Choose **Yes, share usage data** to share usage events and basic device information, or **Don't share** to continue without sharing. Change the answer in **Settings → Global → Privacy → Share usage data**. To leave telemetry out of the build entirely, run `STUDIO_TELEMETRY=0 bun run build:linux`.
