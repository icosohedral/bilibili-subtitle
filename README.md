## 简介

Forked from [IndieKKY/bilibili-subtitle](https://github.com/IndieKKY/bilibili-subtitle).

这个版本聚焦两个功能：在哔哩哔哩视频页获取字幕，以及基于字幕做内容风格检测。
内容风格检测会把字幕文本发送给你配置的 AI 接口，判断视频内容是否更偏向“吸引注意力、延长停留、影响行为”的脚本化表达，而不是自然分享或普通科普。
检测结果会返回一个总体结论、评分、置信度，以及若干基于文本证据的判断理由；如果开启详细模式，还会逐项列出各个判定维度的得分和解释。
<img width="720" height="1010" alt="image" src="https://github.com/user-attachments/assets/2e570bd4-d588-49fc-af37-fc3ddf56709d" />


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
