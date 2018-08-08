import discord, { Message } from 'discord.js';
import mongoose from 'mongoose';

import { DATABASEURL, TOKEN } from './config';
import { IServerConfig, ServerConfigModel } from './models/serverConfig';

const client = new discord.Client();
client.login(TOKEN);

mongoose.connect(DATABASEURL, { useNewUrlParser: true });

client.on('message', async (message) => {
    if (message.author.id === client.user.id) { return; }
    const serverConfig = await getServerConfig(message);
    const channel = message.channel;
    const content = message.content.split(' ');
    if (message.content.slice(0, serverConfig.prefix.length) !== serverConfig.prefix) { return; }
    // TODO Add approved channels enforcement
    content[0] = content[0].replace(serverConfig.prefix, '');
    if (content[0] === 'config') {
        if (content[1] === 'set') {
            await channel.send('ok!');
        } else {
            const embed = new discord.RichEmbed();
            embed.setAuthor(
                'FreshGRLC Info Bot',
                'https://upload.wikimedia.org/wikipedia/commons/5/56/Neptune_Full.jpg',
            );
            embed.setColor('DARK_GOLD');
            embed.fields = [
                {
                    inline: false,
                    name: 'Prefix',
                    value: serverConfig.prefix,
                },
                {
                    inline: false,
                    name: 'Approved Channels',
                    value: ['470317836615811083'].join(', '), // Will change to serverConfig.approvedChannels.join(', ')
                },
            ];
            embed.setFooter('Second arguement should be "set" to set config');
            await channel.send({ embed });
        }
    }
});

const getServerConfig = async (message: Message) => {
    let serverConfig = await ServerConfigModel.findOne({ id: message.guild.id }) || undefined;
    if (serverConfig) { return serverConfig; } else {
        serverConfig = { id: message.guild.id, prefix: '!' } as IServerConfig;
        return await new ServerConfigModel(serverConfig).save();
    }
};
