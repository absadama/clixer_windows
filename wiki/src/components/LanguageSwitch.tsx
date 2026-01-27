import clsx from 'clsx'
import { useLanguage } from '../hooks/useLanguage'

export default function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-1 bg-dark-card border border-dark-border rounded-lg p-1">
      <button
        onClick={() => setLanguage('tr')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          language === 'tr'
            ? 'bg-primary-500 text-white'
            : 'text-gray-400 hover:text-white'
        )}
      >
        <span>TR</span>
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          language === 'en'
            ? 'bg-primary-500 text-white'
            : 'text-gray-400 hover:text-white'
        )}
      >
        <span>EN</span>
      </button>
    </div>
  )
}
