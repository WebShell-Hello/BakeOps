# BakeOps

BakeOps 是一套面向面包店日常运营与经营决策的内部管理平台。项目以单店为当前落地场景，逐步连接人员、配方、库存、采购、生产、销售、损耗、成本和经营分析，并为未来多门店扩展保留清晰边界。

> 当前状态基准：2026-08-14。业务蓝图、实施状态、工程约定和路线图详见 [V1.2 中文设计说明书](docs/Bakery_Operations_Website_Design_Spec_V1.2_CN.docx)。

## 项目资料

- [功能逻辑架构图（Draw.io）](docs/diagrams/bakeops-functional-architecture.drawio)
- [功能逻辑架构图（Mermaid）](docs/diagrams/bakeops-functional-architecture.mmd)
- [数据结构图（Draw.io）](docs/diagrams/bakeops-data-structure.drawio)
- [数据结构图（Mermaid）](docs/diagrams/bakeops-data-structure.mmd)
- [数据字典（Excel）](docs/BakeOps_Data_Dictionary.xlsx)
- [门店老板版使用说明书（Word）](docs/BakeOps_Owner_User_Guide.docx)

`.posm` 不是当前项目或主流图表工具普遍支持的标准格式，因此架构图提供 Draw.io 可编辑文件和 Mermaid 源文件两种格式。

## 当前进度

### 已实现

- 响应式管理后台、顶部栏、桌面/移动端侧边栏、面包屑、Toast 和统一空状态
- 邮箱登录、Session + CSRF、记住登录、退出和数字图形验证码注册
- 个人资料、密码和账户偏好，包括中英文、主题、时区、日期格式及表格页大小
- 系统用户管理：搜索、新增、编辑、删除、批量删除、锁定、密码重置和多角色分配
- 角色与页面权限：角色 CRUD、删除/恢复、保护角色和页面级访问控制
- 数据库驱动的动态导航：中英文标签、图标、路径、可见性和拖拽排序
- 员工档案：增改、搜索、软删除、恢复和批量操作
- 员工排班：日期范围、班次、起止时间、备注、增改删和批量删除
- 产品与配方：中英文产品名、配方分区、原料、制作步骤、配方总重量和配方产量
- 修改配方产量时，按比例缩放配方中每项原料重量
- 供应商管理：供应商资料、食材价格、计价单位、MOQ、提前天数、采购备注、停用与首选供应商
- `Supplier -> SupplierIngredient <- Ingredient` 多对多关系，以及基于当前配方食材的 20 家模拟供应商
- 中英文通用分页和可手动输入的每页行数
- 生产计划：历史实际制作、当前计划、未来计划和计划/实际状态
- 库存管理：未来 14 天生产需求、库存覆盖天数、预计不足日期和采购预警
- 采购入库和进货记录：食材、数量、采购单价、采购时间、供应商和库存价值
- 活动管理：节假日、门店活动、准备期和休息/停业日期
- 销售分析：真实销售收入、销售数量、订单、折扣、退款、实际成交价和每日明细
- 成本管理：员工工资、生产物料成本、每月其他经营成本和历史月份明细
- 盈利与产品表现：整体盈利 KPI、利润趋势、成本结构、产品贡献毛利和四象限
- Django API、PostgreSQL 健康检查、OpenAPI Schema 和 Swagger 文档
- 同一 Wi-Fi 下的手机访问与登录

### 当前口径

```text
净销售收入 = 实际支付金额 - 退款
员工工资 = 排班实际工时 × 员工时薪
物料成本 = 生产数量 × 产品材料成本
产品贡献毛利 = 产品实际净销售收入 - 产品材料成本
经营利润 = 净销售收入 - 物料成本 - 员工工资 - 其他经营成本
```

产品层暂不分摊房租、人工和水电，因此显示“贡献毛利”，不伪装成精确的 SKU 净利润。

### 待开发

- POS/订单数据的稳定导入和销售数据校验
- 库存批次、损耗、库存移动和真实出库记录
- Yield Rate、半成品配方、包装和损耗成本
- 活动建议到生产计划/采购计划的确认工作流
- 多门店、审计日志、通知、备份恢复和生产部署体系

导航中存在页面或 Dashboard 中存在卡片，不代表对应业务能力已经完成。当前完成度以代码、迁移、测试和上述状态说明为准。

## 技术架构

| 层级 | 技术 | 职责 |
| --- | --- | --- |
| Frontend | Next.js 16.3、React 19.2、TypeScript 5.9、Tailwind CSS 4 | App Router 管理界面、响应式交互、国际化和主题 |
| Backend | Python 3.13、Django 5.2 LTS、Django REST Framework 3.16 | 领域模型、REST API、认证、权限和业务校验 |
| Database | PostgreSQL 17 | 关系数据、约束、索引和迁移 |
| API Docs | drf-spectacular / OpenAPI | Schema 与 Swagger 文档 |
| Runtime | Docker Compose | frontend、backend、postgres 本地编排 |
| Quality | ESLint、TypeScript、pytest、Ruff、mypy | 静态检查、类型检查和自动化测试 |

浏览器统一请求同源 `/api/v1`，由 Next.js 代理到 Docker 网络中的 Django backend。前端业务代码通过 `frontend/src/lib/api.ts` 访问 API，不直接读取本地 JSON 或 CSV。

```text
Browser
  -> Next.js /api/v1
  -> Django REST Framework
  -> PostgreSQL
```

## 核心约定

- 邮箱是登录标识，并具有不区分大小写的唯一约束。
- 用户名是显示属性，可以重复并保留输入时的大小写。
- 用户可以拥有多个角色，最终页面权限取所有角色页面权限的并集。
- 权限和敏感业务规则必须由后端执行，不能只依赖前端隐藏按钮。
- 领域模型默认使用 UUID；数据库关联不使用产品名、用户名等可变显示值。
- 需要保留历史的数据优先使用软删除；任何模型变化必须包含 Django migration。
- 金额和重量使用 `Decimal`，所有数量必须具有明确单位。
- 新增用户可见文案必须同时支持 `zh-CN` 和 `en-GB`；英文含义以确认后的中文业务含义为基准。
- 开发和演示使用合成数据，但始终运行真实 PostgreSQL、REST API、权限和迁移。
- 排班是未来计划，实际考勤是已发生事实；后续不得直接使用计划排班计算工资。
- 供应商报价、实际进货单价和库存平均成本是三个不同概念，不能混用。
- 历史业务数据优先软删除或停用，不能因为当前产品或员工被删除而破坏历史记录。
- 用户未明确要求时，不同步 README、Word、Excel 或项目状态文档，避免无关文档 churn。

## 项目结构

```text
BakeOps/
├── backend/
│   ├── bakeops/
│   │   ├── access/       # 角色与页面权限
│   │   ├── costs/        # 成本、工资、物料成本
│   │   ├── api/          # API 汇总与健康检查
│   │   ├── common/       # UUID 与时间戳基础模型
│   │   ├── employees/    # 员工档案
│   │   ├── events/       # 活动、节假日和营业状态
│   │   ├── inventory/    # 库存、生产计划和进货记录
│   │   ├── navigation/   # 动态菜单
│   │   ├── products/     # 产品、原料与配方
│   │   ├── sales/        # 销售分析和盈利分析
│   │   ├── scheduling/   # 员工排班
│   │   ├── suppliers/    # 供应商及食材采购条件
│   │   └── users/        # 认证、用户和账户偏好
│   └── config/           # Django 设置、URL、WSGI/ASGI
├── frontend/
│   └── src/
│       ├── app/          # Next.js 页面与路由
│       ├── components/   # 按业务领域组织的组件
│       ├── hooks/        # 共享 Hooks
│       └── lib/api.ts    # 统一 API 访问层与类型
├── docs/
│   └── architecture/     # 架构决策记录 ADR
├── scripts/              # 文档维护等项目脚本
├── compose.yaml
└── Makefile
```

后端领域应用通常包含 `models.py`、`serializers.py`、`views.py`、`urls.py`、`permissions.py`、`tests/` 和 `migrations/`。增加功能前应先搜索相邻领域和现有组件，避免重复逻辑。

## 启动开发环境

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

默认入口：

- 前端：`http://localhost:3000`（以 `.env` 的 `FRONTEND_PORT` 为准）
- API 健康检查：`http://localhost:8000/api/v1/health/`
- OpenAPI Schema：`http://localhost:8000/api/schema/`
- Swagger：`http://localhost:8000/api/docs/`
- Django Admin：`http://localhost:8000/admin/`

所有应用容器、命名卷和 Docker 网络使用 `BO-` 前缀。

## 手机访问

手机和电脑连接同一 Wi-Fi 后，使用电脑局域网 IP 访问前端，例如：

```text
http://192.168.1.61:3000
```

局域网 IP 发生变化时，需要同步更新 `.env` 中的：

- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `NEXT_ALLOWED_DEV_ORIGINS`

浏览器 API 地址应继续使用同源的 `NEXT_PUBLIC_API_BASE_URL=/api/v1`，不要改成手机无法访问的 `localhost:8000`。

## 常用命令

```bash
make up                 # 构建并启动服务
make down               # 停止服务
make logs               # 查看服务日志
make ps                 # 查看容器状态
make migrate            # 执行数据库迁移
make makemigrations     # 生成迁移
make test               # 执行后端测试
make check              # Django、Ruff、mypy、ESLint、TypeScript 检查
make shell              # 进入 Django shell
```

生成或刷新供应商模拟数据：

```bash
docker compose exec backend python manage.py seed_demo_suppliers
```

该命令要求当前产品配方食材已经存在；命令可重复执行，并将 20 家演示供应商恢复为每家 2～3 种食材的基准数据。

单独执行前端检查：

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run build
```

## 数据与安全

- 开发和演示数据必须是合成数据，不要提交真实客户、员工、薪资或供应商敏感信息。
- `.env.example` 中的密钥、数据库密码和默认用户密码仅供本地开发。
- 生产环境必须替换所有默认凭据，并启用 HTTPS、Secure Cookie、安全域名和受控环境变量注入。
- 不要提交 `.env`、数据库备份、日志、会话信息或其他秘密文件。

## 下一阶段

当前重点是把已有演示数据链路逐步替换为真实业务输入：

1. 建立 POS/订单数据导入和销售数据校验。
2. 增加库存批次、损耗、库存移动和真实出库记录。
3. 增加 Yield Rate、半成品配方、包装和损耗成本。
4. 将活动准备建议连接到可确认的生产计划和采购计划。
5. 完善盈利分析的历史成本口径、导出和多门店扩展。
6. 建立审计日志、通知、备份恢复和生产部署流程。

详细里程碑和未来展望请阅读 [V1.2 中文设计说明书](docs/Bakery_Operations_Website_Design_Spec_V1.2_CN.docx)。重要且跨模块的技术决策应新增到 [docs/architecture](docs/architecture/) 中。

## Agent / 开发者接手顺序

1. 阅读本 README 和设计说明书第 13—18 章。
2. 阅读 `compose.yaml`、`.env.example` 和现有 ADR。
3. 查看目标领域的后端模型、接口、权限、测试与前端 API 类型。
4. 检查当前工作区改动，不覆盖或回滚来源不明的修改。
5. 按现有架构完成代码、迁移、测试、中英文文案和桌面/手机联调。
6. 当模块状态或核心约定改变时，同步更新 README、说明书和必要的 ADR。
