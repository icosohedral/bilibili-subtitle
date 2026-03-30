## 简介

Forked from [IndieKKY/bilibili-subtitle](https://github.com/IndieKKY/bilibili-subtitle).

这个版本主要包含两个功能：

1. 获取字幕  
在哔哩哔哩视频页面获取当前视频的字幕内容，并支持查看、跳转和下载字幕。

2. 内容风格检测  
基于获取到的字幕，将文本发送到你配置的 AI 接口进行分析，用于判断视频内容是否更偏向“以吸引注意力、延长观看时长、引导用户行为”为目的的脚本化表达，而不是自然分享或普通科普内容。
<img width="420" alt="image" src="https://github.com/user-attachments/assets/2e570bd4-d588-49fc-af37-fc3ddf56709d" />


当前支持：

- 自动检测当前视频可用字幕
- 在页面内显示字幕列表
- 点击字幕跳转到对应时间
- 下载字幕为 `txt` 或 `json`
- 基于字幕内容检测视频是否属于“吸引注意力/提升停留导向”的脚本化表达
- 支持配置 AI 接口、模型，以及是否显示逐项详细判断

## 开发

- Node.js: `18+`
- 包管理器: `npm`

常用命令：

- `npm install`
- `npm run dev`
- `npm run build`

构建后加载 `dist` 目录即可。

## 许可证

MIT
