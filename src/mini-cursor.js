import 'dotenv/config';
import {ChatOpenAI} from '@langchain/openai';
import {HumanMessage, SystemMessage, ToolMessage} from '@langchain/core/messages';
import {executeCommandTool, listDirectoryTool, readFileTool, writeFileTool} from './all-tools.js';
import chalk from 'chalk';

//创建模型
const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.MODEL_KEY,
    temperature: 0,
    configuration: {
        baseURL: process.env.MODEL_BASE_URL,
    },
});

// 导入工具
const tools = [
    readFileTool,
    writeFileTool,
    executeCommandTool,
    listDirectoryTool,
];

// 绑定工具到模型
const modelWithTools = model.bindTools(tools);

// Agent 执行函数
async function runAgentWithTools(query, maxIterations = 30) {
    const messages = [
        // 系统消息
        new SystemMessage(`你是一个项目管理助手，使用工具完成任务。

当前工作目录: ${process.cwd()}

工具：
1. read_file: 读取文件
2. write_file: 写入文件
3. execute_command: 执行命令（支持 workingDirectory 参数）
4. list_directory: 列出目录

重要规则 - execute_command：
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 启动开发服务器这类不会自动结束的命令时，必须设置 longRunning: true
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
这是错误的！因为 workingDirectory 已经在 react-todo-app 目录了，再 cd react-todo-app 会找不到目录
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }
这样就对了！workingDirectory 已经切换到 react-todo-app，直接执行命令即可
- 启动服务正确示例: { command: "pnpm run dev -- --host 0.0.0.0", workingDirectory: "react-todo-app", longRunning: true }

重要规则 - write_file：
- 当写入 React 组件文件（如 App.tsx）时，如果存在对应的 CSS 文件（如 App.css），在其他 import 语句后加上这个 css 的导入

任务完成标准：
- 如果任务要求创建具体应用，创建模板项目只是第一步，不是完成
- 必须继续读取/写入业务文件，把默认模板页面改成用户要求的应用
- 写完后读取关键文件确认内容已经变更
`),
        new HumanMessage(query) //用户消息
    ];

    for (let i = 0; i < maxIterations; i++) {
        console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
        const response = await modelWithTools.invoke(messages); //模型传入信息
        messages.push(response);

        // 检查是否有工具调用
        if (!response.tool_calls || response.tool_calls.length === 0) {
            console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
            return response.content;
        }

        // 执行工具调用
        for (const toolCall of response.tool_calls) {
            console.log(chalk.cyan(`\n[工具请求] ${toolCall.name}(${JSON.stringify(toolCall.args)})`));
            const foundTool = tools.find(t => t.name === toolCall.name);
            if (foundTool) {
                const toolResult = await foundTool.invoke(toolCall.args);
                messages.push(new ToolMessage({
                    content: toolResult,
                    tool_call_id: toolCall.id,
                }));
            } else {
                console.log(chalk.red(`[工具错误] 找不到工具: ${toolCall.name}`));
                messages.push(new ToolMessage({
                    content: `错误: 找不到工具 ${toolCall.name}`,
                    tool_call_id: toolCall.id,
                }));
            }
        }
    }

    return messages[messages.length - 1].content;
}

// echo 在 windows 可能不支持，可以去掉 echo 试试，不一定需要用户选择，或者换成 windows 的命令写法
const case1 = `创建一个功能丰富的 React TodoList 应用：

1. 创建项目：pnpm create vite@latest react-todo-app --template react-ts --overwrite --no-interactive --no-immediate
2. 修改 src/App.tsx，实现完整功能的 TodoList：
 - 添加、删除、编辑、标记完成
 - 分类筛选（全部/进行中/已完成）
 - 统计信息显示
 - localStorage 数据持久化
3. 添加复杂样式：
 - 渐变背景（蓝到紫）
 - 卡片阴影、圆角
 - 悬停效果
4. 添加动画：
 - 添加/删除时的过渡动画
 - 使用 CSS transitions
5. 列出目录确认

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果
注意：不要停留在 Vite 默认页面，必须使用 write_file 覆盖 react-todo-app/src/App.tsx 和 react-todo-app/src/App.css

之后在 react-todo-app 项目中：
1. 使用 pnpm install 安装依赖
2. 使用 pnpm run build 验证项目
3. 使用 execute_command 启动开发服务器，参数必须是 command: "pnpm run dev -- --host 0.0.0.0", workingDirectory: "react-todo-app", longRunning: true
`;

try {
    await runAgentWithTools(case1);
} catch (error) {
    console.error(`\n❌ 错误: ${error.message}\n`);
}
