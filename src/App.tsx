import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {DEFAULT_USE_PORT, HEADER_HEIGHT, TOTAL_HEIGHT_DEF} from './consts/const'
import type {AllAPPMessages, AllExtensionMessages, AllInjectMessages} from './message-typings'
import {useMessaging, useMessagingService} from './message'
import {detectAiGeneratedTranscript, downloadFile, formatTimestamp, normalizeTranscript, transcriptToText} from './utils/subtitle'

type SubtitleInfo = {
  id: string
  lan_doc: string
  subtitle_url: string
}

const AI_DETECT_SETTINGS_KEY = 'bilibili-subtitle-ai-detect-settings'
const defaultAiDetectSettings: AiDetectSettings = {
  enabled: false,
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4.1-mini',
  detailedExplanation: false,
  autoDetect: false,
  showSubtitles: true,
}

const App = () => {
  const {sendInject} = useMessaging<AllExtensionMessages, AllInjectMessages>(DEFAULT_USE_PORT)
  const [title, setTitle] = useState('哔哩哔哩字幕')
  const [url, setUrl] = useState('')
  const [infos, setInfos] = useState<SubtitleInfo[]>([])
  const [currentInfo, setCurrentInfo] = useState<SubtitleInfo>()
  const [transcript, setTranscript] = useState<Transcript>()
  const [collapsed, setCollapsed] = useState(true)
  const [panelHeight, setPanelHeight] = useState(TOTAL_HEIGHT_DEF)
  const [currentTime, setCurrentTime] = useState(0)
  const [noVideo, setNoVideo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiDetectSettings, setAiDetectSettings] = useState<AiDetectSettings>(defaultAiDetectSettings)
  const [aiDetecting, setAiDetecting] = useState(false)
  const [aiDetectError, setAiDetectError] = useState('')
  const [aiDetectResult, setAiDetectResult] = useState<AiDetectResult | null>(null)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const lastAutoDetectKeyRef = useRef<string>('')
  const hasAutoExpandedRef = useRef(false)

  const methodsFunc = useCallback(() => ({
    SET_VIDEO_INFO: async (params: Extract<AllAPPMessages, { method: 'SET_VIDEO_INFO' }>['params']) => {
      const nextInfos = Array.isArray(params.infos) ? params.infos : []
      setTitle(params.title || '哔哩哔哩字幕')
      setUrl(params.url || '')
      setInfos(nextInfos)
      setCurrentInfo(prev => nextInfos.find((item: SubtitleInfo) => item.subtitle_url === prev?.subtitle_url) ?? nextInfos[0])
    },
    SET_INFOS: async (params: Extract<AllAPPMessages, { method: 'SET_INFOS' }>['params']) => {
      const nextInfos = Array.isArray(params.infos) ? params.infos : []
      setInfos(nextInfos)
      setCurrentInfo(prev => nextInfos.find((item: SubtitleInfo) => item.subtitle_url === prev?.subtitle_url) ?? nextInfos[0])
    },
  }), [])

  useMessagingService<AllAPPMessages>(DEFAULT_USE_PORT, methodsFunc)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AI_DETECT_SETTINGS_KEY)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw)
      setAiDetectSettings({
        enabled: Boolean(parsed.enabled),
        apiUrl: typeof parsed.apiUrl === 'string' && parsed.apiUrl ? parsed.apiUrl : defaultAiDetectSettings.apiUrl,
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
        model: typeof parsed.model === 'string' && parsed.model ? parsed.model : defaultAiDetectSettings.model,
        detailedExplanation: Boolean(parsed.detailedExplanation),
        autoDetect: Boolean(parsed.autoDetect),
        showSubtitles: parsed.showSubtitles !== false,
      })
    } catch (cause) {
      console.error(cause)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(AI_DETECT_SETTINGS_KEY, JSON.stringify(aiDetectSettings))
  }, [aiDetectSettings])

  const activeIndex = useMemo(() => {
    const items = transcript?.body ?? []
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (currentTime >= item.from && currentTime <= item.to) {
        return i
      }
      if (currentTime < item.from) {
        break
      }
    }
    return -1
  }, [currentTime, transcript])

  const refreshVideoInfo = useCallback(async (force: boolean) => {
    try {
      await sendInject(null, 'REFRESH_VIDEO_INFO', {force})
      const info = await sendInject(null, 'GET_VIDEO_ELEMENT_INFO', {})
      setNoVideo(Boolean(info?.noVideo))
      if (typeof info?.totalHeight === 'number') {
        setPanelHeight(info.totalHeight)
      }
    } catch (cause) {
      console.error(cause)
    }
  }, [sendInject])

  useEffect(() => {
    refreshVideoInfo(true).catch(console.error)
    const timer = window.setInterval(() => {
      refreshVideoInfo(false).catch(console.error)
    }, 1500)
    return () => {
      window.clearInterval(timer)
    }
  }, [refreshVideoInfo])

  useEffect(() => {
    const timer = window.setInterval(() => {
      sendInject(null, 'GET_VIDEO_STATUS', {}).then(status => {
        if (typeof status?.currentTime === 'number') {
          setCurrentTime(status.currentTime)
        }
      }).catch(() => {
        setCurrentTime(0)
      })
    }, 500)

    return () => {
      window.clearInterval(timer)
    }
  }, [sendInject])

  useEffect(() => {
    if (!currentInfo) {
      setTranscript(undefined)
      setAiDetectResult(null)
      setAiDetectError('')
      hasAutoExpandedRef.current = false
      return
    }

    if (currentInfo.subtitle_url === 'uploaded') {
      return
    }

    setLoading(true)
    setError('')
    sendInject(null, 'GET_SUBTITLE', {info: currentInfo}).then(data => {
      setTranscript(normalizeTranscript(data))
      setAiDetectResult(null)
      setAiDetectError('')
      hasAutoExpandedRef.current = false
    }).catch((cause: unknown) => {
      console.error(cause)
      setTranscript(undefined)
      setError('字幕获取失败')
    }).finally(() => {
      setLoading(false)
    })
  }, [currentInfo, sendInject])

  useEffect(() => {
    if (!hasAutoExpandedRef.current && (transcript?.body.length ?? 0) > 0) {
      hasAutoExpandedRef.current = true
      setCollapsed(false)
      sendInject(null, 'FOLD', {fold: false}).catch(console.error)
    }
  }, [sendInject, transcript])

  useEffect(() => {
    if (activeIndex < 0) {
      return
    }
    itemRefs.current[activeIndex]?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    })
  }, [activeIndex])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      sendInject(null, 'FOLD', {fold: next}).catch(console.error)
      return next
    })
  }, [sendInject])

  const onMove = useCallback((time: number) => {
    sendInject(null, 'MOVE', {time, togglePause: false}).catch(console.error)
  }, [sendInject])

  const onSelectInfo = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextInfo = infos.find(item => item.subtitle_url === event.target.value)
    setCurrentInfo(nextInfo)
  }, [infos])

  const onDownloadJson = useCallback(() => {
    if (!transcript) {
      return
    }
    downloadFile('bilibili-subtitle.json', JSON.stringify(transcript, null, 2), 'application/json;charset=utf-8')
  }, [transcript])

  const onDownloadTxt = useCallback(() => {
    if (!transcript) {
      return
    }
    downloadFile('bilibili-subtitle.txt', transcriptToText(transcript), 'text/plain;charset=utf-8')
  }, [transcript])

  const updateAiDetectSettings = useCallback((patch: Partial<AiDetectSettings>) => {
    setAiDetectSettings(prev => ({
      ...prev,
      ...patch,
    }))
  }, [])

  const runAiDetect = useCallback(() => {
    if (!aiDetectSettings.enabled) {
      setAiDetectError('请先在设置中启用内容检测')
      return
    }
    if (!transcript) {
      setAiDetectError('当前没有可用于检测的字幕内容')
      return
    }
    if (!aiDetectSettings.apiUrl.trim() || !aiDetectSettings.apiKey.trim() || !aiDetectSettings.model.trim()) {
      setAiDetectError('请先在设置中填写检测所需的 API URL、API Key 和模型')
      return
    }

    setAiDetecting(true)
    setAiDetectError('')
    setAiDetectResult(null)
    detectAiGeneratedTranscript(aiDetectSettings, title, transcript).then(result => {
      setAiDetectResult(result)
    }).catch((cause: unknown) => {
      console.error(cause)
      setAiDetectError(cause instanceof Error ? cause.message : '内容风格检测失败')
    }).finally(() => {
      setAiDetecting(false)
    })
  }, [aiDetectSettings, title, transcript])

  const onDetectAi = useCallback(() => {
    runAiDetect()
  }, [runAiDetect])

  useEffect(() => {
    if (!aiDetectSettings.enabled || !aiDetectSettings.autoDetect || !transcript || aiDetecting) {
      return
    }
    if (!aiDetectSettings.apiUrl.trim() || !aiDetectSettings.apiKey.trim() || !aiDetectSettings.model.trim()) {
      return
    }

    const autoDetectKey = `${url}::${currentInfo?.subtitle_url ?? ''}::${transcript.body.length}`
    if (!autoDetectKey || autoDetectKey === lastAutoDetectKeyRef.current) {
      return
    }

    lastAutoDetectKeyRef.current = autoDetectKey
    runAiDetect()
  }, [aiDetectSettings, aiDetecting, currentInfo?.subtitle_url, runAiDetect, transcript, url])

  const items = transcript?.body ?? []
  const shouldShowDetectCard = aiDetectSettings.enabled || aiDetecting || Boolean(aiDetectError) || aiDetectResult != null
  const shouldShowDetectControls = aiDetectResult == null

  return (
    <div className="panel-shell" style={{height: collapsed ? `${HEADER_HEIGHT}px` : `${panelHeight}px`}}>
      <div className="panel-header">
        <button className="ghost-button" onClick={toggleCollapsed} type="button">
          {collapsed ? '展开' : '收起'}
        </button>
        <div className="panel-title">
          <div className="title-main">{title}</div>
          {url && <div className="title-sub">{url}</div>}
        </div>
        <div className="header-actions">
          <button className="ghost-button" onClick={() => setShowSettingsPanel(prev => !prev)} type="button">
            {showSettingsPanel ? '关闭设置' : '设置'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="panel-body">
          {showSettingsPanel && (
            <div className="settings-card">
              <div className="settings-title">内容检测设置</div>
              <div className="settings-desc">配置检测接口、模型，以及字幕列表和检测结果的显示方式。</div>
              <div className="detect-config">
                <input
                  className="detect-input"
                  onChange={event => updateAiDetectSettings({apiUrl: event.target.value})}
                  placeholder="API URL，例如 https://api.openai.com/v1"
                  type="text"
                  value={aiDetectSettings.apiUrl}
                />
                <input
                  className="detect-input"
                  onChange={event => updateAiDetectSettings({apiKey: event.target.value})}
                  placeholder="API Key"
                  type="password"
                  value={aiDetectSettings.apiKey}
                />
                <input
                  className="detect-input"
                  onChange={event => updateAiDetectSettings({model: event.target.value})}
                  placeholder="模型名，例如 gpt-4.1-mini"
                  type="text"
                  value={aiDetectSettings.model}
                />
                <label className="detect-toggle detect-subtoggle">
                  <input
                    checked={aiDetectSettings.enabled}
                    onChange={event => updateAiDetectSettings({enabled: event.target.checked})}
                    type="checkbox"
                  />
                  <span>启用内容检测</span>
                </label>
                <label className="detect-toggle detect-subtoggle">
                  <input
                    checked={aiDetectSettings.detailedExplanation}
                    onChange={event => updateAiDetectSettings({detailedExplanation: event.target.checked})}
                    type="checkbox"
                  />
                  <span>显示逐项详细判断</span>
                </label>
                <label className="detect-toggle detect-subtoggle">
                  <input
                    checked={aiDetectSettings.autoDetect}
                    onChange={event => updateAiDetectSettings({autoDetect: event.target.checked})}
                    type="checkbox"
                  />
                  <span>有字幕时自动检测</span>
                </label>
                <label className="detect-toggle detect-subtoggle">
                  <input
                    checked={aiDetectSettings.showSubtitles}
                    onChange={event => updateAiDetectSettings({showSubtitles: event.target.checked})}
                    type="checkbox"
                  />
                  <span>显示字幕列表</span>
                </label>
              </div>
            </div>
          )}

          <div className="toolbar">
            <select className="toolbar-select" value={currentInfo?.subtitle_url ?? ''} onChange={onSelectInfo}>
              {infos.map(info => (
                <option key={info.id} value={info.subtitle_url}>
                  {info.lan_doc}
                </option>
              ))}
              {infos.length === 0 && <option value="">未检测到字幕</option>}
            </select>
            <div className="toolbar-actions">
              <button className="ghost-button" onClick={onDetectAi} type="button">内容检测</button>
              <button className="ghost-button" disabled={!transcript} onClick={onDownloadTxt} type="button">TXT</button>
              <button className="ghost-button" disabled={!transcript} onClick={onDownloadJson} type="button">JSON</button>
            </div>
          </div>

          {shouldShowDetectCard && (
            <div className="detect-card">
            <div className="detect-toggle">
              <span>内容风格检测</span>
            </div>
            {shouldShowDetectControls && (
              <div className="detect-desc">基于当前视频字幕，判断内容是否带有明显的吸引注意力、延长停留或影响行为的脚本化设计。</div>
            )}

            {aiDetectSettings.enabled && (
              <div className="detect-config">
                {shouldShowDetectControls && (
                  <>
                    <div className="detect-config-summary">
                      <div>接口地址：{aiDetectSettings.apiUrl || '未设置'}</div>
                      <div>检测模型：{aiDetectSettings.model || '未设置'}</div>
                      <div>自动检测：{aiDetectSettings.autoDetect ? '开启' : '关闭'}</div>
                      <div>详细判断：{aiDetectSettings.detailedExplanation ? '显示' : '不显示'}</div>
                      <div>字幕列表：{aiDetectSettings.showSubtitles ? '显示' : '隐藏'}</div>
                    </div>
                    <div className="detect-actions">
                      <button className="ghost-button" disabled={aiDetecting || !transcript} onClick={onDetectAi} type="button">
                        {aiDetecting && <span className="button-spinner" aria-hidden="true" />}
                        {aiDetecting ? '检测中…' : '开始分析'}
                      </button>
                    </div>
                  </>
                )}
                {aiDetectError && <div className="status-card detect-status">{aiDetectError}</div>}
                {aiDetectResult && (
                  <div className="detect-result">
                    <div className="detect-result-head">
                      <span className={`detect-badge ${aiDetectResult.isClickbaitStyle ? 'detect-badge-warn' : 'detect-badge-ok'}`}>
                        {aiDetectResult.isClickbaitStyle ? '疑似注意力导向脚本' : '更像自然表达'}
                      </span>
                      <span className="detect-confidence">评分 {aiDetectResult.score}/18</span>
                      <span className="detect-confidence">置信度 {aiDetectResult.confidence}%</span>
                    </div>
                    <div className="detect-summary">{aiDetectResult.summary}</div>
                    {aiDetectResult.reasons.length > 0 && (
                      <ul className="detect-reasons">
                        {aiDetectResult.reasons.map(reason => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                    {aiDetectResult.details.length > 0 && (
                      <div className="detect-detail-list">
                        {aiDetectResult.details.map(detail => (
                          <div className="detect-detail-item" key={detail.name}>
                            <div className="detect-detail-head">
                              <span className="detect-detail-name">{detail.name}</span>
                              <span className="detect-detail-score">{detail.score}/2</span>
                            </div>
                            <div className="detect-detail-judgement">{detail.judgement}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          )}

          {noVideo && <div className="status-card">当前页面未检测到可跳转的视频元素。</div>}
          {loading && <div className="status-card">正在获取字幕…</div>}
          {!loading && error && <div className="status-card">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="status-card">当前视频没有可用字幕，因此暂时无法展示字幕列表或进行内容检测。</div>
          )}

          {aiDetectSettings.showSubtitles && (
            <div className="subtitle-list">
              {items.map((item, index) => (
                <button
                  key={`${item.from}-${index}`}
                  ref={element => {
                    itemRefs.current[index] = element
                  }}
                  className={`subtitle-item ${index === activeIndex ? 'subtitle-item-active' : ''}`}
                  onClick={() => onMove(item.from)}
                  type="button"
                >
                  <span className="subtitle-time">{formatTimestamp(item.from)}</span>
                  <span className="subtitle-content">{item.content}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
