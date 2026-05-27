# 实现计划：个人生辰档案 (user-birth-profile)

## 概述

为占卜应用添加生辰信息专用 API（GET/PUT /api/user/birth-info），包含日期验证、星座自动计算，以及占卜页面自动填充已保存生辰的前端逻辑。后端采用 TypeScript + Express + MySQL，使用 Zod 进行请求验证。

## 任务

- [x] 1. 实现后端生辰信息 API
  - [x] 1.1 在 user.service.ts 中添加 getBirthInfo 和 updateBirthInfo 方法
    - getBirthInfo(userId): 查询 users 表返回 { birthday, zodiacSign }，用户不存在时抛出错误
    - updateBirthInfo(userId, birthday): 验证日期格式（YYYY-MM-DD）、日期合法性（非未来日期、合法日历日期）、计算星座并更新 users 表
    - birthday 为 null 时同时将 zodiac_sign 置为 null
    - 调用已有的 getZodiacFromDate 计算星座
    - _需求: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2_

  - [x] 1.2 在 user.controller.ts 中添加 getBirthInfo 和 updateBirthInfo 控制器方法
    - getBirthInfo: 调用 UserService.getBirthInfo，返回 success(data)
    - updateBirthInfo: 调用 UserService.updateBirthInfo，返回 success(data, '生辰信息更新成功')
    - 错误处理：用户不存在返回 404，验证失败返回 400
    - _需求: 1.1, 1.3, 2.1, 2.6_

  - [x] 1.3 在 user.routes.ts 中注册 GET/PUT /birth-info 路由并添加 Zod 验证 schema
    - 定义 updateBirthInfoSchema：birthday 字段为 string（YYYY-MM-DD 格式正则）或 null
    - GET /birth-info 路由使用 auth 中间件
    - PUT /birth-info 路由使用 auth + validate(updateBirthInfoSchema) 中间件
    - _需求: 1.3, 2.3, 2.6_

  - [ ]* 1.4 为 getBirthInfo 和 updateBirthInfo 编写属性测试
    - **属性 1: 生辰信息 round-trip** — 写入后读取，birthday 应与写入值相同
    - **验证: 需求 1.1, 2.1, 2.2**

  - [ ]* 1.5 为 updateBirthInfo 日期验证编写属性测试
    - **属性 4: 非法日期输入被拒绝** — 不合法格式、未来日期、无效日历日期应返回 400
    - **验证: 需求 2.3, 2.4, 2.5**

- [x] 2. 星座计算验证与幂等性
  - [x] 2.1 验证现有 zodiac.ts 的 getZodiacSign 对全年 365 天的覆盖完整性
    - 检查 getZodiacSign 对每个月每天是否都返回非空星座名
    - 如有遗漏或 bug，修复 zodiacSigns 数据表
    - _需求: 3.3_

  - [ ]* 2.2 为星座计算编写属性测试
    - **属性 3: 星座计算完备性** — 对任意合法月/日，getZodiacSign 返回 12 个中文星座之一
    - **验证: 需求 3.3**

  - [ ]* 2.3 为星座与生辰一致性编写属性测试
    - **属性 2: 星座与生辰一致性** — updateBirthInfo 返回的 zodiacSign 等于 getZodiacFromDate(birthday)
    - **验证: 需求 3.1**

  - [ ]* 2.4 为生辰保存幂等性编写属性测试
    - **属性 6: 生辰保存幂等性** — 连续两次相同 birthday 调用返回相同结果
    - **验证: 需求 6.1**

- [x] 3. 检查点 - 确保后端 API 功能完整
  - 确保所有测试通过，如有疑问请询问用户。

- [ ] 4. 前端占卜页面生辰自动填充
  - [x] 4.1 在占卜页面（命运双盘）初始化时调用 GET /api/user/profile 获取已保存的 birthday，自动填充到 birth_date 输入框
    - 若 birthday 为 null 则保持输入框为空
    - 用户可在表单中自由修改 birth_date，提交时使用表单值（不回写档案）
    - _需求: 4.1, 4.2, 5.1, 5.2_

  - [ ]* 4.2 为占卜不影响档案生辰编写属性测试
    - **属性 5: 占卜不影响档案生辰** — 执行占卜后 users 表中 birthday 不变
    - **验证: 需求 5.1, 5.2, 5.3**

- [x] 5. 个人资料页生辰信息管理 UI
  - [x] 5.1 在个人资料页添加生辰信息编辑区域
    - 添加出生日期选择器（date input），加载时调用 GET /api/user/birth-info 填充当前值
    - 显示自动计算的星座信息（只读）
    - 保存按钮调用 PUT /api/user/birth-info 提交更新
    - 支持清除生辰（发送 birthday: null）
    - _需求: 1.1, 1.2, 2.1, 2.2, 3.1_

- [ ] 6. 集成与联调
  - [x] 6.1 将所有组件串联，确保完整流程可用
    - 个人资料页保存生辰 → 占卜页面自动填充 → 占卜时临时修改不影响档案
    - 验证 401 未授权场景（未登录访问 birth-info API）
    - _需求: 1.3, 2.6, 5.1, 5.2, 5.3_

- [x] 7. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
