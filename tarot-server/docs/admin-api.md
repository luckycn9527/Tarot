# 管理后台接口文档

## 认证说明

- Base URL: `/api`
- 管理接口统一使用 `Authorization: Bearer <admin_access_token>`
- 登录成功后返回 `accessToken`

## 1) 管理员登录

- `POST /admin/auth/login`
- 请求体：

```json
{
  "username": "admin",
  "password": "your-password"
}
```

- 返回：

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "admin": {
      "id": 1,
      "displayName": "系统管理员"
    }
  },
  "message": "登录成功"
}
```

## 2) 用户信息管理

- `GET /admin/users?page=1&pageSize=20&keyword=abc`
- `PATCH /admin/users/{id}`

可更新字段：
- `nickname`
- `avatar`
- `membership` (`free|vip`)
- `membership_expires_at` (ISO datetime or null)
- `remaining_free_quota` (>= 0)

## 3) 牌背配置

- `GET /admin/config/card-backs`
- `PUT /admin/config/card-backs`

```json
{
  "items": [
    {
      "code": "classic",
      "name": "经典牌背",
      "assetUrl": null,
      "isActive": true,
      "sortOrder": 1
    }
  ]
}
```

## 4) 卡面配置

- `GET /admin/config/cards`
- `PUT /admin/config/cards`

```json
{
  "items": [
    {
      "id": 0,
      "name": "愚者",
      "nameEn": "The Fool",
      "uprightKeywords": "开始、自由、冒险",
      "reversedKeywords": "冲动、鲁莽、逃避",
      "yesNoTendency": "yes",
      "imageUrl": null,
      "isActive": true
    }
  ]
}
```

## 5) 塔罗师提示词配置

- `GET /admin/config/readers-prompts`
- `PUT /admin/config/readers-prompts`

```json
{
  "items": [
    {
      "readerCode": "moyi",
      "systemPrompt": "你是茉伊...",
      "greeting": "亲爱的，欢迎..."
    }
  ]
}
```

## 6) 数据概览统计

- `GET /admin/stats`

返回：

```json
{
  "success": true,
  "data": {
    "totalUsers": 100,
    "todayUsers": 5,
    "totalReadings": 1200,
    "todayReadings": 30,
    "totalFeedback": 20,
    "pendingFeedback": 3
  }
}
```

## 7) 反馈管理

- `GET /admin/feedback?page=1&pageSize=20&status=pending`
- `PATCH /admin/feedback/{id}`

回复请求体：

```json
{
  "adminReply": "感谢您的反馈，我们已处理...",
  "status": "resolved"
}
```

status 可选值：`processing` | `resolved` | `closed`

## 安全与存储要求（已落实）

- 管理员用户名：后端 `HMAC-SHA256(pepper, normalized_username)` 哈希后存储在 `admin_users.username_hash`
- 管理员密码：后端 `bcrypt` 加盐哈希后存储在 `admin_users.password_hash`
- 登录校验：对用户名做同算法哈希后查库，并用 `bcrypt.compare` 校验密码
