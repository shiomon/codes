import plugin from '../../lib/plugins/plugin.js'
import common from '../../lib/common/common.js'

/*
 * 作者：小梦
 * Github项目地址：https://github.com/shiomon/codes
  🍱 米哈游(原神/星铁/崩三/绝区零)：劫持getCode 从API直接读取，抑制原发送，自己发1条
  🎮 其他游戏(end/nte/ww前缀)：SDK劫持从消息提取，1秒延迟合并发送
  📋 markdown 代码块，支持QQ上一键复制
  🤖 仅 QQBot 生效，其他适配器无影响
*/

function extractText(item) {
  if (!item) return ''
  if (typeof item === 'string') return item
  if (Array.isArray(item)) return item.map(extractText).join('')
  if (typeof item === 'object') {
    if (item.text) return item.text
    if (item.content) return item.content
    if (item.data) {
      if (typeof item.data === 'string') return item.data
      if (Array.isArray(item.data)) return item.data.map(extractText).join('')
      if (item.data.content) return item.data.content
      if (item.data.text) return item.data.text
      if (item.data.message) return extractText(item.data.message)
    }
    if (item.message) return extractText(item.message)
  }
  return ''
}

function extractCodes(text) {
  const codes = []
  const kwPattern = /(?:兑换码|code|CDK|cdk)\s*[：:=是为]\s*([^\n，。、！？\s]+)/gi
  let m
  while ((m = kwPattern.exec(text)) !== null) {
    const code = m[1].trim()
    if (code.length >= 2 && code.length <= 30) codes.push(code)
  }
  const cleanText = text.replace(/https?:\/\/\S+/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  const alnumCodes = cleanText.match(/[A-Za-z][A-Za-z0-9]{5,19}/g) || []
  for (const c of alnumCodes) {
    if (!codes.includes(c)) codes.push(c)
  }
  return [...new Set(codes)]
}

function extractCodesFromButtons(msg) {
  const codes = []
  const items = Array.isArray(msg) ? msg : [msg]
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    if (item.type === 'button' && Array.isArray(item.buttons)) {
      for (const btn of item.buttons) {
        const data = btn?.action?.data || btn?.data
        if (typeof data === 'string') {
          const m = data.match(/兑换码使用(.+)/)
          if (m && m[1].trim()) codes.push(m[1].trim())
        }
      }
    }
    if (item.data) {
      if (Array.isArray(item.data)) codes.push(...extractCodesFromButtons(item.data))
      else if (typeof item.data === 'object') codes.push(...extractCodesFromButtons(item.data))
    }
    if (item.message) codes.push(...extractCodesFromButtons(item.message))
  }
  return [...new Set(codes)]
}

function extractAllCodes(msg) {
  const text = extractText(msg)
  const textCodes = extractCodes(text)
  const btnCodes = extractCodesFromButtons(msg)
  return [...new Set([...textCodes, ...btnCodes])]
}

function buildCodeMarkdown(codes) {
  let md = ''
  for (const code of codes) {
    md += `\`\`\`兑换码\n${code}\n\`\`\`\n`
  }
  return md
}

async function hookMihoyo(e) {
  try {
    const loader = (await import('../../lib/plugins/loader.js')).default
    const entry = loader.priority.find(p => p.name === '兑换码' && p.class?.prototype?.getCode)
    if (!entry?.class?.prototype) return false
    const proto = entry.class.prototype
    const origGetCode = proto.getCode
    const origGetData = proto.getData
    let restored = false
    const restore = () => {
      if (restored) return
      restored = true
      proto.getCode = origGetCode
      proto.getData = origGetData
      logger.mark('[兑换码复制] getCode hook已恢复')
    }
    setTimeout(restore, 15000)

    proto.getCode = async function() {
      let codes = []
      let title = ''
      let time = ''
      let collectedMsgs = []

      proto.getData = async function(type) {
        const result = await origGetData.call(this, type)
        if (type === 'index' && result?.data?.live) {
          title = result.data.live.title || ''
        }
        if (type === 'code' && result?.data?.code_list) {
          for (const val of result.data.code_list) {
            if (val.code) codes.push(val.code)
          }
        }
        return result
      }

      const origReply = this.reply.bind(this)
      this.reply = async (msg) => { collectedMsgs.push(msg); return true }

      try {
        await origGetCode.call(this)
      } finally {
        this.reply = origReply
        proto.getData = origGetData
      }

      if (codes.length) {
        time = this.deadline || ''
        let md = `${title}直播兑换码\n过期时间: ${time}\n`
        for (const code of codes) {
          md += `\n\`\`\`兑换码\n${code}\n\`\`\`\n`
        }
        logger.mark(`[兑换码复制] 劫持getCode 发1条含${codes.length}个码`)
        await origReply(segment.markdown(md))
      } else {
        for (const msg of collectedMsgs) {
          await origReply(msg)
        }
      }
      restore()
    }
    logger.mark('[兑换码复制] 已hook米哈游插件getCode')
    return true
  } catch (err) {
    logger.error(`[兑换码复制] hookMihoyo失败: ${err?.message || err}`)
    return false
  }
}

function wrapReply(e) {
  if (!e.reply?.bind) return
  if (e._codeWrapReply) return
  e._codeWrapReply = true
  const origReply = e.reply.bind(e)
  let pendingCodes = []
  let flushTimer = null
  const flush = () => {
    flushTimer = null
    if (!pendingCodes.length) return
    const codes = [...pendingCodes]
    pendingCodes = []
    logger.mark(`[兑换码复制] reply合并发送${codes.length}个码: ${codes.join(', ')}`)
    origReply(segment.markdown(buildCodeMarkdown(codes))).catch((err) => {
      logger.error(`[兑换码复制] reply合并发送失败: ${err?.message || err}`)
    })
  }
  e.reply = async (msg = '', quote = false, data = {}) => {
    const result = await origReply(msg, quote, data)
    ;(async () => {
      try {
        const allCodes = extractAllCodes(msg)
        if (!e._codesSent) e._codesSent = new Set()
        const newCodes = allCodes.filter(c => !e._codesSent.has(c))
        if (newCodes.length) {
          for (const c of newCodes) e._codesSent.add(c)
          pendingCodes.push(...newCodes)
          if (flushTimer) clearTimeout(flushTimer)
          flushTimer = setTimeout(flush, 1000)
        }
      } catch (err) {
        logger.error(`[兑换码复制] reply提取失败: ${err?.message || err}`)
      }
    })()
    return result
  }
}

function wrapSdk(e) {
  const sdk = e.bot?.sdk
  if (!sdk) {
    logger.mark('[兑换码复制] e.bot.sdk不存在 跳过SDK劫持')
    return
  }

  const origPrivate = sdk.sendPrivateMessage?.bind(sdk)
  const origGroup = sdk.sendGroupMessage?.bind(sdk)

  if (!origPrivate && !origGroup) {
    logger.mark('[兑换码复制] SDK方法不存在 跳过')
    return
  }

  let restored = false
  let pendingCodes = []
  let flushTimer = null
  let sendCtx = null
  const restore = () => {
    if (restored) return
    restored = true
    if (origPrivate) sdk.sendPrivateMessage = origPrivate
    if (origGroup) sdk.sendGroupMessage = origGroup
    logger.mark('[兑换码复制] SDK劫持已恢复')
  }
  const flush = async () => {
    flushTimer = null
    if (!pendingCodes.length || !sendCtx) return
    const codes = [...pendingCodes]
    pendingCodes = []
    logger.mark(`[兑换码复制] SDK合并发送${codes.length}个码: ${codes.join(', ')}`)
    try {
      const { origFn, targetId, event, options } = sendCtx
      await origFn(targetId, [{ type: 'markdown', content: buildCodeMarkdown(codes) }], event, options)
    } catch (err) {
      logger.error(`[兑换码复制] SDK合并发送失败: ${err?.message || err}`)
    }
    restore()
  }
  setTimeout(restore, 10000)

  const handleSend = async (origFn, targetId, msg, event, options) => {
    const result = await origFn(targetId, msg, event, options)
    ;(async () => {
      try {
        const allCodes = extractAllCodes(msg)
        if (allCodes.length) {
          logger.mark(`[兑换码复制] SDK发送 提取${allCodes.length}个码: ${allCodes.join(', ')}`)
          if (!e._codesSent) e._codesSent = new Set()
          const newCodes = allCodes.filter(c => !e._codesSent.has(c))
          if (newCodes.length) {
            for (const c of newCodes) e._codesSent.add(c)
            if (!sendCtx) sendCtx = { origFn, targetId, event, options }
            pendingCodes.push(...newCodes)
            if (flushTimer) clearTimeout(flushTimer)
            flushTimer = setTimeout(flush, 1000)
          }
        }
      } catch (err) {
        logger.error(`[兑换码复制] SDK提取失败: ${err?.message || err}`)
      }
    })()
    return result
  }

  if (origPrivate) {
    sdk.sendPrivateMessage = async (userId, msg, event, options) =>
      handleSend(origPrivate, userId, msg, event, options)
  }
  if (origGroup) {
    sdk.sendGroupMessage = async (groupId, msg, event, options) =>
      handleSend(origGroup, groupId, msg, event, options)
  }

  logger.mark(`[兑换码复制] SDK劫持已设置 private=${!!origPrivate} group=${!!origGroup}`)
}

export class GachaCode extends plugin {
  constructor() {
    super({
      name: '兑换码复制',
      dsc: 'QQBot下兑换码追加发送可复制代码块',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: '^(#|\\*)?(原神|星铁|崩铁|崩三|崩坏三|崩坏3|绝区零)?(直播|前瞻)?兑换码$',
          fnc: 'interceptMihoyo',
        },
        {
          reg: '^(end|nte|ww)兑换码',
          fnc: 'interceptOther',
        },
      ],
    })
  }

  async interceptMihoyo(e) {
    const isQQBot = e?.bot?.version?.id === 'QQBot' || e?.adapter_id === 'QQBot'
    if (!isQQBot) return false
    logger.mark('[兑换码复制] 米哈游指令')
    await hookMihoyo(e)
    return false
  }

  async interceptOther(e) {
    const isQQBot = e?.bot?.version?.id === 'QQBot' || e?.adapter_id === 'QQBot'
    if (!isQQBot) return false
    logger.mark('[兑换码复制] 其他指令')
    wrapReply(e)
    wrapSdk(e)
    return false
  }
}
