const parseTime = (time: string): number => {
  const separator = time.includes(',') ? ',' : '.'
  const parts = time.trim().split(':')
  const ms = parts[parts.length - 1].split(separator)

  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(ms[0], 10) + parseInt(ms[1] ?? '0', 10) / 1000
  }

  return parseInt(parts[0], 10) * 60 + parseInt(ms[0], 10) + parseInt(ms[1] ?? '0', 10) / 1000
}

export const parseTranscript = (filename: string, text: string | ArrayBuffer): Transcript => {
  const items: TranscriptItem[] = []
  const normalizedText = String(text).trim().replace(/\r\n/g, '\n')

  if (filename.toLowerCase().endsWith('.srt')) {
    for (const block of normalizedText.split('\n\n')) {
      const lines = block.trim().split('\n')
      if (lines.length < 3) {
        continue
      }

      try {
        const [fromText, toText] = lines[1].split(' --> ')
        items.push({
          from: parseTime(fromText),
          to: parseTime(toText),
          content: lines.slice(2).join('\n'),
          idx: items.length,
        })
      } catch (error) {
        console.error('parse srt block failed', error)
      }
    }
  }

  if (filename.toLowerCase().endsWith('.vtt')) {
    for (const block of normalizedText.split('\n\n')) {
      const lines = block.trim().split('\n')
      const timeIndex = lines.findIndex(line => line.includes('-->'))
      if (timeIndex < 0) {
        continue
      }

      try {
        const [fromText, toText] = lines[timeIndex].split(' --> ')
        items.push({
          from: parseTime(fromText),
          to: parseTime(toText),
          content: lines.slice(timeIndex + 1).join('\n'),
          idx: items.length,
        })
      } catch (error) {
        console.error('parse vtt block failed', error)
      }
    }
  }

  return {body: items}
}

export const normalizeTranscript = (transcript: Partial<Transcript> | undefined): Transcript => {
  const rawBody = transcript?.body
  const body: TranscriptItem[] = Array.isArray(rawBody) ? rawBody as TranscriptItem[] : []
  return {
    body: body.map((item, idx) => ({
      from: item.from ?? 0,
      to: item.to ?? item.from ?? 0,
      content: item.content ?? '',
      idx,
    })),
  }
}

export const formatTimestamp = (seconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const transcriptToText = (transcript: Transcript): string => {
  return transcript.body.map(item => `[${formatTimestamp(item.from)} - ${formatTimestamp(item.to)}] ${item.content}`).join('\n')
}

export const sampleTranscriptForAi = (transcript: Transcript, headChars = 1500, tailChars = 1000): string => {
  const content = transcript.body.map(item => `[${formatTimestamp(item.from)}] ${item.content}`).join('\n')
  const maxChars = headChars + tailChars
  if (content.length <= maxChars) {
    return content
  }

  return `${content.slice(0, headChars)}\n...\n${content.slice(-tailChars)}`
}

const extractJson = (content: string): string => {
  const blockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = blockMatch ? blockMatch[1] : content
  const objectStart = raw.indexOf('{')
  const objectEnd = raw.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) {
    return raw.slice(objectStart, objectEnd + 1)
  }
  return raw.trim()
}

export const detectAiGeneratedTranscript = async (settings: AiDetectSettings, title: string, transcript: Transcript): Promise<AiDetectResult> => {
  const apiUrl = settings.apiUrl.trim().replace(/\/$/, '')
  const excerpt = sampleTranscriptForAi(transcript)
  if (!excerpt) {
    throw new Error('字幕内容为空，无法检测')
  }
  const detailOutputRule = settings.detailedExplanation
    ? '6. details: 数组，包含每个判定维度的 name、score、judgement。judgement 用一句中文解释该项为何得分。'
    : '6. details: 返回空数组即可。'

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      temperature: 0.2,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content: '你是一个内容风格分析助手。你需要判断视频字幕是否属于“引流/吸引眼球导向的脚本化内容”，常见于短视频营销或批量化内容。你必须谨慎，不能把正常科普、正常表达或清晰结构默认判为引流内容。输出 JSON，字段必须包含 isClickbaitStyle、score、confidence、summary、reasons、details。',
        },
        {
          role: 'user',
          content: `请根据下面的视频字幕抽样，判断该内容是否属于“以吸引注意力/提升停留为主要目的的脚本化内容”（而非自然表达或单纯信息分享）。\n\n标题：${title || '未知标题'}\n\n【判定维度】（每项0-2分，需基于文本证据）\n\n1. 钩子强度\n是否在开头或关键位置使用提问、反常识、极端对比、数字冲击等吸引注意\n\n2. 信息控制（悬念/信息差）\n是否刻意隐藏或延迟关键信息，引导观众继续观看\n\n3. 表达节奏\n是否高度紧凑、连续输出观点，缺少自然停顿或真实对话感\n\n4. 认知/情绪刺激\n是否频繁使用“巨大差距、颠覆认知、极端情况”等强化感受\n\n5. 行为/转化引导\n是否出现推荐、引导尝试、关注、购买、下载等行为指令\n若存在明确引导，必须≥2分\n\n6. 脚本结构感\n是否呈现明显结构设计（如分段递进、对比、套路化铺垫）\n\n7. 内容一致性\n是否存在明显结构性转折（如中途插入无关内容、广告、话题跳跃）\n\n8. 情绪叙事\n是否构建人生路径、身份跃迁、成功/失败叙事（如普通人→成功）\n\n9. 焦虑/欲望驱动\n是否隐含“你应该这样”“否则会落后”“成功模板”等心理驱动\n\n【关键判断原则】\n- 不要仅根据“是否有知识内容”判断\n- 判断重点是：内容是否被设计来吸引、留住和影响观众\n\n【权重规则】\n- 出现明确广告/推荐 → 强信号\n- 出现“强钩子 + 情绪叙事” → 强信号\n- 多个维度同时中等（≥3项≥1分） → 中强信号\n\n【证据要求】\n- 每个高分项必须能在原文中找到对应表达或结构\n- 若证据不足，应降低评分，不做主观推测\n\n【输出格式】\n1. isClickbaitStyle: 布尔值（>=7为true）\n2. score: 0-18\n3. confidence: 0-100\n4. summary: 一句中文结论\n5. reasons: 1-4条关键理由（必须基于文本）\n${detailOutputRule}\n\n【判定边界】\n- 自然表达 / 轻松分享 / 普通科普 → false\n- 明显为吸引注意、延长停留、影响行为而设计 → true\n- 若存在不确定性 → 倾向 false，并说明“证据不足”\n\n字幕抽样：\n${excerpt}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI 检测请求失败: ${response.status}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('AI 返回内容为空')
  }

  const parsed = JSON.parse(extractJson(content))
  return {
    isClickbaitStyle: Boolean(parsed.isClickbaitStyle),
    score: Math.max(0, Math.min(18, Number(parsed.score) || 0)),
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
    summary: typeof parsed.summary === 'string' ? parsed.summary : '未返回结论',
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map((item: unknown) => String(item)).filter(Boolean).slice(0, 4) : [],
    details: Array.isArray(parsed.details)
      ? parsed.details.map((item: any) => ({
        name: String(item?.name ?? ''),
        score: Math.max(0, Math.min(2, Number(item?.score) || 0)),
        judgement: String(item?.judgement ?? ''),
      })).filter((item: AiDetectDetailItem) => item.name).slice(0, 7)
      : [],
  }
}

export const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], {type: mimeType})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
