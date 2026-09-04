import 'dotenv/config';
import {MultiServerMCPClient} from '@langchain/mcp-adapters';
import {ChatOpenAI} from '@langchain/openai';
import chalk from 'chalk';
import {HumanMessage, ToolMessage} from '@langchain/core/messages';

// 创建模型
const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.MODEL_KEY,
    configuration: {
        baseURL: process.env.MODEL_BASE_URL,
    },
});

// 创建mcp客户端
const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        // 以前的自定义的mcp服务
        'my-mcp-server': {
            command: "node",
            args: [
                "/Users/onecnjack/Agent_Study/shenguang/src/my-mcp-server.js"
            ]
        },
        // 高德地图的mcp服务
        "amap-maps-streamableHTTP": {
            "url": "https://mcp.amap.com/mcp?key=" + process.env.AMAP_MCP_KEY
        },
        // MCP 文件服务
        "filesystem": {
            "command": "pnpm",
            "args": [
                "dlx",
                "@modelcontextprotocol/server-filesystem",
                ...(process.env.ALLOWED_PATHS?.split(",") || [])
            ]
        },
        // 谷歌浏览器的mcp服务
        "chrome-devtools": {
            "command": "pnpm",
            "args": [
                "dlx",
                "chrome-devtools-mcp@latest"
            ]
        }
    }
});

// 获取mcp工具
const tools = await mcpClient.getTools();
// 绑定工具到模型
const modelWithTools = model.bindTools(tools);

// 执行函数
async function runAgentWithTools(query, maxIterations = 30) {
    const messages = [
        new HumanMessage(query)
    ];

    // 重试轮次
    for (let i = 0; i < maxIterations; i++) {
        console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
        const response = await modelWithTools.invoke(messages);
        messages.push(response);

        // 检查是否有工具调用
        if (!response.tool_calls || response.tool_calls.length === 0) {
            console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
            return response.content;
        }

        console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`));
        console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map(t => t.name).join(', ')}`));
        // 执行工具调用
        for (const toolCall of response.tool_calls) {
            const foundTool = tools.find(t => t.name === toolCall.name);
            if (foundTool) {
                const toolResult = await foundTool.invoke(toolCall.args);

                // 确保 content 是字符串类型
                let contentStr;
                if (typeof toolResult === 'string') {
                    contentStr = toolResult;
                } else if (toolResult && toolResult.text) {
                    // 如果返回对象有 text 字段，优先使用
                    contentStr = toolResult.text;
                }

                messages.push(new ToolMessage({
                    content: contentStr,
                    tool_call_id: toolCall.id,
                }));
            }
        }
    }

    return messages[messages.length - 1].content;
}

// await runAgentWithTools("北京南站附近的1个酒店，以及去的路线");
// await runAgentWithTools("北京南站附近的5个酒店，以及去的路线，路线规划生成文档保存到 /Users/onecnjack/Desktop 的一个 md 文件");
await runAgentWithTools("北京南站附近的酒店，最近的 3 个酒店，拿到酒店图片，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示，并且在把那个页面标题改为酒店名");

await mcpClient.close();
