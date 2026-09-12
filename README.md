# 🎁 全部游戏 兑换码 一键复制

> 作者：小梦

QQBot 下兑换码追加发送可复制代码块。

当用户发送 `兑换码`、`code` 等指令时，原插件正常发送兑换码消息后，自动追加一条带代码块的消息，每个兑换码包裹在 ` ```兑换码 ` 代码块中，QQBot 客户端可一键复制。

## ✨ 功能

- 🔍 自动提取消息中的兑换码（大写字母+数字，6~20位）
- 📋 追加发送 markdown 代码块，支持 QQ 上一键复制
- 🚫 不修改原消息，不影响原插件发送
- 🤖 仅 QQBot 生效，其他适配器无影响
- <img width="1190" height="686" alt="ce7657ad18b651a5561055717356b9f7" src="https://github.com/user-attachments/assets/98ed9cf3-52f7-4a7a-a1cf-030afdff38f3" />
<img width="478" height="632" alt="ee51b9d245ced2a137445a4b9b6698ee" src="https://github.com/user-attachments/assets/43dce2f6-a0a8-4865-84e4-f7f8c43e561e" /><img width="1076" height="2144" alt="744201ef1336df76cb2cf8d9c06a92e0" src="https://github.com/user-attachments/assets/fcf175d3-7819-4551-910d-38f1ef8c5490" />




## 📦 安装

```bash
# 下载到 Yunzai 的 plugins/example 目录
wget -O /root/Yunzai/plugins/example/兑换码.js https://ghfast.top/https://raw.githubusercontent.com/shiomon/codes/main/兑换码.js
```

## 📖 使用

发送任意包含 `兑换码` 或 `code` 关键词的指令即可。全部游戏，理论上经过 QQBot-plugin 的都可以，例如：
(米哈游游戏待测，没到前瞻)
- `#兑换码`
- `*兑换码`
- `%兑换码`
- `end兑换码`
- `nte兑换码`
- `zzz兑换码`

机器人会在原消息后追加一条代码块消息，每个兑换码可单独复制。

## 📝 说明

- 插件 priority 为 1，仅做拦截包装，不影响其他插件处理
- SDK 劫持在发送完成后 10 秒自动恢复，不影响后续消息
- 仅在 QQBot 适配器下生效（`e.bot.version.id === 'QQBot'`）
