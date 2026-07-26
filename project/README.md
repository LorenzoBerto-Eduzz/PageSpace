# PageMaker desktop application

PageMaker is the local Electron application that manages local-only and explicitly published static websites. The first implementation milestone provides a secure desktop shell and static dashboard presentation only; it does not yet read files, persist pages, connect to GitHub, or publish content.

## Development

### Install dependencies

```bash
$ npm install
```

### Run the desktop app

```bash
$ npm run dev
```

### Validate

```bash
$ npm run lint
$ npm run typecheck
$ npm run build
```

### Packaging

The `build:win`, `build:mac`, and `build:linux` scripts are scaffold defaults. Do not create distributable artifacts until the repository delivery process is documented and explicitly authorized.

### Local review build

```bash
$ npm run build:unpack
```

This refreshes the stable review folder at `dist/win-unpacked/`. Close any running PageMaker review window first, then open `dist/win-unpacked/PageMaker.exe`. Copy the entire folder when sharing the review build with someone else.

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
