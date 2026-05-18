export type PickerMode = 'none' | 'component'

export interface ToolbarProps {
  onScreenshotRequest: () => void
  pickerActive: PickerMode
  setPickerActive: (m: PickerMode) => void
}

const btnStyle: React.CSSProperties = {
  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
}
const activeStyle: React.CSSProperties = { ...btnStyle, background: '#0284c7', borderColor: '#0284c7' }

export function Toolbar({ onScreenshotRequest, pickerActive, setPickerActive }: ToolbarProps) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: 6, background: '#000000', borderBottom: '1px solid #1e293b' }}>
      <button style={pickerActive === 'component' ? activeStyle : btnStyle}
        onClick={() => setPickerActive(pickerActive === 'component' ? 'none' : 'component')}>
        Pick Component
      </button>
      <button style={btnStyle} onClick={onScreenshotRequest}>
        Screenshot
      </button>
    </div>
  )
}
