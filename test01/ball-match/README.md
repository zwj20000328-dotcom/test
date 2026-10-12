# 球球消消乐 - Sports Ball Match Game

一款将三消玩法与球类运动结合的创意休闲游戏。

## 游戏特色

- 🏀 **篮球** - 4连消触发"扣篮"，清除整行
- ⚽ **足球** - 4连消触发"射门"，清除3×3区域
- 🎾 **网球** - 4连消触发"弹跳"，随机消除5个球
- ⚾ **棒球** - 4连消触发"全垒打"，清除整列
- 🏐 **排球** - 4连消触发"扣杀"，清除十字区域
- 🏓 **乒乓球** - 4连消触发"旋转"，清除对角线
- 🌟 **5连消** - 触发"超级连击"，清除场上所有同类球
- 🔥 **Combo系统** - 连续消除获得倍率加分

## 技术架构

- **后端**: C++17 + cpp-httplib + nlohmann/json
- **前端**: Vue 3 + Vite
- **通信**: RESTful API

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端将运行在 http://localhost:5173

### 后端

需要 CMake 3.14+ 和 C++17 编译器。

```bash
cd backend
mkdir build && cd build
cmake ..
cmake --build .
./BallMatchServer
```

后端将运行在 http://localhost:8080

### 仅前端模式

前端内置了完整的游戏引擎，即使不启动后端也可以正常游玩。后端主要提供排行榜和分数验证功能。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/new-game | 创建新游戏 |
| POST | /api/swap | 交换两个球 |
| GET | /api/state/:sid | 获取游戏状态 |
| POST | /api/score | 提交分数 |
| GET | /api/leaderboard | 获取排行榜 |

## 玩法说明

1. 点击选中一个球，再点击相邻的球进行交换
2. 移动端支持滑动操作
3. 三个或以上相同球连成一线即可消除
4. 4连消触发对应球类的特殊技能
5. 5连消触发超级连击
6. 连锁消除获得Combo倍率加分
