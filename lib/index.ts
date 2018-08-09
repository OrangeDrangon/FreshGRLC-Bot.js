import axios from 'axios';
import discord, { Message, TextChannel } from 'discord.js';
import mongoose from 'mongoose';

import { BOTNAME, CMCAPIKEY, DATABASEURL, LOGOURL, POOLAPIADDRESS, TOKEN } from './config';
import { IServerConfig, ServerConfigModel } from './models/serverConfig';

let cryptoInfo: any[] | undefined;

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

        await channel.send({ embed: generateEmbeded(undefined, { Prefix: serverConfig.prefix }) });
        await serverConfig.save();
        return;
    }

    if (content[0] === 'info') {
        const difficulty = (await axios.get('https://garlicinsight.com/insight-grlc-api/status?q=getDifficulty')).data.difficulty as number;
        const poolInfo = (await axios.get(POOLAPIADDRESS + '/poolstats/noheights')).data;
        const luck = (await axios.get(POOLAPIADDRESS + '/luck')).data.map((x: any) => x.luck);

        const fields = {
            'Block Height': (await axios.get('https://garlicinsight.com/insight-grlc-api/blocks?limit=1')).data.blocks[0].height,
            'Difficulty': difficulty.toFixed(2),
            'Network Hashrate': ((difficulty * 2 ** 32) / 40 / 1000000000).toFixed(2) + ' GH/s',
            'Pool Hashrate': ((poolInfo.averageHashrate as number) / 1000000000).toFixed(2) + ' GH/s',
            'Pool Luck': (average(luck) * 100).toFixed(2) + '%',
            'Pool Workers': poolInfo.workers,
        };

        await channel.send({ embed: generateEmbeded(undefined, fields) });
        return;
    }

    if (content[0] === 'cmc') {
        const options = { headers: { 'X-CMC_PRO_API_KEY': CMCAPIKEY } };

        if (!cryptoInfo) {
            cryptoInfo = (await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=5000', options)).data.data;
        }

        if (!cryptoInfo) { return; }

        if (!content[1]) { content[1] = 'grlc'; }

        let coinInfo;

        for (const coin of cryptoInfo) {
            if (content[1].toUpperCase() === coin.symbol || content[1].toLowerCase() === coin.slug) { coinInfo = coin; }
        }

        if (!coinInfo) { return; }

        const metadata = (await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/info?symbol=${coinInfo.symbol}`, options)).data.data;

        const embed = new discord.RichEmbed();

        embed.setAuthor(`${coinInfo.name} Info`, metadata[coinInfo.symbol].logo, 'https://coinmarketcap.com/currencies/' + coinInfo.slug);

        embed.setColor('DARK_GOLD');

        const latestInfoUSD = (await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${coinInfo.id}&convert=USD`, options)).data.data[coinInfo.id];
        const latestInfoBTC = (await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${coinInfo.id}&convert=BTC`, options)).data.data[coinInfo.id];

        embed.fields = [
            {
                inline: false,
                name: 'Rank',
                value: latestInfoUSD.cmc_rank.toString(),
            },
            {
                inline: false,
                name: 'Price USD',
                value: `$${latestInfoUSD.quote.USD.price}`,
            },
            {
                inline: false,
                name: 'Price BTC',
                value: `${latestInfoBTC.quote.BTC.price.toFixed(14)} BTC`,
            },
            {
                inline: false,
                name: 'Market Cap',
                value: `$${(latestInfoUSD.quote.USD.market_cap / 100).toFixed(2)}`,
            },
            {
                inline: false,
                name: 'Circulating Supply',
                value: latestInfoUSD.circulating_supply.toString(),
            },
        ];

        await channel.send({ embed });
        return;

    }
});

const average = (values: number[]) => {
    let sum = 0;
    for (const value of values) {
        sum += value;
    }
    return sum / values.length;
};

const formatApprovedChannels = (approvedChannels: string[]) => {
    const approvedFormatted: string[] = new Array(approvedChannels.length);
    for (let i = 0; i < approvedChannels.length; i++) {
        approvedFormatted[i] = `#${(client.channels.find('id', approvedChannels[i]) as TextChannel).name}`;
    }
    return approvedFormatted.sort();
};

const generateEmbeded = (description?: string, fields?: IFieldsParameter) => {
    const embed = new discord.RichEmbed();

    embed.setAuthor(BOTNAME, LOGOURL);

    embed.setColor('DARK_GOLD');

    if (description) { embed.setDescription(description); }

    if (fields) {
        const formattedFields: IFields[] = [];
        for (const key in fields) {
            if (fields.hasOwnProperty(key)) {
                formattedFields.push({ inline: true, name: key, value: fields[key] });
            }
        }
        embed.fields = formattedFields;
    }

    return embed;
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
