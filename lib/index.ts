import axios from 'axios';
import discord, { Message, TextChannel } from 'discord.js';
import mongoose from 'mongoose';
import NodeCache from 'node-cache';

import { BOTNAME, CMCAPIKEY, DATABASEURL, LOGOURL, POOLAPIADDRESS, TOKEN } from './config';
import { IServerConfig, ServerConfigModel } from './models/serverConfig';

const client = new discord.Client();
client.login(TOKEN);

mongoose.connect(DATABASEURL, { useNewUrlParser: true });

const cache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 60 * 6 });

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

    // Will break in december but screw the dumb api limit.. to migrate invert the comments
    // Wait till last possible moment because of rate limitting and stupid stuff

    if (content[0] === 'cmc') {
        // const options = { headers: { 'X-CMC_PRO_API_KEY': CMCAPIKEY } };

        let cryptoInfo = cache.get<any[]>('cryptoInfo');

        if (!cryptoInfo) {
            try {
                // cryptoInfo = (await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=5000', options)).data.data;
                cryptoInfo = (await axios.get(`https://api.coinmarketcap.com/v2/listings/`)).data.data;

                cache.set('cryptoInfo', cryptoInfo, 60 * 30);
            } catch (error) { return await channel.send({ embed: generateEmbeded('There was an error here is some possibly technical stuff, possibly clear as day.', error.response.data) }); }
        }

        if (!cryptoInfo) { return; }

        if (!content[1]) { content[1] = 'grlc'; }

        let coinInfo;

        for (const coin of cryptoInfo) {
            if (content[1].toUpperCase() === coin.symbol || content[1].toLowerCase() === coin.website_slug) { coinInfo = coin; break; }
            // if (content[1].toUpperCase() === coin.symbol || content[1].toLowerCase() === coin.slug) { coinInfo = coin; break; }
        }

        if (!coinInfo) { return; }

        let coinData = cache.get<{ latestInfoUSD: any, latestInfoBTC: any, logo: string }>(coinInfo.symbol);

        if (!coinData) {
            try {
                const latestInfoUSD = (await axios.get(`https://api.coinmarketcap.com/v2/ticker/${coinInfo.id}/?convert=USD`)).data.data;
                const latestInfoBTC = (await axios.get(`https://api.coinmarketcap.com/v2/ticker/${coinInfo.id}/?convert=BTC`)).data.data;
                // const latestInfoUSD = (await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${coinInfo.id}&convert=USD`, options)).data.data[coinInfo.id];
                // const latestInfoBTC = (await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${coinInfo.id}&convert=BTC`, options)).data.data[coinInfo.id];
                const logo = `https://s2.coinmarketcap.com/static/img/coins/32x32/${coinInfo.id}.png`; // This will not change in december

                coinData = { latestInfoUSD, latestInfoBTC, logo };
                cache.set(coinInfo.symbol, coinData);
            } catch (error) { return await channel.send({ embed: generateEmbeded('There was an error here is some possibly technical stuff, possibly clear as day.', error.response.data) }); }
        }

        const embed = new discord.RichEmbed();

        embed.setAuthor(`${coinInfo.name} Info`, coinData.logo, 'https://coinmarketcap.com/currencies/' + coinInfo.website_slug);
        // embed.setAuthor(`${coinInfo.name} Info`, coinData.logo, 'https://coinmarketcap.com/currencies/' + coinInfo.slug);

        embed.setColor('DARK_GOLD');

        embed.fields = [
            {
                inline: false,
                name: 'Rank',
                value: coinData.latestInfoUSD.rank.toString(),
                // value: coinData.latestInfoUSD.cmc_rank.toString(),
            },
            {
                inline: false,
                name: 'Price USD',
                value: `$${coinData.latestInfoUSD.quotes.USD.price.toFixed(10)}`,
                // value: `$${coinData.latestInfoUSD.quote.USD.price.toFixed(10)}`,
            },
            {
                inline: false,
                name: 'Price BTC',
                value: `${coinData.latestInfoBTC.quotes.BTC.price.toFixed(10)} BTC`,
                // value: `${coinData.latestInfoBTC.quote.BTC.price.toFixed(10)} BTC`,
            },
            {
                inline: false,
                name: 'Market Cap',
                value: `$${(coinData.latestInfoUSD.quotes.USD.market_cap).toFixed(2)}`,
                // value: `$${(coinData.latestInfoUSD.quote.USD.market_cap).toFixed(2)}`,
            },
            {
                inline: false,
                name: 'Circulating Supply',
                value: coinData.latestInfoUSD.circulating_supply.toString(),
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
