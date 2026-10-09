import plugin from "../../lib/plugins/plugin.js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

/*
 * 作者：小梦
 * 项目：github.com/shiomon/codes
 * 米游(原神/星铁) 与 绝区零：直连 miyolive 接口；4399(鸣潮/终末地/异环)：直连 4399 接口
 * 官机发 markdown 代码块（Q 一键复制），野机发纯文本
 * 查询： #原神/星铁/绝区零兑换码 #鸣潮兑换码/ww兑换码  #终末地兑换码/end兑换码  #异环兑换码/nte兑换码  
 * 开关(需 master)： 
         #兑换码原神开/关  #兑换码绝区零开/关  #兑换码ww开/关  #兑换码end开/关  #兑换码nte开/关
 *       #兑换码信息开/关  #兑换码开关
 * 致谢： gitcode.com/TimeRainStarSky/Yunzai 及gitcode.com/gscore-mirror/{EndUID,NTEUID,XutheringWavesUID}
 */

const CODE_API = "https://newsimg.5054399.com/comm/mlcxqcommon/static/wap/js"
const DEFAULT_REFERER = "https://www.4399.com/"

const FETCH_TIMEOUT = 15000
const FETCH_RETRY = 2
const MAX_INFLIGHT = 8
const ACT_LIST_SIZE = 50
const NEG_CACHE_TTL = 60000
const LIVE_LINK_RE = /live\/index\.html\?act_id=([a-zA-Z0-9]+)/

// 4399 官方偶发返回的占位/无效码（非穷举，可继续补充）
const INVALID_CODES = new Set(["MINGCHAO"])

// 统一游戏元数据：key 英文小写；aliases 用于命令匹配；source 决定取码方式
const GAME_META = {
  genshin: { name: "原神", aliases: ["原神"], source: "miyolive", uid: "75276539", gid: "2", switchKey: "mihoyo", deadlineDays: 1, deadlineHour: 12 },
  starrail: { name: "星铁", aliases: ["星铁", "崩铁"], source: "miyolive", uid: "80823548", gid: "6", switchKey: "mihoyo", deadlineDays: 1, deadlineHour: 23 },
  zzz: { name: "绝区零", aliases: ["绝区零", "zzz", "ZZZ"], source: "miyolive", uid: "152039148", gid: "8", switchKey: "zzz", deadlineDays: 1, deadlineHour: 23 },
  ww: { name: "鸣潮", aliases: ["鸣潮", "ww"], source: "4399", file: 102, referer: DEFAULT_REFERER, switchKey: "ww" },
  end: { name: "终末地", aliases: ["终末地", "end"], source: "4399", file: 171, referer: DEFAULT_REFERER, switchKey: "end" },
  nte: { name: "异环", aliases: ["异环", "nte"], source: "4399", file: 173, referer: "https://www.onebiji.com/", switchKey: "nte" },
}

// 预编译别名匹配器：中文别名用 includes，纯字母数字别名用词边界，避免子串误判
const ALIAS_MATCHERS = Object.entries(GAME_META).map(([key, meta]) => ({
  key,
  tests: meta.aliases.map(alias => {
    const lower = alias.toLowerCase()
    if (/^[a-z0-9]+$/.test(lower)) {
      const re = new RegExp(`(^|[^a-z0-9])${lower}([^a-z0-9]|$)`)
      return msg => re.test(msg)
    }
    return msg => msg.includes(lower)
  }),
}))

// 开关定义：key 英文小写；games 指定其管理的游戏，顺序即展示顺序
const SWITCH_DEFS = [
  { key: "mihoyo", games: ["genshin", "starrail"] },
  { key: "zzz", games: ["zzz"] },
  { key: "end", games: ["end"] },
  { key: "ww", games: ["ww"] },
  { key: "nte", games: ["nte"] },
]
const SWITCH_NAMES = Object.fromEntries(SWITCH_DEFS.map(d => [d.key, d.games.map(g => GAME_META[g].name).join("")]))
const SWITCH_PATTERN = SWITCH_DEFS.flatMap(d => d.games.flatMap(g => GAME_META[g].aliases)).join("|")

// 查询规则中各来源的游戏名 alternation（全部由 GAME_META 派生，避免多处维护）
const MIYO_PATTERN = ["genshin", "starrail"].flatMap(g => GAME_META[g].aliases).join("|")
const ZZZ_PATTERN = GAME_META.zzz.aliases.join("|")
const CODE4399_PATTERN = ["ww", "end", "nte"].flatMap(g => GAME_META[g].aliases).join("|")

const switchPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data/兑换码/switch.json")

let SWITCH = loadSwitch()

// 按游戏维度缓存“当天”结果（最多 6 个 key）+ 单飞：同游戏并发只打一次上游；跨日自清；仅缓存有码结果
let cacheDate = todayStr()
const gameCache = new Map()
const negCache = new Map()
const inflight = new Map()

const sleep = ms => new Promise(r => setTimeout(r, ms))

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function rollCache() {
  const d = todayStr()
  if (d !== cacheDate) {
    gameCache.clear()
    negCache.clear()
    cacheDate = d
  }
}

function cacheGetOrLoad(game, loader, isNonEmpty) {
  rollCache()
  if (gameCache.has(game)) return gameCache.get(game)
  const neg = negCache.get(game)
  if (neg && neg.expire > Date.now()) return Promise.resolve(neg.data)
  if (neg) negCache.delete(game)
  const running = inflight.get(game)
  if (running) return running
  const task = (async () => {
    try {
      const data = await loader()
      if (isNonEmpty(data)) {
        rollCache()
        gameCache.set(game, data)
      } else {
        negCache.set(game, { data, expire: Date.now() + NEG_CACHE_TTL })
      }
      return data
    } finally {
      inflight.delete(game)
    }
  })()
  inflight.set(game, task)
  return task
}

export class GachaCode extends plugin {
  constructor() {
    super({
      name: "兑换码复制",
      dsc: "example/兑换码",
      event: "message",
      priority: 1,
      rule: [
        { reg: `^#兑换码(${SWITCH_PATTERN})(开|关)$`, fnc: "toggleSwitch", permission: "master" },
        { reg: "^#兑换码开关$", fnc: "showSwitch", permission: "master" },
        { reg: "^#兑换码信息(开|关)$", fnc: "toggleInfo", permission: "master" },
        { reg: `^(#|\\*|/)?(${MIYO_PATTERN})?(直播|前瞻)?兑换码$`, fnc: "handleQuery" },
        { reg: `^(#|\\*|/|%)?(${ZZZ_PATTERN})(直播|前瞻)?(兑换码|code)$`, fnc: "handleQuery" },
        { reg: `^%(${ZZZ_PATTERN})?(直播|前瞻)?(兑换码|code)$`, fnc: "handleQuery" },
        { reg: `^(#|/)?(${CODE4399_PATTERN})兑换码$`, fnc: "handleQuery" },
      ],
    })
  }

  async toggleSwitch(e) {
    const game = resolveGame(e.msg)
    if (!game) return false
    const key = GAME_META[game].switchKey
    const action = e.msg.endsWith("开")
    SWITCH[key] = action
    await saveSwitch()
    await e.reply(wrapReply(e, `兑换码${SWITCH_NAMES[key]}已${action ? "开启" : "关闭"}`))
    return true
  }

  async showSwitch(e) {
    let msg = "兑换码开关状态\n"
    for (const { key } of SWITCH_DEFS) {
      msg += `${SWITCH_NAMES[key]}：${SWITCH[key] ? "开" : "关"}\n`
    }
    msg += `奖励信息：${SWITCH.info ? "开" : "关"}`
    await e.reply(wrapReply(e, msg))
    return true
  }

  async toggleInfo(e) {
    const m = e.msg.match(/^#兑换码信息(开|关)$/)
    if (!m) return false
    SWITCH.info = m[1] === "开"
    await saveSwitch()
    await e.reply(wrapReply(e, `兑换码奖励信息已${SWITCH.info ? "开启" : "关闭"}`))
    return true
  }

  async handleQuery(e) {
    const game = resolveGame(e.msg)
    if (!game) return false
    const meta = GAME_META[game]
    if (!SWITCH[meta.switchKey]) return false
    logger.debug(`[兑换码] ${meta.name}指令`)

    try {
      let codes, title = "", deadline = "", emptyMsg
      if (meta.source === "miyolive") {
        const result = await cacheGetOrLoad(game, () => fetchMiyoliveCodes(meta), r => r?.codes?.length > 0)
        codes = result?.codes || []
        title = result?.title || ""
        deadline = result?.deadline || ""
        emptyMsg = `暂无${meta.name}直播兑换码`
      } else {
        codes = await cacheGetOrLoad(game, () => fetch4399Codes(game), r => Array.isArray(r) && r.length > 0)
        emptyMsg = `${meta.name}暂无可用兑换码`
      }
      if (!codes.length) {
        await e.reply(wrapReply(e, emptyMsg))
        return true
      }
      await e.reply(wrapReply(e, title, formatCodes(e, meta.name, codes, deadline)))
    } catch (err) {
      logger.error(`[兑换码] ${meta.name}查询失败: ${err?.message || err}`)
      await e.reply(wrapReply(e, `${meta.name}兑换码获取失败：${describeError(err)}`))
    }
    return true
  }
}

function loadSwitch() {
  try {
    const data = JSON.parse(fs.readFileSync(switchPath, "utf8"))
    return {
      mihoyo: data.mihoyo ?? true,
      zzz: data.zzz ?? true,
      ww: data.ww ?? true,
      end: data.end ?? true,
      nte: data.nte ?? true,
      info: data.info ?? false,
    }
  } catch {
    return { mihoyo: true, zzz: true, ww: true, end: true, nte: true, info: false }
  }
}

// 原子写 + 独占锁 + 合并磁盘最新：缓解多进程 lost update（单实例可省略锁）
async function saveSwitch() {
  try {
    fs.mkdirSync(path.dirname(switchPath), { recursive: true })
  } catch (err) {
    logger.error("[兑换码] 开关保存失败:", err)
    return
  }
  const lockPath = `${switchPath}.lock`
  let fd = null
  for (let i = 0; i < 25 && fd === null; i++) {
    try {
      fd = fs.openSync(lockPath, "wx")
    } catch (err) {
      if (err.code !== "EEXIST") {
        logger.error("[兑换码] 开关保存失败:", err)
        return
      }
      try {
        const stat = fs.statSync(lockPath)
        if (Date.now() - stat.mtimeMs > 5000) fs.rmSync(lockPath, { force: true })
      } catch {}
      await sleep(40)
    }
  }
  if (fd === null) {
    logger.error("[兑换码] 开关保存失败: 获取锁超时")
    return
  }
  try {
    let disk = {}
    try {
      disk = JSON.parse(fs.readFileSync(switchPath, "utf8"))
    } catch {}
    const merged = { ...disk, ...SWITCH }
    const tmp = `${switchPath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2))
    fs.renameSync(tmp, switchPath)
    SWITCH = merged
  } catch (err) {
    logger.error("[兑换码] 开关保存失败:", err)
  } finally {
    try {
      fs.closeSync(fd)
    } catch {}
    try {
      fs.rmSync(lockPath, { force: true })
    } catch {}
  }
}

// 群聊 @ 发送者，私聊不带 at，避免部分适配器 at 无效
function wrapReply(e, ...contents) {
  const items = contents.filter(Boolean)
  return e?.isGroup && e?.user_id ? [segment.at(e.user_id), "\n", ...items] : items
}

// 归一化文本：折叠空白/换行，避免破坏 markdown 排版
const cleanText = s => String(s ?? "").replace(/\s+/g, " ").trim()

function isCodeExpired(label) {
  const text = cleanText(label)
  const m = text.match(/(\d{1,2})月(\d{1,2})日(?:(\d{1,2})点)?/)
  if (!m) return false
  const month = parseInt(m[1])
  const day = parseInt(m[2])
  let hour = m[3] ? parseInt(m[3]) : 23
  if (hour > 23) hour = 23
  const now = Date.now()
  const year = new Date(now).getFullYear()
  let best = null
  // 在前后一年中取“离现在最近”的同月日时作为过期点，避免跨年误判
  for (const y of [year - 1, year, year + 1]) {
    const t = new Date(y, month - 1, day, hour, 59, 59).getTime()
    if (best === null || Math.abs(t - now) < Math.abs(best - now)) best = t
  }
  return now > best
}


// 全局在途上游请求上限（信号量）：防止洪峰同时打上游
let activeRequests = 0
const requestQueue = []

function acquireSlot() {
  if (activeRequests < MAX_INFLIGHT) {
    activeRequests++
    return Promise.resolve()
  }
  return new Promise(resolve => requestQueue.push(resolve))
}

function releaseSlot() {
  const next = requestQueue.shift()
  if (next) next()
  else activeRequests--
}

// 错误分类：把上游异常翻译为可读提示
function describeError(err) {
  if (err?.status === 429) return "上游触发限流，请稍后再试"
  if (err?.status === 403) return "上游拒绝访问（可能风控），请稍后再试"
  if (err?.status >= 500) return "上游服务异常，请稍后再试"
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return "上游响应超时，请稍后再试"
  return "网络异常，请稍后再试"
}

// 带重试与退避的 fetch；仅对网络错误与 5xx/429 重试，4xx 直接失败
async function fetchWithRetry(url, options = {}, retry = FETCH_RETRY) {
  for (let i = 0; i <= retry; i++) {
    try {
      await acquireSlot()
      let resp
      try {
        resp = await fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      } finally {
        releaseSlot()
      }
      if (!resp.ok) {
        const err = new Error(`API返回 ${resp.status}`)
        err.status = resp.status
        throw err
      }
      return resp
    } catch (err) {
      const retryable = !err.status || err.status === 429 || err.status >= 500
      if (i < retry && retryable) {
        await sleep(300 * (i + 1))
        continue
      }
      throw err
    }
  }
}

async function fetchMiyoliveJSON(url, options = {}) {
  const resp = await fetchWithRetry(url, options)
  return await resp.json()
}

// 解析 JSONP/包裹响应：先整体 JSON，再从末尾回退找可解析的结尾
function parseJSONP(text) {
  const raw = String(text ?? "").trim()
  try {
    return JSON.parse(raw)
  } catch {}
  const start = raw.search(/[[{]/)
  if (start === -1) throw new Error("响应格式异常")
  const closeCh = raw[start] === "[" ? "]" : "}"
  const lastClose = raw.lastIndexOf(closeCh)
  if (lastClose > start) {
    try {
      return JSON.parse(raw.slice(start, lastClose + 1))
    } catch {}
  }
  for (let end = lastClose; end > start; end--) {
    if (raw[end - 1] !== closeCh) continue
    try {
      return JSON.parse(raw.slice(start, end))
    } catch {}
  }
  throw new Error("响应格式异常")
}

async function fetch4399Codes(gameKey) {
  const meta = GAME_META[gameKey]
  if (!meta || meta.source !== "4399") throw new Error(`未知4399游戏: ${gameKey}`)
  const now = new Date()
  const ts = `${now.getFullYear() - 1900}${now.getMonth()}${now.getDate()}${now.getHours()}${now.getMinutes()}`
  const url = `${CODE_API}/data_${meta.file}.js?${ts}&callback=?&_=${Date.now()}`
  const resp = await fetchWithRetry(url, { headers: { Referer: meta.referer || DEFAULT_REFERER } })
  const data = parseJSONP(await resp.text())
  if (!Array.isArray(data)) return []
  return data
    .filter(c => c.is_fail !== "1" && c.order && !INVALID_CODES.has(c.order) && !isCodeExpired(c.label))
    .map(c => ({ code: cleanText(c.order), reward: cleanText(c.reward), label: cleanText(c.label) }))
}

// 由 GAME_META 单一来源解析命令对应游戏（输入已受 rule 约束）
function resolveGame(msg) {
  const lower = msg.toLowerCase()
  for (const { key, tests } of ALIAS_MATCHERS) {
    if (tests.some(test => test(lower))) return key
  }
  if (/^\*/.test(msg)) return "starrail" // 沿用米游插件约定：* 前缀 = 星铁
  if (/^%/.test(msg)) return "zzz" // % 前缀 = 绝区零
  if (/兑换码$/.test(msg)) return "genshin" // 省略游戏名默认原神
  return ""
}

async function fetchMiyoliveActId(meta) {
  try {
    const ret = await fetchMiyoliveJSON(`https://bbs-api.mihoyo.com/painter/api/user_instant/list?offset=0&size=${ACT_LIST_SIZE}&uid=${meta.uid}`)
    for (const p of (ret?.data?.list || [])) {
      const post = p?.post?.post
      if (!post) continue
      const matched = (post.structured_content || "").match(LIVE_LINK_RE)
      if (matched) return { actId: matched[1], createdAt: post.created_at || 0 }
    }
  } catch (err) {
    logger.warn(`[兑换码] 动态取actId失败: ${err?.message || err}`)
  }

  try {
    const nav = await fetchMiyoliveJSON(`https://bbs-api.miyoushe.com/apihub/api/home/new?gids=${meta.gid}&parts=1%2C3%2C4`)
    const hit = (nav?.data?.navigator || []).find(item =>
      /前瞻|特别节目/.test(item?.name || "") && (item?.app_path || "").includes("act_id="))
    if (hit) {
      const m = hit.app_path.match(/act_id=([a-zA-Z0-9]+)/)
      if (m) return { actId: m[1], createdAt: 0 }
    }
  } catch (err) {
    logger.warn(`[兑换码] 导航取actId失败: ${err?.message || err}`)
  }
  return { actId: "", createdAt: 0 }
}

function formatDeadline(createdAt, meta) {
  const date = new Date(createdAt * 1000 + 8 * 60 * 60 * 1000)
  date.setUTCDate(date.getUTCDate() + (meta.deadlineDays || 0))
  const y = date.getUTCFullYear()
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0")
  const d = date.getUTCDate().toString().padStart(2, "0")
  const h = (meta.deadlineHour || 23).toString().padStart(2, "0")
  const tail = meta.deadlineHour === 12 ? "00:00" : "59:59"
  return `${y}-${m}-${d} ${h}:${tail}`
}

async function fetchMiyoliveCodes(meta) {
  const { actId, createdAt } = await fetchMiyoliveActId(meta)
  if (!actId) return null

  const indexResp = await fetchMiyoliveJSON("https://api-takumi.mihoyo.com/event/miyolive/index", {
    headers: { "x-rpc-act_id": actId },
  })
  const live = indexResp?.data?.live
  const remain = Number(live?.remain ?? 0)
  if (!live?.code_ver || remain > 0) return { title: live?.title || "", codes: [], deadline: "" }

  const params = new URLSearchParams({
    version: live.code_ver,
    time: Math.floor(Date.now() / 1000).toString(),
  })
  const codeResp = await fetchMiyoliveJSON(`https://api-takumi-static.mihoyo.com/event/miyolive/refreshCode?${params}`, {
    headers: { "x-rpc-act_id": actId },
  })
  const codeList = codeResp?.data?.code_list
  const codes = Array.isArray(codeList)
    ? codeList.filter(c => c.code).map(c => ({ code: cleanText(c.code), reward: cleanText((c.title || "").replace(/<.*?>/g, "")), label: "" }))
    : []
  const toGetTime = codeList?.[0]?.to_get_time || createdAt
  const deadline = toGetTime ? formatDeadline(toGetTime, meta) : ""
  return { title: cleanText(live.title), codes, deadline }
}

function isQQBot(e) {
  return e?.bot?.version?.id === "QQBot" || e?.adapter_id === "QQBot"
}

function formatCodes(e, gameName, codes, deadline = "") {
  const showInfo = SWITCH.info
  const expireLine = deadline ? `\n过期时间：${deadline}` : ""
  if (isQQBot(e)) {
    const body = codes.map(c => showInfo
      ? `\n${c.reward}${c.label ? " " + c.label : ""}\n\`\`\`兑换码\n${c.code}\n\`\`\`\n`
      : `\n\`\`\`兑换码\n${c.code}\n\`\`\`\n`).join("")
    return segment.markdown(`${gameName}兑换码（共${codes.length}个）${expireLine}\n${body}`)
  }
  const body = codes.map(c => {
    if (!showInfo) return `\n兑换码：${c.code}\n`
    return `\n兑换码：${c.code}\n奖励：${c.reward}\n${c.label ? c.label + "\n" : ""}`
  }).join("")
  return `${gameName}兑换码（共${codes.length}个）${expireLine}\n${body}`
}
