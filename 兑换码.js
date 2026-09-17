import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/*
 * 作者：小梦
 * 项目：github.com/shiomon/codes
 *   🍱 米游(原神/星铁/崩三/绝区零)：getCode 直接读取，抑制原发送，自己发1条
 *   🎮 4399游戏(鸣潮/终末地/异环)：直接调 API 查询兑换码
 *   📋 markdown 代码块，支持Q上一键复制，仅官机生效
 *   ✅ #原神兑换码 / #兑换码
 *   ✅ #鸣潮兑换码 / ww兑换码
 *   ✅ #终末地兑换码 / end兑换码
 *   ✅ #异环兑换码 / nte兑换码
 *    *  待测：绝区零，星铁
 *   🔧 #兑换码原神开/关 — 米游兑换码开关
 *   🔧 #兑换码ww开/关 — 鸣潮兑换码开关
 *   🔧 #兑换码end开/关 — 终末地兑换码开关
 *   🔧 #兑换码nte开/关 — 异环兑换码开关
 *   🔧 #兑换码信息开/关 — 鸣潮,异环,终末地兑换码奖励信息显示开关（默认关，只发兑换码）
 *   🔧 #兑换码开关 — 查看全部开关状态
 *   致谢:
 *        gitcode.com/TimeRainStarSky/Yunzai
 *        gitcode.com/gscore-mirror/EndUID
 *        gitcode.com/gscore-mirror/NTEUID
 *        gitcode.com/gscore-mirror/XutheringWavesUID
 */

export class GachaCode extends plugin {
  constructor() {
    super({
      name: '兑换码复制',
      dsc: 'example/兑换码',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: '^#兑换码(原神|ww|end|nte)(开|关)$',
          fnc: 'toggleSwitch',
        },
        {
          reg: '^#兑换码开关$',
          fnc: 'showSwitch',
        },
        {
          reg: '^#兑换码信息(开|关)$',
          fnc: 'toggleInfo',
        },
        {
          reg: '^(#|\\*|/)?(原神|星铁|崩铁|崩三|崩坏三|崩坏3|绝区零)?(直播|前瞻)?兑换码$',
          fnc: 'interceptMihoyo',
        },
        {
          reg: '^(#|/)?(鸣潮|ww|终末地|end|异环|nte)兑换码$',
          fnc: 'query4399',
        },
      ],
    })
  }

  async toggleSwitch(e) {
    const m = e.msg.match(/^#兑换码(原神|ww|end|nte)(开|关)$/)
    if (!m) return false
    const key = SWITCH_KEYS[m[1]]
    const action = m[2] === '开'
    SWITCH[key] = action
    saveSwitch()
    await e.reply([segment.at(e.user_id), `\n${SWITCH_NAMES[key]}兑换码已${action ? '开启' : '关闭'}`])
    return true
  }

  async showSwitch(e) {
    let msg = '兑换码开关状态\n'
    for (const [key, name] of Object.entries(SWITCH_NAMES)) {
      msg += `${name}：${SWITCH[key] ? '开' : '关'}\n`
    }
    msg += `奖励信息：${SWITCH.info ? '开' : '关'}`
    await e.reply([segment.at(e.user_id), `\n${msg}`])
    return true
  }

  async toggleInfo(e) {
    const m = e.msg.match(/^#兑换码信息(开|关)$/)
    if (!m) return false
    SWITCH.info = m[1] === '开'
    saveSwitch()
    await e.reply([segment.at(e.user_id), `\n兑换码奖励信息已${SWITCH.info ? '开启' : '关闭'}`])
    return true
  }

  async interceptMihoyo(e) {
    if (!SWITCH.mihoyo) return false
    if (!isQQBot(e)) return false
    logger.mark('[兑换码复制] 米游指令')
    await hookMihoyo(e)
    return false
  }

  async query4399(e) {
    const msg = e.msg.replace(/^(#|\/)?/, '').replace(/兑换码$/, '')
    let gameKey
    if (/^(鸣潮|ww)$/.test(msg)) gameKey = 'ww'
    else if (/^(终末地|end)$/.test(msg)) gameKey = 'end'
    else if (/^(异环|nte)$/.test(msg)) gameKey = 'nte'
    if (!gameKey) return false
    if (!SWITCH[gameKey]) return false

    try {
      const codes = await fetch4399Codes(gameKey)
      if (!codes || !codes.length) {
        await e.reply([segment.at(e.user_id), `\n${GAMES[gameKey].name}暂无可用兑换码`])
        return true
      }
      const output = formatCodes(e, GAMES[gameKey].name, codes)
      await e.reply([segment.at(e.user_id), '\n', output])
    } catch (err) {
      logger.error(`[兑换码] 4399查询失败: ${err?.message || err}`)
      await e.reply([segment.at(e.user_id), `\n${GAMES[gameKey].name}兑换码获取失败，请稍后再试`])
    }
    return true
  }
}

const CODE_API = 'https://newsimg.5054399.com/comm/mlcxqcommon/static/wap/js'

const GAMES = {
  ww: { name: '鸣潮', file: 102, referer: 'https://www.4399.com/' },
  end: { name: '终末地', file: 171, referer: 'https://www.4399.com/' },
  nte: { name: '异环', file: 173, referer: 'https://www.onebiji.com/' },
}

const INVALID_CODES = ['MINGCHAO']

const SWITCH_NAMES = { mihoyo: '米游', ww: '鸣潮', end: '终末地', nte: '异环' }
const SWITCH_KEYS = { '原神': 'mihoyo', 'ww': 'ww', 'end': 'end', 'nte': 'nte' }
const switchPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/兑换码/switch.json')

function loadSwitch() {
  try {
    const data = JSON.parse(fs.readFileSync(switchPath, 'utf8'))
    return {
      mihoyo: data.mihoyo ?? true,
      ww: data.ww ?? true,
      end: data.end ?? true,
      nte: data.nte ?? true,
      info: data.info ?? false,
    }
  } catch {
    return { mihoyo: true, ww: true, end: true, nte: true, info: false }
  }
}

function saveSwitch() {
  try {
    fs.mkdirSync(path.dirname(switchPath), { recursive: true })
    fs.writeFileSync(switchPath, JSON.stringify(SWITCH, null, 2))
  } catch (err) {
    logger.error('[兑换码] 开关保存失败:', err)
  }
}

let SWITCH = loadSwitch()

function isCodeExpired(label) {
  if (!label) return false
  const m = label.match(/(\d{1,2})月(\d{1,2})日(\d{1,2})点/)
  if (!m) return false
  const month = parseInt(m[1])
  const day = parseInt(m[2])
  let hour = parseInt(m[3])
  if (hour === 24) hour = 23
  const now = new Date()
  let expire = new Date(now.getFullYear(), month - 1, day, hour, 59, 59)
  const diff = expire - now
  if (diff >= 183 * 86400000) expire = new Date(now.getFullYear() - 1, month - 1, day, hour, 59, 59)
  else if (-diff >= 183 * 86400000) expire = new Date(now.getFullYear() + 1, month - 1, day, hour, 59, 59)
  return now > expire
}

async function fetch4399Codes(gameKey) {
  const game = GAMES[gameKey]
  if (!game) throw new Error(`未知游戏: ${gameKey}`)
  const now = new Date()
  const ts = `${now.getFullYear() - 1900}${now.getMonth()}${now.getDate()}${now.getHours()}${now.getMinutes()}`
  const ms = Date.now()
  const url = `${CODE_API}/data_${game.file}.js?${ts}&callback=?&_=${ms}`
  const resp = await fetch(url, {
    headers: { Referer: game.referer },
    signal: AbortSignal.timeout(15000),
  })
  if (!resp.ok) throw new Error(`API返回 ${resp.status}`)
  const text = await resp.text()
  const idx = text.indexOf('=')
  if (idx === -1) throw new Error('响应格式异常')
  const json = text.substring(idx + 1).trim().replace(/;$/, '')
  const data = JSON.parse(json)
  return data
    .filter(c => c.is_fail !== '1' && c.order && !INVALID_CODES.includes(c.order) && !isCodeExpired(c.label))
    .map(c => ({ code: c.order, reward: c.reward || '', label: c.label || '' }))
}

function isQQBot(e) {
  return e?.bot?.version?.id === 'QQBot' || e?.adapter_id === 'QQBot'
}

function formatCodes(e, gameName, codes) {
  const showInfo = SWITCH.info
  if (isQQBot(e)) {
    let md = `${gameName}兑换码（共${codes.length}个）\n`
    for (const c of codes) {
      if (showInfo) {
        md += `\n${c.reward} ${c.label}\n\`\`\`兑换码\n${c.code}\n\`\`\`\n`
      } else {
        md += `\n\`\`\`兑换码\n${c.code}\n\`\`\`\n`
      }
    }
    return segment.markdown(md)
  }
  let text = `${gameName}兑换码（共${codes.length}个）\n`
  for (const c of codes) {
    if (showInfo) {
      text += `\n兑换码：${c.code}\n奖励：${c.reward}\n${c.label}\n`
    } else {
      text += `\n兑换码：${c.code}\n`
    }
  }
  return text
}

async function hookMihoyo(e) {
  try {
    const loader = (await import('../../lib/plugins/loader.js')).default
    const entry = loader.priority.find(p => p.name === '兑换码' && p.class?.prototype?.getCode)
    if (!entry?.class?.prototype) {
      logger.warn('[兑换码复制] 未找到原"兑换码"插件')
      return false
    }
    const proto = entry.class.prototype
    const origGetCode = proto.getCode
    const origGetData = proto.getData
    if (!origGetData) {
      logger.warn('[兑换码复制] 原插件无getData方法')
      return false
    }
    if (proto._codeHooked) {
      logger.warn('[兑换码复制] hook已存在，跳过重入')
      return false
    }
    proto._codeHooked = true
    let restored = false
    const restore = () => {
      if (restored) return
      restored = true
      proto.getCode = origGetCode
      proto.getData = origGetData
      proto._codeHooked = false
      logger.mark('[兑换码复制] getCode hook已恢复')
    }
    const timer = setTimeout(restore, 30000)

    proto.getCode = async function() {
      if (!isQQBot(this.e)) {
        return origGetCode.call(this)
      }
      const codes = []
      let title = ''
      let time = ''
      const collectedMsgs = []

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
        logger.mark(`[兑换码复制] getCode 发1条含${codes.length}个码`)
        await origReply(segment.markdown(md))
      } else {
        for (const msg of collectedMsgs) {
          await origReply(msg)
        }
      }
      restore()
      clearTimeout(timer)
    }
    logger.mark('[兑换码复制] 已hook米游插件getCode')
    return true
  } catch (err) {
    logger.error(`[兑换码复制] hookMihoyo失败: ${err?.message || err}`)
    return false
  }
}
