# SendIt

A modern, secure peer-to-peer file sharing application built with Tauri and React.

## Features

- Simple and intuitive user interface
- Fast peer-to-peer file transfers
- Cross-platform support (Windows, macOS, Linux)
- No file size limits
- No intermediary servers - direct device-to-device transfer

## Tech Stack

- **Frontend**: React
- **Backend**: Rust
- **Framework**: Tauri
- **Build Tool**: Vite

## Prerequisites

- Node.js (v16 or higher)
- Rust (latest stable)
- System dependencies for Tauri (see [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/frstycodes/sendit.git
   cd sendit
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run tauri dev
   ```

## Building

To create a production build:

```bash
npm run tauri build
```

The built applications will be available in the `src-tauri/target/release` directory.
