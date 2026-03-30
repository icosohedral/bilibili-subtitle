import { DEFAULT_USE_PORT } from '@/consts/const'
import { AllExtensionMessages } from '@/message-typings'
import { ExtensionMessaging, TAG_TARGET_INJECT } from '../message'

const setBadgeOk = async (tabId: number, ok: boolean) => {
  await chrome.action.setBadgeText({
    text: ok ? '✓' : '',
    tabId,
  })
  await chrome.action.setBadgeBackgroundColor({
    color: '#00aeeC',
    tabId,
  })
  await chrome.action.setBadgeTextColor({
    color: '#ffffff',
    tabId,
  })
}

const methods: {
  [K in AllExtensionMessages['method']]: (params: Extract<AllExtensionMessages, { method: K }>['params'], context: MethodContext) => Promise<any>
} = {
  SHOW_FLAG: async (params, context) => {
    if (context.tabId != null) {
      await setBadgeOk(context.tabId, params.show)
    }
  },
}

const extensionMessaging = new ExtensionMessaging(DEFAULT_USE_PORT)
extensionMessaging.init(methods)

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) {
    return
  }
  extensionMessaging.sendMessage(false, tab.id, TAG_TARGET_INJECT, 'TOGGLE_DISPLAY').catch(console.error)
})
