# 🎁 全部游戏 兑换码 一键复制

> 作者：小梦

---

## v2 重构（2026-09-16）

- 🎮 **4399游戏直查**：鸣潮/终末地/异环 直接调4399 API 查询兑换码，全适配器生效
- 🍱 **米游hook**：原神/星铁/崩三/绝区零 hook getCode，仅官机生效
- 🔧 **开关指令**：每个游戏可单独开/关，状态持久化 `data/兑换码/switch.json`

### 指令

| 指令 | 说明 | 适配器 |
|------|------|--------|
| `#原神兑换码` / `#星铁兑换码` | 米游兑换码（hook原插件） | 仅官机 |
| `#鸣潮兑换码` / `ww兑换码` | 鸣潮兑换码（4399 API） | 全适配器 |
| `#终末地兑换码` / `end兑换码` | 终末地兑换码（4399 API） | 全适配器 |
| `#异环兑换码` / `nte兑换码` | 异环兑换码（4399 API） | 全适配器 |

### 开关指令

| 指令 | 作用 |
|------|------|
| `#兑换码原神开/关` | 米游兑换码开关 |
| `#兑换码ww开/关` | 鸣潮兑换码开关 |
| `#兑换码end开/关` | 终末地兑换码开关 |
| `#兑换码nte开/关` | 异环兑换码开关 |
| `#兑换码开关` | 查看全部开关状态 |

### 4399 API 数据源

| 游戏 | 文件 | 来源 |
|------|------|------|
| 鸣潮 | `data_102.js` | 4399.com |
| 终末地 | `data_171.js` | 4399.com |
| 异环 | `data_173.js` | onebiji.com |

---

## v1 原版

QQBot 下兑换码追加发送可复制代码块。

当用户发送 `兑换码`、`code` 等指令时，原插件正常发送兑换码消息后，自动追加一条带代码块的消息，每个兑换码包裹在 ` ```兑换码 ` 代码块中，QQ可一键复制。

### ✨ 功能

- 🔍 自动提取消息中的兑换码（大写字母+数字，6~20位，原神支持中文）
- 📋 追加发送 markdown 代码块，支持 QQ 上一键复制
- 🚫 不修改原消息，不影响原插件发送
- 🤖 仅 QQBot 生效，其他适配器无影响

<img width="525" height="773" alt="c5e20570-48a1-4f8a-91f4-3034e8418bc2" src="https://github.com/user-attachments/assets/cf357f30-3ead-4589-8438-cb9aa33d391b" />
<img width="715" height="677" alt="QQ_1789225107286" src="https://github.com/user-attachments/assets/c0862a64-6b6a-416a-8ecc-20ce95971cb3" />
<img width="700" height="679" alt="QQ_1789225131218" src="https://github.com/user-attachments/assets/cf52540d-16ae-41ac-8911-d9f5f59cdef9" />
<img width="711" height="729" alt="image" src="https://github.com/user-attachments/assets/a46a99ae-ce6a-4a00-8bd9-170f690d76c1" />

### 📦 安装

国内环境
```bash
wget -O /root/Yunzai/plugins/example/兑换码.js https://ghfast.top/https://raw.githubusercontent.com/shiomon/codes/main/兑换码.js
```

国外环境
```bash
wget -O /root/Yunzai/plugins/example/兑换码.js https://raw.githubusercontent.com/shiomon/codes/main/兑换码.js
```

### 📖 使用

发送任意包含 `兑换码` 或 `code` 关键词的指令即可。全部游戏，理论上经过 QQBot-plugin 的都可以，例如：
(星铁，绝区零待测，没到前瞻)
- ✅ `#兑换码`
- ✅ `end兑换码`
- ✅ `nte兑换码`
- ✅ `ww兑换码`
- `*兑换码`
- `%兑换码`

机器人会在原消息后追加一条代码块消息，每个兑换码可单独复制。

### 📝 说明

- 插件 priority 为 1，仅做拦截包装，不影响其他插件处理
- SDK 劫持在发送完成后 30 秒自动恢复，不影响后续消息
- 仅在 QQBot 适配器下生效（`e.bot.version.id === 'QQBot'`）
