async function runGeminiPro(prompt, history = []) {
    // const model = genAI.getGenerativeModel({ model: "gemini-pro"});
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const chat = model.startChat({
        history,
        generationConfig: {
            maxOutputTokens: 100,
        },
    });
    
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();
    console.log(text);
    return text;
}