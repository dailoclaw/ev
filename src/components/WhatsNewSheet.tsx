import Modal from './Modal'
import { CHANGELOG } from '../lib/changelog'

export default function WhatsNewSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="What's new" onClose={onClose}>
        <div className="handle" />
        <b style={{ fontSize: 17, fontWeight: 800 }}>What's new</b>
        <p style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600, marginTop: 4, marginBottom: 14 }}>
          Every release, kept somewhere other than memory.
        </p>

        {CHANGELOG.map(entry => (
          <div key={entry.version} className="changerow">
            <div className="ver">
              v{entry.version} · {entry.date}
            </div>
            {entry.notes.map((note, i) => (
              <p key={i}>{note}</p>
            ))}
          </div>
        ))}
    </Modal>
  )
}
