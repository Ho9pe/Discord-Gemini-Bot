require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const path = require('path');
const fs = require('fs');
const https = require('https');

const { runGeminiDefault, runGeminiAttachment } = require('./gemini.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
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

const authorizedChannels = ['1288752023147253780'];

// Store conversation history
const userHistories = new Map();

// Ensure the attachments directory exists
const attachmentDir = path.join(__dirname, 'attachments');
if (!fs.existsSync(attachmentDir)) {
    fs.mkdirSync(attachmentDir);
}

// Discord message handlers
client.on('messageCreate', async message => {
    try {
        if (message.author.bot) return; // Ignore bot messages

        const userId = message.author.id;

        // DM Handling
        if (message.channel.type === ChannelType.DM) {
            console.log('Received DM from:', message.author.username);
            await processMessage(message, userId, true);
        }

        // Server Text Channel Handling
        else if (message.channel.type === ChannelType.GuildText && authorizedChannels.includes(message.channel.id)) {
            if (message.content.startsWith('!g ')) {
                console.log('Received message in authorized channel from: ', userId);
                await processMessage(message, userId, false);
            }
        }
    } catch (error) {
        console.error(error);
        message.reply('There was an error processing your request.');
    }

    // Debugging output
    console.log('User Histories:', JSON.stringify(formatConversationHistory(userHistories), null, 2));
    // Show the conversation history when pressed Ctrl+C
    // process.on('SIGINT', function () {
    //     console.log('Conversation History:', JSON.stringify(formatConversationHistory(userHistories), null, 2));
    // });
});

async function processMessage(message, userId, isDM = false) {
    const userMsg = isDM ? message.content : message.content.slice('!g '.length);

    if (!userHistories.has(userId)) {
        userHistories.set(userId, []);
    }

    const conversationHistory = userHistories.get(userId);

    let localPath = null;
    let mimeType = null;
    let response = null; // Store the model's response

    // Check for attachments
    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        let url = attachment.url;
        mimeType = attachment.contentType;
        let fileName = attachment.name;
        localPath = path.join(__dirname, 'attachments', fileName);
        let file = fs.createWriteStream(localPath);

        // Download the attachment
        https.get(url, function (response) {
            response.pipe(file);
            file.on('finish', async function () {
                file.close(async () => {
                    try {
                        // Process the attachment after downloading
                        response = await runGeminiAttachment(userMsg, localPath, mimeType);
                        handleReply(message, conversationHistory, userMsg, response);
                    } catch (error) {
                        console.error(error);
                        message.reply('Error Processing Attachment');
                    }
                });
            });
        });
    } else {
        // Process text-based message
        response = await runGeminiDefault(userMsg, conversationHistory);
        handleReply(message, conversationHistory, userMsg, response);
    }
}

// Unified function for handling reply and updating history once
function handleReply(message, conversationHistory, userMsg, response) {
    // Avoid pushing duplicate entries
    if (!conversationHistory.some(entry => entry.parts[0].text === userMsg)) {
        // Add user message to history
        conversationHistory.push({ role: "user", parts: [{ text: userMsg }] });
    }

    if (!conversationHistory.some(entry => entry.parts[0].text === response)) {
        // Add model's response to history
        conversationHistory.push({ role: "model", parts: [{ text: response }] });
    }

    // Send the response as a reply
    const results = splitResponse(response);
    results.forEach((result) => {
        message.reply(result);
    });
}


function splitResponse(response) {
    const maxLength = 2000;
    let chunks = [];

    for (let i = 0; i < response.length; i += maxLength) {
        chunks.push(response.substring(i, i + maxLength));
    }
    return chunks;
}

function formatConversationHistory(userHistories) {
    const formattedHistory = [];
    userHistories.forEach((history, userId) => {
        const formattedUserHistory = history.map(entry => {
            return {
                role: entry.role,
                text: entry.parts.map(part => part.text).join(' ')
            };
        });
        formattedHistory.push([userId, formattedUserHistory]);
    });
    return formattedHistory;
}
