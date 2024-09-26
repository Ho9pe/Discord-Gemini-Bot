const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// using the gemini-pro model
async function runGeminiPro(prompt, history = []) {
    // const model = genAI.getGenerativeModel({ model: "gemini-pro"});
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const chat = model.startChat({
        history,
        generationConfig: {
            maxOutputTokens: Infinity,
        },
    });
    
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();
    console.log(text);
    return text;
}

// using the gemini-1.5-flash model
function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
        data: Buffer.from(fs.readFileSync(path)).toString("base64"),
        mimeType
        },
    };
}
async function runGeminiFlash(prompt, path, mimeType) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const attachmentParts = [fileToGenerativePart(path, mimeType)];
    
    const result = await model.generateContent([prompt, ...attachmentParts]);
    const response = await result.response;
    const text = response.text();
    console.log(text);
    return text;
}



module.exports = { runGeminiPro, runGeminiFlash };

