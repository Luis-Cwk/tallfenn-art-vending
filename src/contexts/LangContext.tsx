import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { STRINGS, type Lang, type Strings } from '@/lib/i18n'

const STORAGE_KEY = 'tallfenn_lang'

function readLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'es' || v === 'fr') return v
  } catch { /* ignore */ }
  return 'en'
}

interface LangCtx {
  lang: Lang
  t: Strings
  setLang: (l: Lang) => void
  toggle: () => void
}

const LangContext = createContext<LangCtx>({
  lang: 'en',
  t: STRINGS.en,
  setLang: () => {},
  toggle: () => {},
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
  }, [])

  const toggle = useCallback(() => {
    setLang(lang === 'en' ? 'es' : lang === 'es' ? 'fr' : 'en')
  }, [lang, setLang])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, t: STRINGS[lang], setLang, toggle }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() { return useContext(LangContext) }
