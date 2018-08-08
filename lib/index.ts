import discord, { Message, TextChannel } from 'discord.js';
import mongoose from 'mongoose';

import { BOTNAME, DATABASEURL, LOGOURL, TOKEN } from './config';
import { IServerConfig, ServerConfigModel } from './models/serverConfig';

const client = new discord.Client();
client.login(TOKEN);

mongoose.connect(DATABASEURL, { useNewUrlParser: true });

client.on('message', async (message) => {
    if (message.author.id === client.user.id) { return; }

    const serverConfig = await getServerConfig(message);
    const channel = message.channel;
    const content = message.content.split(' ');
    content[0] = content[0].replace(serverConfig.prefix, '');

    if (message.member.hasPermission('ADMINISTRATOR') && content[0] === 'allow') {
        if (serverConfig.approvedChannels.indexOf(channel.id) > -1) { return; }

        serverConfig.approvedChannels.push(channel.id);

        await channel.send({ embed: generateEmbeded(undefined, { 'New Approved Channels': `[${formatApprovedChannels(serverConfig.approvedChannels).join(', ')}]` }) });
        await serverConfig.save();
        return;
    }

    if (serverConfig.approvedChannels.length !== 0
        && !(serverConfig.approvedChannels.indexOf(channel.id) > -1)) { return; }

    if (message.content.slice(0, serverConfig.prefix.length) !== serverConfig.prefix) { return; }

    if (content[0] === 'config') {
        const description = `Run "!allow" and "!remove" to permit channels for the bot.
        Run "!prefix {prefix} to set the prefix.`;

        const fields = { 'Approved Channels': `[${formatApprovedChannels(serverConfig.approvedChannels).join(', ')}]`, 'Prefix': serverConfig.prefix };

        await channel.send({ embed: generateEmbeded(description, fields) });
        return;
    }

    if (content[0] === 'remove') {
        const index = serverConfig.approvedChannels.indexOf(channel.id);

        if (!(index > -1)) { return; }

        serverConfig.approvedChannels.splice(index, 1);

        await channel.send({ embed: generateEmbeded(undefined, { 'New Approved Channels': `[${formatApprovedChannels(serverConfig.approvedChannels).join(', ')}]` }) });
        await serverConfig.save();
        return;
    }

    if (content[0] === 'prefix' && content[1]) {
        serverConfig.prefix = content[1];

        await serverConfig.save();
        return;
    }
});

const formatApprovedChannels = (approvedChannels: string[]) => {
    const approvedFormatted: string[] = new Array(approvedChannels.length);
    for (let i = 0; i < approvedChannels.length; i++) {
        approvedFormatted[i] = `#${(client.channels.find('id', approvedChannels[i]) as TextChannel).name}`;
    }
    return approvedFormatted.sort();
};

const getServerConfig = async (message: Message) => {
    let serverConfig = await ServerConfigModel.findOne({ id: message.guild.id }) || undefined;
    if (serverConfig) { return serverConfig; } else {
        serverConfig = { approvedChannels: [] as string[], id: message.guild.id, prefix: '!' } as IServerConfig;
        return await new ServerConfigModel(serverConfig).save();
    }
};

interface IFields {
    name: string;
    value: string;
    inline: boolean;
}

interface IFieldsParameter {
    [key: string]: string;
}

const generateEmbeded = (description?: string, fields?: IFieldsParameter) => {
    const embed = new discord.RichEmbed();

    embed.setAuthor(BOTNAME, LOGOURL);

    embed.setColor('DARK_GOLD');

    if (description) { embed.setDescription(description); }

    if (fields) {
        const formattedFields: IFields[] = [];
        for (const key in fields) {
            if (fields.hasOwnProperty(key)) {
                formattedFields.push({ inline: false, name: key, value: fields[key] });
            }
        }
        embed.fields = formattedFields;
    }

    return embed;
};
