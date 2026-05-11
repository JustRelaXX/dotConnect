# dotConnect 🚀

[![CI](https://github.com/JustRelaXX/dotConnect/actions/workflows/ci.yml/badge.svg)](https://github.com/JustRelaXX/dotConnect/actions/workflows/ci.yml)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)

**dotConnect** is a lightweight, decentralized desktop messenger built for small groups (up to 10 people). It focuses on privacy, performance, and a Discord-like user experience, powered by a high-performance Rust backend and a modern React frontend.

## 🌟 Key Features

- **Decentralized P2P Mesh:** No central server. One user hosts the room, and others connect directly via IP.
- **Voice Channels:** High-quality voice communication powered by WebRTC (P2P).
- **Screen Sharing:** Share your screen with friends with low latency.
- **Persistent Chat:** Local storage using SQLite for message history.
- **Modern UI:** A sleek, dark-themed interface inspired by Discord, built with vanilla CSS for maximum speed and flexibility.
- **Tauri Powered:** native performance with a tiny binary size compared to Electron.

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Zustand (State Management).
- **Backend:** Rust, Tauri v2.
- **Networking:** WebSockets (Signaling), WebRTC (Voice/Video P2P).
- **Database:** SQLite (bundled within the Rust binary).

## 🏗 Architecture

Unlike many Tauri projects that act as simple wrappers, **dotConnect** utilizes the Rust backend for heavy lifting:
1. **P2P Node:** The host machine runs a WebSocket server that acts as a signaling node for WebRTC.
2. **Persistence:** All messages are handled by an asynchronous Rust actor system and stored in a local SQLite database.
3. **Security:** Native capabilities are restricted via Tauri's allowlist to ensure user safety.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Dependencies](https://tauri.app/v1/guides/getting-started/prerequisites)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/JustRelaXX/dotConnect.git
   cd dotConnect
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

### Building for Release
To create a lightweight standalone executable:
```bash
npm run tauri build
```
The binary will be located in `src-tauri/target/release/`.

## 🛡 Security

- **No Data Harvesting:** Your data never leaves your network.
- **Tauri Isolation:** Frontend is restricted from accessing sensitive system APIs unless explicitly allowed.
- **No Analytics:** We don't track you.

## 📜 License

MIT License. See `LICENSE` for more details.

---
Created with ❤️ by [JustRelaXX](https://github.com/JustRelaXX)
