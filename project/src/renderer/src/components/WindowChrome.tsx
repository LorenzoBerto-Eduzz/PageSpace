import icon from '../../../../resources/icon.ico?url'

export function WindowChrome(): React.JSX.Element {
  return (
    <div className="window-titlebar" onDoubleClick={window.pageSpace.toggleMaximizeWindow}>
      <div className="window-titlebar-brand">
        <img src={icon} alt="" />
        <span>PageSpace</span>
      </div>
      <div className="window-titlebar-controls" onDoubleClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Minimizar" onClick={window.pageSpace.minimizeWindow}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 5.5h8" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Tela cheia ou restaurar"
          onClick={window.pageSpace.toggleMaximizeWindow}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1.5" y="1.5" width="7" height="7" />
          </svg>
        </button>
        <button
          type="button"
          className="window-titlebar-close"
          aria-label="Fechar"
          onClick={window.pageSpace.closeWindow}
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="m1.5 1.5 7 7m0-7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
