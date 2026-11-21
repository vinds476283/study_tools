# 这里放私密数据（整个目录不进 git，只有本说明文件除外）

服务和 `start-windows.bat` 第一次运行时会自动建出这个目录。里面需要两个文件，
把下面的模板复制出来、改名、填内容即可。

## appid.txt

一行，就是 Wolfram|Alpha 的 App ID，前后不要有空格：

```
ABCD-1234567890
```

## tokens.json

允许使用的人的 token 名单，两种写法都行：

```
["token1", "token2"]
```

```
{
  "tokens": [
    { "token": "token1", "note": "张三" },
    { "token": "token2", "note": "李四" }
  ]
}
```

## usage.json

不用手写。服务每算一次会自己更新，长这样：

```
{
  "2026-11-22": { "token1": 3 }
}
```

只保留最近 30 天。

## 注意

- 这三个文件里是 App ID 和 token，**不要提交、不要截图发人**。
- 部署到静态网站时，别把 `server/` 目录公开出去（`server/.htaccess` 和`server/web.config` 已经做了拒绝访问，nginx 的配置见 `server/README.md`）。
