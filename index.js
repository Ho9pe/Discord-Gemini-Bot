require ('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const path = require('path');
const fs = require('fs');
const https = require('https');

const { runGeminiPro, runGeminiFlash } = require('./gemini.js');



const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

const authorizedUsers = [''];
const authorizedChannels = ['1288752023147253780'];

// Store conversation history
const userHistories = new Map();

client.on('messageCreate', async message => {
    try {
        // Ignore messages from bots
        if (message.author.bot) return;

        const userId = message.author.id;
        const userMsg = message.content;

        if (!userHistories.has(userId)) {
            userHistories.set(userId, []);
        }

        const conversationHistory = userHistories.get(userId);
        conversationHistory.push({ role: "user", parts: [{ text: userMsg }] });

        // DMs
        if (message.channel.type === ChannelType.DM) {
            console.log(`DM received from ${message.author.tag}: ${message.content}`);
            
            const prompt = userMsg;
            let localPath = null;
            let mimeType = null;

            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                let url = attachment.url;
                mimeType = attachment.contentType;
                let fileName = attachment.name;
                localPath = path.join(__dirname, 'attachments', fileName);
                let file = fs.createWriteStream(localPath);
                https.get(url, function(response) {
                    response.pipe(file);
                    file.on('finish', async function() {
                        file.close(async () => {
                            try {
                                const response = await runGeminiFlash(prompt, localPath, mimeType);
                                conversationHistory.push({ role: "model", parts: [{ text: response }] });
                                const results = splitResponse(response);
                                results.forEach((result) => {
                                    message.reply(result);
                                });
                            } catch (error) {
                                console.error(error);
                                message.reply('Error Processing Attachment');
                            }
                        });
                    });
                });
            } else {
                const response = await runGeminiPro(userMsg, conversationHistory);
                conversationHistory.push({ role: "model", parts: [{ text: response }] });
                const results = splitResponse(response);
                results.forEach((result) => {
                    message.reply(result);
                });
            }
        }

        // Ensure the attachments directory exists
        const attachmentDir = path.join(__dirname, 'attachments');
        if (!fs.existsSync(attachmentDir)) {
            fs.mkdirSync(attachmentDir);
        }

        // Server text channels
        if (message.channel.type === ChannelType.GuildText && authorizedChannels.includes(message.channel.id)) {
            const prefix = '!g ';
            if (!message.content.startsWith(prefix)) return;
            const userTag = message.author.tag;
            const userMsg = message.content.slice(prefix.length);
            console.log(`Message from ${userTag}: ${userMsg}`);

            const prompt = userMsg;
            let localPath = null;
            let mimeType = null;

            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                let url = attachment.url;
                mimeType = attachment.contentType;
                let fileName = attachment.name;
                localPath = path.join(__dirname, 'attachments', fileName);
                let file = fs.createWriteStream(localPath);
                https.get(url, function(response) {
                    response.pipe(file);
                    file.on('finish', async function() {
                        file.close(async () => {
                            try {
                                const response = await runGeminiFlash(prompt, localPath, mimeType);
                                conversationHistory.push({ role: "model", parts: [{ text: response }] });
                                const results = splitResponse(response);
                                results.forEach((result) => {
                                    message.reply(result);
                                });
                            } catch (error) {
                                console.error(error);
                                message.reply('Error Processing Attachment');
                            }
                        });
                    });
                });
            } else {
                const response = await runGeminiPro(userMsg, conversationHistory);
                conversationHistory.push({ role: "model", parts: [{ text: response }] });
                const results = splitResponse(response);
                results.forEach((result) => {
                    message.reply(result);
                });
            }
        }
    } 
    catch (error) {
        console.error(error);
        message.reply('There was an error processing your request.');
    }
});

function splitResponse(response) {
    const maxLength = 2000;
    let chunks = [];

    for(let i = 0; i < response.length; i += maxLength) {
        chunks.push(response.substring(i, i + maxLength));
    }
    return chunks;
}

