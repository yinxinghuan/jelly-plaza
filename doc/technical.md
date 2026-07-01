# Technical

## 1. 技术栈

- 游戏：Jelly Plaza
- 类型：casual
- 简述：Jelly Plaza 是一个移动端即开即玩的互动小游戏。
- 框架 / 语言 / 构建：React, TypeScript, Vite, Less
- 渲染方式：Canvas/WebGL
- 依赖摘录：@eslint/js@^9.39.4, @types/node@^24.12.2, @types/react@^19.2.14, @types/react-dom@^19.2.3, @vitejs/plugin-react@^6.0.1, eslint@^9.39.4, eslint-plugin-react-hooks@^7.0.1, eslint-plugin-react-refresh@^0.5.2, globals@^17.4.0, less@^4.6.4, react@^19.2.4, react-dom@^19.2.4, typescript@~6.0.2, typescript-eslint@^8.58.0, vite@^8.0.4
- 平台元信息：meta.title=Jelly Plaza；cover_url=/poster.png；category=casual

## 2. 目录结构

- `index.html`：Vite/浏览器入口，挂载根节点和基础 meta。
- `package.json`：定义 npm 脚本、依赖和工程名称。
- `vite.config.ts`：配置构建、插件和相对路径 base。
- `meta.json`：平台发布元信息，包含标题和封面。
- `src/main.tsx`：React 组件和交互界面。
- `src/JellyPlaza/JellyPlaza.less`：视觉样式、布局、动画和响应式规则。
- `src/JellyPlaza/JellyPlaza.tsx`：React 组件和交互界面。
- `src/JellyPlaza/characters.ts`：游戏源码模块。
- `src/JellyPlaza/types.ts`：游戏源码模块。
- `src/JellyPlaza/index.ts`：游戏源码模块。
- `src/JellyPlaza/components/AnimatedCharacter.less`：视觉样式、布局、动画和响应式规则。
- `src/JellyPlaza/components/AnimatedCharacter.tsx`：React 组件和交互界面。

关键源码模块：

- `src/main.tsx`
- `src/JellyPlaza/JellyPlaza.less`
- `src/JellyPlaza/JellyPlaza.tsx`
- `src/JellyPlaza/characters.ts`
- `src/JellyPlaza/types.ts`
- `src/JellyPlaza/index.ts`
- `src/JellyPlaza/components/AnimatedCharacter.less`
- `src/JellyPlaza/components/AnimatedCharacter.tsx`

## 3. 核心模块

- 状态管理与节奏：通过 React 状态与定时器处理倒计时、阶段推进或生成节奏。
- 渲染方式：Canvas/WebGL，样式由 CSS/Less 和组件结构共同完成。
- 碰撞 / 更新：源码包含命中、距离、边界或重叠判断，结果会影响得分、生命或阶段。
- 音频：未发现独立音频模块，当前以视觉和文案反馈为主。

## 4. 扩展点

- 改玩法参数：优先查找 `src/` 内大写常量、hooks、主组件顶部配置或关卡数组。
- 换素材：替换 `public/`、`src/img/` 或源码 import 的图片/音频文件，并保持相对路径。
- 调视觉：修改主样式文件中的颜色、间距、动画时长、网格尺寸和响应式规则。
- 改文案：修改 i18n 字典、组件内标题按钮文案，保持 zh/en 同步。
- 加平台能力：在已有 `@shared/runtime`、useGameSave、排行榜、墙或通知调用附近扩展，避免另起一套存储。
