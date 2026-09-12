import plugin from '../../lib/plugins/plugin.js'
import common from '../../lib/common/common.js'

/*
 * 作者：小梦
 * Github项目地址：https://github.com/shiomon/codes
 🔍 自动提取消息中的兑换码（大写字母+数字，6~20位）
 📋 追加发送 markdown 代码块，支持QQ上一键复制
 🚫 不修改原消息，不影响原插件发送
 🤖 仅 QQBot 生效，其他适配器无影响
 
 发送任意包含 兑换码 或 code 关键词（全部游戏）的指令即可，
 理论上经过QQBot-plugin都可以例如：（米哈游的游戏没测，得等到前瞻）
 #兑换码
 *兑换码
 %兑换码
 end兑换码
 nte兑换码
 ww兑换码
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
  return text.match(/[A-Z][A-Z0-9]{5,19}/g) || []
}

function buildCodeMarkdown(codes) {
  let md = ''
  for (const code of codes) {
    md += `\`\`\`兑换码\n${code}\n\`\`\`\n`
  }
  return md
}

function wrapReply(e) {
  if (!e.reply?.bind) return
  if (e._codeWrapReply) return
  e._codeWrapReply = true
  const origReply = e.reply.bind(e)
  e.reply = async (msg = '', quote = false, data = {}) => {
    const result = await origReply(msg, quote, data)
    try {
      const text = extractText(msg)
      const codes = extractCodes(text)
      if (codes.length && !e._codeSent) {
        e._codeSent = true
        logger.mark(`[兑换码复制] reply追加发送: ${codes.join(', ')}`)
        await origReply(segment.markdown(buildCodeMarkdown(codes)))
      }
    } catch (err) {
      logger.error(`[兑换码复制] reply追加失败: ${err?.message || err}`)
    }
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
  const restore = () => {
    if (restored) return
    restored = true
    if (origPrivate) sdk.sendPrivateMessage = origPrivate
    if (origGroup) sdk.sendGroupMessage = origGroup
    logger.mark('[兑换码复制] SDK劫持已恢复')
  }
  setTimeout(restore, 10000)

  const handleSend = async (origFn, targetId, msg, event, options) => {
    const result = await origFn(targetId, msg, event, options)
    try {
      const text = extractText(msg)
      const codes = extractCodes(text)
      logger.mark(`[兑换码复制] SDK发送 文本长度=${text.length} 提取${codes.length}个码`)
      if (codes.length && !e._codeSent) {
        e._codeSent = true
        logger.mark(`[兑换码复制] SDK追加发送: ${codes.join(', ')}`)
        const extraMsg = [{ type: 'markdown', content: buildCodeMarkdown(codes) }]
        await origFn(targetId, extraMsg, event, options)
        restore()
      }
    } catch (err) {
      logger.error(`[兑换码复制] SDK追加失败: ${err?.message || err}`)
      restore()
    }
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
        { reg: '(code|兑换码)', fnc: 'intercept' }
      ]
    })
  }

  async intercept(e) {
    const isQQBot = e?.bot?.version?.id === 'QQBot' || e?.adapter_id === 'QQBot'
    if (!isQQBot) return false

    logger.mark('[兑换码复制] intercept执行')
    wrapReply(e)
    wrapSdk(e)

    return false
  }
}
