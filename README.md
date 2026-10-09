# 🎁 云崽框架二游兑换码 一键复制

> 作者：小梦

## 功能

| 功能 | 游戏 | 说明 |
|------|------|------|
| 🍱 **米游直连** | 原神/星铁/绝区零 | 直连 miyolive 接口取码，显示过期时间 |
| 🎮 **4399 直查** | 鸣潮/终末地/异环 | 直连 4399 接口，自动过滤已过期码 |
| 📋 **一键复制** | 全部 | QQBot 发 markdown 代码块，非 QQBot 发纯文本 |

---

## 指令

### 查询指令

| 指令 | 游戏 |
|------|------|
| `#原神兑换码` `#兑换码` | 原神 |
| `#星铁兑换码` `#崩铁兑换码` `*兑换码` | 星铁 |
| `#绝区零兑换码` `#zzz兑换码` `%兑换码` | 绝区零 |
| `#鸣潮兑换码` `#ww兑换码` | 鸣潮 |
| `#终末地兑换码` `#end兑换码` | 终末地 |
| `#异环兑换码` `#nte兑换码` | 异环 |

### 开关指令（需 master）

| 指令 | 作用 | 默认 |
|------|------|------|
| `#兑换码原神开/关` | 原神+星铁开关 | 开 |
| `#兑换码绝区零开/关` | 绝区零开关 | 开 |
| `#兑换码ww开/关` | 鸣潮开关 | 开 |
| `#兑换码end开/关` | 终末地开关 | 开 |
| `#兑换码nte开/关` | 异环开关 | 开 |
| `#兑换码信息开/关` | 奖励信息显示开关 | **关** |
| `#兑换码开关` | 查看全部开关状态 | — |

> 奖励信息默认关：只发兑换码（QQBot 代码块可一键复制 / 非 QQBot 纯文本）
> 开启后显示兑换码 + 奖励 + 有效期

---

## 特性

- **按游戏维度缓存**：当天有效，跨日自动清空，最多 6 个 key
- **单飞 + 信号量**：同游戏并发只打一次上游，全局在途请求上限 8
- **错误分类提示**：429 限流 / 403 风控 / 5xx 服务异常 / 超时，均可读提示
- **过期时间**：米游系用 `to_get_time` +1 天推算；4399 系用上游 `label` 原文
- **不依赖 Redis**：纯进程内 Map 缓存，常驻内存 < 20KB

---

## 数据

- 开关状态持久化：`data/兑换码/switch.json`

---

## 安装

国内环境
```bash
wget -O /root/Yunzai/plugins/example/兑换码.js https://ghfast.top/https://raw.githubusercontent.com/shiomon/codes/main/兑换码.js
```

国外环境
```bash
wget -O /root/Yunzai/plugins/example/兑换码.js https://raw.githubusercontent.com/shiomon/codes/main/兑换码.js
```

---

## 致谢

- TimeRainStarSky/Yunzai
- gitcode.com/gscore-mirror/EndUID
- gitcode.com/gscore-mirror/NTEUID
- gitcode.com/gscore-mirror/XutheringWavesUID
