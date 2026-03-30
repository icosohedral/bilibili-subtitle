interface MethodContext {
  from: 'extension' | 'inject' | 'app'
  event: any
  tabId?: number
}

interface EnvData {
  theme?: 'light' | 'dark'
}

interface Transcript {
  body: TranscriptItem[]
}

interface TranscriptItem {
  from: number
  to: number
  content: string
  idx: number
}

interface AiDetectSettings {
  enabled: boolean
  apiUrl: string
  apiKey: string
  model: string
  detailedExplanation: boolean
  autoDetect: boolean
  showSubtitles: boolean
}

interface AiDetectDetailItem {
  name: string
  score: number
  judgement: string
}

interface AiDetectResult {
  isClickbaitStyle: boolean
  score: number
  confidence: number
  summary: string
  reasons: string[]
  details: AiDetectDetailItem[]
}
