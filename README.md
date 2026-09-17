# 🎁 全部游戏 兑换码 一键复制

> 作者：小梦

---

## 功能

| 功能 | 游戏 |  说明 |
|------|------|------|
| 🍱 **米游 hook** | 原神/星铁/绝区零 | hook 原插件 getCode+getData，抑制原发送，发1条 markdown 代码块 |
| 🎮 **API 直查** | 鸣潮/终末地/异环 | 直接调  API 查询，QQBot 代码块可复制，非 QQBot 纯文本 |

> 绝区零、星铁待测
<img width="940" height="827" alt="QQ_1789605434249" src="https://github.com/user-attachments/assets/78e37db4-d43b-4b74-88db-cb0932b06ea8" />
<img width="970" height="420" alt="QQ_1789605454518" src="https://github.com/user-attachments/assets/42d052c4-984b-4a09-bac0-b9c39c4d31e0" />
<img width="973" height="904" alt="QQ_1789605477981" src="https://github.com/user-attachments/assets/4d9f92c9-cb0c-44a4-912c-a0e1c4e37a10" />

---

## 指令

### 查询指令

| 指令  |
|------|
| `#原神兑换码` `#兑换码` |
| `#鸣潮兑换码` `ww兑换码` |
| `#终末地兑换码` `end兑换码`  |
| `#异环兑换码` `nte兑换码`  |

### 开关指令

| 指令 | 作用 | 默认 |
|------|------|------|
| `#兑换码原神开/关` | 米游兑换码开关 | 开 |
| `#兑换码ww开/关` | 鸣潮兑换码开关 | 开 |
| `#兑换码end开/关` | 终末地兑换码开关 | 开 |
| `#兑换码nte开/关` | 异环兑换码开关 | 开 |
| `#兑换码信息开/关` | 奖励信息显示开关 | **关** |
| `#兑换码开关` | 查看全部开关状态 | — |

> 奖励信息默认关：只发兑换码（QQBot 代码块可一键复制 / 非 QQBot 纯文本）
> 开启后显示兑换码 + 奖励 + 有效期

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
 *        gitcode.com/TimeRainStarSky/Yunzai
 *        gitcode.com/gscore-mirror/EndUID
 *        gitcode.com/gscore-mirror/NTEUID
 *        gitcode.com/gscore-mirror/XutheringWavesUID
