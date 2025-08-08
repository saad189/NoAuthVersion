# Multi-View Browser

An Electron application for creating and managing multiple browser views (BrowserViews) with synchronized scrolling.

## Features

- Selection window with modern interface and shooting star animations
- Game mode configuration (multiplayer: 5 views per row, warzone: 4 views per row)
- Selection of number of views (1-44)
- Creation of BrowserViews with adaptive layout
- Synchronized scrolling between all views
- Independent browser sessions for each view

## Prerequisites

- Node.js (v14+)
- npm or yarn

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Usage

To start the application in development mode:

```bash
npm run dev
```

To start the application in production mode:

```bash
npm start
```

## Project Structure

```
├── src/
│   ├── main/           # Main process (Electron)
│   │   ├── main.js     # Entry point
│   │   ├── selectionWindow.js  # Selection window
│   │   ├── mainViewWindow.js   # Main window with BrowserViews
│   │   ├── preload.js  # Preload script for IPC
│   │   └── viewPreload.js # Preload for BrowserViews
│   │
│   └── renderer/       # Renderer process (UI)
│       ├── css/        # CSS styles
│       ├── js/         # JavaScript scripts
│       ├── assets/     # Images and resources
│       ├── selection.html  # Selection page
│       └── main.html   # Main page
│
├── package.json
└── README.md
```

## Customization

- Modify HTML pages in `src/renderer/`
- Customize styles in `src/renderer/css/`
- Add features in JS scripts

## License

ISC License 