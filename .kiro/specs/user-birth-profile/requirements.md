# 需求文档

## 简介

为占卜应用新增「个人生辰档案」功能，允许用户在个人资料页保存出生日期，占卜页面自动填充已保存的生辰，并支持占卜时临时修改出生日期而不影响档案中的持久化值。系统根据出生日期自动计算星座信息。

## 术语表

- **System**: 占卜应用的后端服务（Express API + MySQL）
- **BirthInfo_API**: 生辰信息专用 REST 接口（GET/PUT /api/user/birth-info）
- **UserService**: 用户服务层，负责生辰信息的业务逻辑处理
- **ZodiacCalculator**: 星座计算工具函数 getZodiacFromDate，根据日期返回中文星座名
- **Divination_Form**: 占卜页面的前端表单组件，包含 birth_date 输入框
- **FateAnalyzer**: 命运双盘占卜分析服务（/api/fate/analyze）
- **Validator**: 请求参数验证层（Zod schema 或手动校验）

## 需求

### 需求 1：获取生辰信息

**用户故事：** 作为已登录用户，我希望能获取自己保存的生辰信息，以便在占卜页面或个人资料页查看。

#### 验收标准

1. WHEN 已认证用户请求 GET /api/user/birth-info, THE BirthInfo_API SHALL 返回该用户的 birthday 和 zodiacSign 字段
2. WHEN 用户尚未保存过生辰信息, THE BirthInfo_API SHALL 返回 birthday 为 null 且 zodiacSign 为 null
3. IF 请求未携带有效认证令牌, THEN THE BirthInfo_API SHALL 返回 401 未授权错误

### 需求 2：保存生辰信息

**用户故事：** 作为已登录用户，我希望能保存自己的出生日期到个人档案，以便占卜时自动填充。

#### 验收标准

1. WHEN 用户提交 PUT /api/user/birth-info 且 birthday 为合法的 YYYY-MM-DD 日期字符串, THE BirthInfo_API SHALL 将 birthday 更新到 users 表并返回更新后的 birthday 和 zodiacSign
2. WHEN 用户提交 PUT /api/user/birth-info 且 birthday 为 null, THE BirthInfo_API SHALL 将 users 表中的 birthday 和 zodiac_sign 同时置为 null
3. IF birthday 不符合 YYYY-MM-DD 格式, THEN THE Validator SHALL 拒绝请求并返回 400 错误
4. IF birthday 对应的日期晚于当天, THEN THE Validator SHALL 拒绝请求并返回 400 错误
5. IF birthday 对应的日期不是合法日历日期（如 2月30日）, THEN THE Validator SHALL 拒绝请求并返回 400 错误
6. IF 请求未携带有效认证令牌, THEN THE BirthInfo_API SHALL 返回 401 未授权错误

### 需求 3：星座自动计算

**用户故事：** 作为已登录用户，我希望系统根据我的出生日期自动计算星座，以便在个人资料和占卜中使用。

#### 验收标准

1. WHEN birthday 被更新为非 null 值, THE ZodiacCalculator SHALL 根据该日期计算对应的中文星座名并存入 zodiac_sign 字段
2. WHEN birthday 被更新为 null, THE UserService SHALL 将 zodiac_sign 同时置为 null
3. THE ZodiacCalculator SHALL 对一年中的每一天（1月1日至12月31日）返回且仅返回 12 个星座之一

### 需求 4：占卜页面自动填充生辰

**用户故事：** 作为已登录用户，我希望占卜页面自动填充我保存的出生日期，以便减少重复输入。

#### 验收标准

1. WHEN 占卜页面加载且用户已保存 birthday, THE Divination_Form SHALL 将 birth_date 输入框自动填充为用户档案中的 birthday 值
2. WHEN 占卜页面加载且用户未保存 birthday, THE Divination_Form SHALL 保持 birth_date 输入框为空

### 需求 5：占卜时临时修改生辰不影响档案

**用户故事：** 作为已登录用户，我希望在占卜时可以临时修改出生日期进行占卜，而不影响我个人档案中保存的生辰。

#### 验收标准

1. WHEN 用户在占卜表单中修改 birth_date 并提交占卜请求, THE FateAnalyzer SHALL 使用表单中提交的 birth_date 进行占卜计算
2. WHEN 占卜请求完成后, THE System SHALL 保持 users 表中该用户的 birthday 字段不变
3. WHEN 占卜结果被记录, THE FateAnalyzer SHALL 将提交的 birth_date 存入 bazi_results 表而非回写 users 表

### 需求 6：生辰保存的幂等性

**用户故事：** 作为系统开发者，我希望生辰保存操作是幂等的，以便重复提交相同数据不会产生副作用。

#### 验收标准

1. WHEN 用户连续两次提交相同的 birthday 值, THE BirthInfo_API SHALL 返回相同的结果且数据库状态保持一致
