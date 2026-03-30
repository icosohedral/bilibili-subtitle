import { TOTAL_HEIGHT_DEF, HEADER_HEIGHT, TOTAL_HEIGHT_MIN, TOTAL_HEIGHT_MAX, IFRAME_ID, DEFAULT_USE_PORT } from '@/consts/const'
import { AllExtensionMessages, AllInjectMessages, AllAPPMessages } from '@/message-typings'
import { InjectMessaging } from '../message'

const debug = (...args: any[]) => {
  console.debug('[Inject]', ...args)
}

;(async function () {
  if (!location.pathname.startsWith('/video') && !location.pathname.startsWith('/list')) {
    debug('Not inject')
    return
  }

  const runtime: {
    injectMessaging: InjectMessaging<AllExtensionMessages, AllInjectMessages, AllAPPMessages>
    fold: boolean
    videoElement?: HTMLVideoElement
    videoElementHeight: number
  } = {
    injectMessaging: new InjectMessaging(DEFAULT_USE_PORT),
    fold: true,
    videoElementHeight: TOTAL_HEIGHT_DEF,
  }

  const getVideoElement = () => {
    const videoWrapper = document.getElementById('bilibili-player')
    return videoWrapper?.querySelector('video') as HTMLVideoElement | undefined
  }

  const getMountContainer = (): HTMLElement | null => {
    const selectors = [
      '#danmukuBox',
      '.left-container-under-player',
      '.video-info-container',
      '.bpx-player-container + div',
      '#bilibili-player + div',
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element instanceof HTMLElement) {
        return element
      }
    }

    const playerContainer = document.getElementById('bilibili-player')
    if (playerContainer?.parentElement instanceof HTMLElement) {
      return playerContainer.parentElement
    }

    return null
  }

  const refreshVideoElement = () => {
    const nextVideoElement = getVideoElement()
    const nextHeight = nextVideoElement ? Math.min(Math.max(nextVideoElement.offsetHeight, TOTAL_HEIGHT_MIN), TOTAL_HEIGHT_MAX) : TOTAL_HEIGHT_DEF
    if (nextVideoElement === runtime.videoElement && Math.abs(nextHeight - runtime.videoElementHeight) < 1) {
      return false
    }

    runtime.videoElement = nextVideoElement
    runtime.videoElementHeight = nextHeight
    updateIframeHeight()
    return true
  }

  const createIframe = () => {
    const mountContainer = getMountContainer()
    if (!mountContainer || document.getElementById(IFRAME_ID)) {
      return
    }

    let vKey = ''
    for (const key in mountContainer.dataset) {
      if (key.startsWith('v-')) {
        vKey = key
        break
      }
    }

    const iframe = document.createElement('iframe')
    iframe.id = IFRAME_ID
    iframe.src = chrome.runtime.getURL('index.html')
    iframe.style.border = 'none'
    iframe.style.width = '100%'
    iframe.style.height = `${HEADER_HEIGHT}px`
    iframe.style.marginBottom = '3px'
    iframe.allow = 'clipboard-read; clipboard-write;'

    if (vKey) {
      iframe.dataset[vKey] = mountContainer.dataset[vKey]
    }

    mountContainer.insertBefore(iframe, mountContainer.firstChild)
    runtime.injectMessaging.sendExtension('SHOW_FLAG', {
      show: true,
    }).catch(console.error)

    debug('iframe inserted')
  }

  const timerIframe = setInterval(() => {
    if (!getMountContainer()) {
      return
    }

    clearInterval(timerIframe)
    setTimeout(createIframe, 1500)
  }, 1000)

  let aid: number | null = null
  let title = ''
  let pages: any[] = []
  let pagesMap: Record<string, any> = {}
  let lastAidOrBvid: string | null = null
  let lastInfoKey: string | null = null

  const refreshVideoInfo = async (force = false) => {
    if (force) {
      lastAidOrBvid = null
      lastInfoKey = null
    }

    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null
    if (!iframe) {
      return
    }

    const pathSearchs: Record<string, string> = {}
    location.search.slice(1).replace(/([^=&]*)=([^=&]*)/g, (matches, a, b) => {
      pathSearchs[a] = b
      return matches
    })

    let aidOrBvid = pathSearchs.bvid
    if (!aidOrBvid) {
      let path = location.pathname
      if (path.endsWith('/')) {
        path = path.slice(0, -1)
      }
      const paths = path.split('/')
      aidOrBvid = paths[paths.length - 1]
    }

    if (aidOrBvid !== lastAidOrBvid) {
      lastAidOrBvid = aidOrBvid
      if (!aidOrBvid) {
        return
      }

      if (aidOrBvid.toLowerCase().startsWith('av')) {
        aid = parseInt(aidOrBvid.slice(2), 10)
        pages = await fetch(`https://api.bilibili.com/x/player/pagelist?aid=${aid}`, {credentials: 'include'}).then(async res => await res.json()).then(res => res.data ?? [])
        title = pages[0]?.part ?? document.title
      } else {
        await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${aidOrBvid}`, {credentials: 'include'}).then(async res => await res.json()).then(res => {
          title = res.data?.title ?? document.title
          aid = res.data?.aid ?? null
          pages = res.data?.pages ?? []
        })
      }

      pagesMap = {}
      pages.forEach(page => {
        pagesMap[String(page.page)] = page
      })
    }

    const urlSearchParams = new URLSearchParams(window.location.search)
    const p = urlSearchParams.get('p') || '1'
    const page = pagesMap[p] ?? pages[0]
    const cid: number | null = page?.cid ?? null

    if (!aid || !cid) {
      return
    }

    const nextInfoKey = `${aid}:${cid}:${location.pathname}:${location.search}`
    if (!force && nextInfoKey === lastInfoKey) {
      return
    }
    lastInfoKey = nextInfoKey

    const infos = await fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`, {
      credentials: 'include',
    }).then(async res => await res.json()).then(res => {
      return (res.data?.subtitle?.subtitles ?? []).filter((item: any) => item.subtitle_url)
    })

    runtime.injectMessaging.sendApp(false, 'SET_VIDEO_INFO', {
      url: location.origin + location.pathname + location.search,
      title,
      infos,
    }).catch(console.error)
  }

  const updateIframeHeight = () => {
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null
    if (iframe != null) {
      iframe.style.height = `${runtime.fold ? HEADER_HEIGHT : runtime.videoElementHeight}px`
    }
  }

  const methods: {
    [K in AllInjectMessages['method']]: (params: Extract<AllInjectMessages, { method: K }>['params'], context: MethodContext) => Promise<any>
  } = {
    TOGGLE_DISPLAY: async () => {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null
      if (iframe != null) {
        const visible = iframe.style.display === 'none'
        iframe.style.display = visible ? 'block' : 'none'
        await runtime.injectMessaging.sendExtension('SHOW_FLAG', {
          show: visible,
        })
      } else {
        createIframe()
      }
    },
    FOLD: async (params) => {
      runtime.fold = params.fold
      updateIframeHeight()
    },
    MOVE: async (params) => {
      const video = getVideoElement()
      if (video != null) {
        video.currentTime = params.time
        if (params.togglePause) {
          if (video.paused) {
            await video.play()
          } else {
            video.pause()
          }
        }
      }
    },
    GET_SUBTITLE: async (params) => {
      let subtitleUrl = params.info.subtitle_url
      if (subtitleUrl.startsWith('http://')) {
        subtitleUrl = subtitleUrl.replace('http://', 'https://')
      }
      return await fetch(subtitleUrl).then(async res => await res.json())
    },
    GET_VIDEO_STATUS: async () => {
      const video = getVideoElement()
      return {
        paused: video?.paused,
        currentTime: video?.currentTime,
      }
    },
    GET_VIDEO_ELEMENT_INFO: async () => {
      refreshVideoElement()
      return {
        noVideo: runtime.videoElement == null,
        totalHeight: runtime.videoElementHeight,
      }
    },
    REFRESH_VIDEO_INFO: async (params) => {
      await refreshVideoInfo(params.force)
    },
  }

  runtime.injectMessaging.init(methods)

  setInterval(() => {
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null
    if (!iframe || iframe.style.display === 'none') {
      return
    }

    refreshVideoInfo().catch(console.error)
  }, 1000)
})()
