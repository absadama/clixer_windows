import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../types/article'

interface LanguageState {
  language: Language
  setLanguage: (lang: Language) => void
  t: (tr: string, en: string) => string
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'tr',
      setLanguage: (lang) => set({ language: lang }),
      t: (tr, en) => get().language === 'tr' ? tr : en,
    }),
    {
      name: 'clixer-wiki-language',
    }
  )
)
