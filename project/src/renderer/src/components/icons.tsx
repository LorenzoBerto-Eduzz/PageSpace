type IconProps = {
  size?: number
}

function Icon({ children, size = 20 }: React.PropsWithChildren<IconProps>): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function SettingsIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function LockIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Icon>
  )
}

export function ArrowLeftIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M20 12H5" />
      <path d="m11 18-6-6 6-6" />
    </Icon>
  )
}

export function GripIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function MoveIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 3v18M3 12h18" />
      <path d="m8.5 6 3.5-3.5L15.5 6M8.5 18l3.5 3.5 3.5-3.5M6 8.5 2.5 12 6 15.5M18 8.5l3.5 3.5-3.5 3.5" />
    </Icon>
  )
}

export function EyeIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3 12s3.2-7 9-7 9 7 9 7-3.2 7-9 7-9-7-9-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function PencilIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      <path d="m14.7 6.5 2.8 2.8" />
    </Icon>
  )
}

export function SaveIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M5 3h12l2 2v16H5V3Z" />
      <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </Icon>
  )
}

export function WarningIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 4 3.5 20h17L12 4Z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  )
}

export function FolderIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3 6h7l2 2h9v11H3V6Z" />
    </Icon>
  )
}
