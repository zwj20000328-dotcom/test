# WorkNotes Pro - 摸鱼神器 (C++ Win32 版)

一款使用纯 C++ Win32 API 开发的伪装办公笔记软件，支持电子书阅读和在线考试。

## 特性

### 表面功能（伪装）
- 专业笔记管理界面（菜单栏、工具栏、侧边栏）
- 文件夹树形分类管理
- 多行文本编辑器
- 字数统计、日期时间插入
- 全屏模式

### 隐藏功能（摸鱼）
- **电子书阅读器**：支持 TXT 格式，分页阅读
- **试题考试系统**：支持 JSON 格式试题，自动评分

### 核心机制
- **鼠标悬停显示**：激活后鼠标移入编辑区显示摸鱼面板，移出自动隐藏
- **全局快捷键**：随时激活/关闭隐藏功能
- **无外部依赖**：纯 Win32 API，无需安装任何框架

## 编译

### 方式一：MSVC (Visual Studio)
```cmd
# 打开 "x64 Native Tools Command Prompt for VS"
# 或先运行 vcvarsall.bat x64
build_msvc.bat
```

### 方式二：MinGW (g++)
```cmd
build_mingw.bat
```

## 运行
```cmd
WorkNotesPro.exe
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建笔记 |
| `Ctrl+S` | 保存笔记 |
| `Ctrl+Shift+E` | **激活/关闭电子书阅读器** |
| `Ctrl+Shift+Q` | **激活/关闭考试系统** |
| `Ctrl+Shift+W` | **老板键 - 立即关闭所有隐藏功能** |

## 使用流程

### 电子书阅读
1. 按 `Ctrl+Shift+E` 激活（状态栏显示 "Armed [E-Reader]"）
2. 鼠标移入编辑区域 → 自动显示阅读器
3. 点击 "Load Document" 加载 TXT 文件
4. 使用 Previous/Next 翻页
5. 鼠标移出编辑区域 → 自动恢复笔记界面
6. 再按 `Ctrl+Shift+E` 或 `Ctrl+Shift+W` 完全关闭

### 考试系统
1. 按 `Ctrl+Shift+Q` 激活（状态栏显示 "Armed [Checklist]"）
2. 鼠标移入编辑区域 → 自动显示考试面板
3. 点击 "Load Task List" 加载 JSON 试题
4. 选择答案，点击 Next 进入下一题
5. 完成后点击 "Submit All" 查看成绩
6. 鼠标移出 → 自动恢复笔记界面

## 试题格式 (JSON)

```json
{
  "questions": [
    {
      "question": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": "A"
    }
  ]
}
```

- `question`: 题目文本
- `options`: 选项数组（最多4个）
- `answer`: 正确答案（A/B/C/D）

示例文件：`sample_questions.json`

## 伪装设计

- 主窗口标题：`WorkNotes Pro - Professional Note Management`
- 状态栏模式指示：
  - `Mode: Normal` — 正常笔记模式（灰色）
  - `Mode: Armed [E-Reader]` — 电子书已激活（橙色提示）
  - `Mode: Armed [Checklist]` — 考试已激活（橙色提示）
  - `Mode: Reference` — 正在阅读（蓝色）
  - `Mode: Checklist` — 正在考试（蓝色）

## 文件说明

```
WorkNotesPro/
├── main.cpp              # 主程序源码（纯 C++ Win32）
├── build_msvc.bat        # MSVC 编译脚本
├── build_mingw.bat       # MinGW 编译脚本
├── sample_questions.json # 示例试题
├── sample_book.txt       # 示例电子书
└── README.md             # 说明文档
```

## 系统要求

- Windows 7 及以上
- 编译器：MSVC 2017+ 或 MinGW-w64 (g++ 支持 C++17)
- 无需安装任何额外运行时库

## 技术栈

- 语言：C++17
- UI：Win32 API（原生控件）
- 控件：TreeView、Edit、StatusBar、Button、RadioButton
- JSON：内置轻量级解析器
- 编码：UTF-8 文件读写支持

## 免责声明

本软件仅供学习和娱乐使用，请在合理范围内使用。

---

**WorkNotes Pro v2.1.0** — Pure C++ Win32 Edition
