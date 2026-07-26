import { contextBridge } from 'electron'

// Privileged APIs are added here deliberately as PageMaker features need them.
// The dashboard receives no filesystem, shell, Git, credential, or Electron API.
contextBridge.exposeInMainWorld('pageMaker', Object.freeze({}))
