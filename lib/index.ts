import discord from 'discord.js';

import { TOKEN } from './config';

const client = new discord.Client();
client.login(TOKEN);

client.on('message', async (message) => {
    if (message.author.id === client.user.id) { return; }
    await message.channel.send(message.content);
});
