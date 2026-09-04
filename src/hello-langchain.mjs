import {ChatOpenAI} from "@langchain/openai"
import dotenv from "dotenv"

dotenv.config()


const model = new ChatOpenAI({
    apiKey: process.env.MODEL_KEY,
    model: process.env.MODEL,
    configuration: {
        baseURL: process.env.MODEL_BASE_URL
    }
})

const response = await model.invoke("介绍一下你自己")
console.log("🚀 ~  ~ response content: ", response.content);

