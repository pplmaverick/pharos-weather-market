import { ALL_MARKETS } from '../lib/wagmi'

const rounds = [
  { label: 'Round 1', ids: [0, 1, 2, 3] },
  { label: 'Round 2', ids: [4, 5, 7, 8] },
  { label: 'Round 3', ids: [9, 10, 11, 12] },
]

export default function MarketHistory() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', color: '#e2e8f0' }}>
        Market History
      </h1>

      {rounds.map(({ label, ids }) => (
        <div key={label} style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['Market', 'City', 'Buckets (°C)', 'Status', 'Final Temp'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#64748b', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ids.map(id => {
                const m = ALL_MARKETS[id]
                if (!m) return null
                return (
                  <tr key={id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#94a3b8' }}>#{id}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#e2e8f0', fontWeight: 500 }}>{m.city}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                      [{m.buckets.join(', ')}]
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: m.status === 'SETTLED' ? '#14532d' : '#1e3a5f',
                        color: m.status === 'SETTLED' ? '#4ade80' : '#60a5fa',
                      }}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#e2e8f0' }}>
                      {m.finalTemp !== undefined ? `${m.finalTemp}°C` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
