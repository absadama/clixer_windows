/**
 * Clixer - Çeviri Hook'u
 * useTranslation hook'u ile çevirilere erişim
 */

import { useMemo } from 'react'
import { translations, Language, Translations } from './translations'
import { useSettingsStore } from '../stores/settingsStore'

export function useTranslation() {
  const { defaultLanguage } = useSettingsStore()
  
  const currentLanguage: Language = defaultLanguage || 'tr'
  
  const t = useMemo(() => translations[currentLanguage], [currentLanguage])
  
  // Dinamik çeviri fonksiyonu (nested key desteği: "menu.dashboard")
  const translate = (key: string, fallback?: string): string => {
    const keys = key.split('.')
    let value: any = t
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return fallback || key
      }
    }
    
    return typeof value === 'string' ? value : fallback || key
  }
  
  return {
    t,
    translate,
    currentLanguage,
    isEnglish: currentLanguage === 'en',
    isTurkish: currentLanguage === 'tr',
  }
}

// Export types
export type { Language, Translations }




