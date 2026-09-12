# 兑换码复制

QQBot 下兑换码追加发送可复制代码块。

当用户发送 `兑换码`、`code` 等指令时，原插件正常发送兑换码消息后，自动追加一条带代码块的消息，每个兑换码包裹在 ` ```兑换码 ` 代码块中，QQBot 客户端可一键复制。

## 功能

- 自动提取消息中的兑换码（大写字母+数字，6~20位）
- 追加发送 markdown 代码块，支持一键复制
- 不修改原消息，不影响原插件发送
- 仅 QQBot 生效，其他适配器无影响

## 安装

```bash
# 下载到 Yunzai 的 plugins/example 目录
wget -O /root/Yunzai/plugins/example/兑换码.js https://ghfast.top/https://raw.githubusercontent.com/shiomon/codes/main/兑换码.js
```

## 使用

发送任意包含 `兑换码` 或 `code` 关键词的指令即可，例如：

- `#兑换码`
- `end兑换码`
- `nte兑换码`
- `zzz兑换码`

机器人会在原消息后追加一条代码块消息，每个兑换码可单独复制。

## 说明

- 插件 priority 为 1，仅做拦截包装，不影响其他插件处理
- SDK 劫持在发送完成后 10 秒自动恢复，不影响后续消息
- 仅在 QQBot 适配器下生效（`e.bot.version.id === 'QQBot'`）