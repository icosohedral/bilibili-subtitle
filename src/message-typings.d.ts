import {ExtensionMessage, InjectMessage, AppMessage} from './message'

interface ExtensionShowFlagMessage extends ExtensionMessage<{ show: boolean }> {
  method: 'SHOW_FLAG'
}

export type AllExtensionMessages = ExtensionShowFlagMessage

interface InjectToggleDisplayMessage extends InjectMessage<{}> {
  method: 'TOGGLE_DISPLAY'
}

interface InjectFoldMessage extends InjectMessage<{ fold: boolean }> {
  method: 'FOLD'
}

interface InjectMoveMessage extends InjectMessage<{ time: number, togglePause: boolean }> {
  method: 'MOVE'
}

interface InjectGetSubtitleMessage extends InjectMessage<{ info: any }, Transcript> {
  method: 'GET_SUBTITLE'
}

interface InjectGetVideoStatusMessage extends InjectMessage<{}, { paused?: boolean, currentTime?: number }> {
  method: 'GET_VIDEO_STATUS'
}

interface InjectGetVideoElementInfoMessage extends InjectMessage<{}, { noVideo: boolean, totalHeight: number }> {
  method: 'GET_VIDEO_ELEMENT_INFO'
}

interface InjectRefreshVideoInfoMessage extends InjectMessage<{ force: boolean }> {
  method: 'REFRESH_VIDEO_INFO'
}

export type AllInjectMessages =
  | InjectToggleDisplayMessage
  | InjectFoldMessage
  | InjectMoveMessage
  | InjectGetSubtitleMessage
  | InjectGetVideoStatusMessage
  | InjectGetVideoElementInfoMessage
  | InjectRefreshVideoInfoMessage

interface AppSetInfosMessage extends AppMessage<{ infos: any[] }> {
  method: 'SET_INFOS'
}

interface AppSetVideoInfoMessage extends AppMessage<{ url: string, title: string, infos: any[] }> {
  method: 'SET_VIDEO_INFO'
}

export type AllAPPMessages = AppSetInfosMessage | AppSetVideoInfoMessage
