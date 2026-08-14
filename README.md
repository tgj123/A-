# A股资金流能量场

手机竖屏优先的 Three.js H5，用三维能量塔和资金粒子展示每日 A 股板块资金流。页面自动依次播放：

- 上午盘：09:30—11:30
- 下午盘：13:30—15:00
- 全天：上午盘与下午盘合并对比

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开终端显示的地址。电脑端会以手机竖屏画布居中展示，也可使用浏览器设备模式预览手机效果。

生产构建：

```bash
npm run build
npm run preview
```

## 数据模式

默认使用按交易日稳定生成的演示数据，方便在腾讯接口文档和权限尚未配置时直接预览动画。页面右上角会明确显示“演示数据”。

复制 `.env.example` 为 `.env.local`，并配置：

```env
VITE_DATA_MODE=tencent
VITE_TENCENT_FUND_FLOW_ENDPOINT=/api/tencent/fund-flow
VITE_TENCENT_APP_ID=your_app_id
```

腾讯适配器位于 `src/data/fundFlow.ts`。当前约定接口返回：

```json
{
  "data": {
    "tradingDate": "2026-08-06",
    "morning": [
      {
        "code": "BK0001",
        "name": "半导体",
        "netInflow": 1250000000,
        "changePercent": 2.16,
        "leadingStock": "中芯国际"
      }
    ],
    "afternoon": []
  }
}
```

请求会附带以下查询参数：

- `date`
- `morningStart=09:30`
- `morningEnd=11:30`
- `afternoonStart=13:30`
- `afternoonEnd=15:00`
- `appId`（配置后）

如果腾讯接口需要密钥签名或不支持浏览器 CORS，请让 `VITE_TENCENT_FUND_FLOW_ENDPOINT` 指向自己的轻量代理接口，不要把 `AppSecret` 写进前端环境变量。

## 交互

- 自动连续播放三个章节
- 上午盘、下午盘、全天手动切换
- 暂停、继续、重新播放
- 点击能量塔或前三名卡片查看板块
- 页面进入后台时保留播放进度，避免后台持续累积动画时间

## 主要技术

- React + TypeScript + Vite
- Three.js `InstancedMesh` 批量绘制板块能量塔
- `Points` 批量绘制资金粒子
- 响应式像素比和资源主动释放，适配移动端 WebGL
