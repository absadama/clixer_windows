/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_TITLE: string
  // Diğer env değişkenleri buraya eklenebilir
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

