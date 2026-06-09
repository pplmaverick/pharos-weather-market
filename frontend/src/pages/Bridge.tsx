import { useState } from 'react'

const SOURCE_CHAINS = [
  { id: 'ethereum', label: 'Ethereum', icon: 'link' },
  { id: 'base', label: 'Base', icon: 'link' },
  { id: 'polygon', label: 'Polygon', icon: 'link' },
]

export default function Bridge() {
  const [sourceChain, setSourceChain] = useState('ethereum')
  const [amount, setAmount] = useState('')

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-white tracking-tight mb-2">
          Bridge USDC to Pharos
        </h1>
        <p className="text-[rgba(255,255,255,0.5)] text-sm">
          Move USDC from any supported chain to Pharos Mainnet via Circle CCTP
        </p>
      </div>

      <div className="glass-card rounded-2xl p-8 space-y-6">
        {/* Source Chain */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-[rgba(255,255,255,0.4)] mb-3">
            Source Chain
          </label>
          <div className="grid grid-cols-3 gap-3">
            {SOURCE_CHAINS.map((chain) => (
              <button
                key={chain.id}
                onClick={() => setSourceChain(chain.id)}
                className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl border transition-all duration-200 ${
                  sourceChain === chain.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.25)] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{chain.icon}</span>
                <span className="font-display text-sm font-semibold">{chain.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-[rgba(255,255,255,0.4)] mb-3">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-4 font-display text-2xl text-white placeholder-[rgba(255,255,255,0.2)] outline-none focus:border-primary/50 transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm text-primary font-semibold">
              USDC
            </span>
          </div>
        </div>

        {/* Destination */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-[rgba(255,255,255,0.4)] mb-3">
            Destination
          </label>
          <div className="flex items-center gap-3 py-4 px-4 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-tertiary opacity-80 shrink-0" />
            <div>
              <p className="font-display text-sm font-semibold text-white">Pharos Mainnet</p>
              <p className="text-[10px] font-mono text-[rgba(255,255,255,0.4)]">Chain ID 1672 · Circle-native USDC</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse-dot" />
              <span className="text-[10px] font-mono text-tertiary uppercase">Fixed</span>
            </div>
          </div>
        </div>

        {/* Bridge Button */}
        <button
          disabled
          className="w-full py-4 rounded-xl font-display text-base font-semibold border border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.03)] cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-xl">schedule</span>
          Bridge USDC — Coming Soon
        </button>

        {/* Footer */}
        <div className="pt-2 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-[rgba(255,255,255,0.3)]">verified</span>
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)] uppercase tracking-wider">
              Powered by Circle CCTP
            </span>
          </div>
          <span className="text-[rgba(255,255,255,0.15)]">·</span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-[rgba(255,255,255,0.3)]">hub</span>
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)] uppercase tracking-wider">
              Chainlink CCIP
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
