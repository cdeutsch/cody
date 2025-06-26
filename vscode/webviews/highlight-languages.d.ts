// Type declarations for highlight.js individual language modules
declare module 'highlight.js/lib/languages/*' {
    import type { LanguageDetail } from 'highlight.js'
    const language: LanguageDetail
    export default language
}
