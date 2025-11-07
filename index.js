const { Client, Options } = require("discord.js-selfbot-v13");
require("colors");
const { secretbox } = require('tweetnacl');
const fs = require('fs');
const yaml = require('js-yaml');

class ModClient extends Client {
    constructor(token, config, info) {
        super({
            partials: [],
            makeCache: Options.cacheWithLimits({ MessageManager: 0 })
        });
        this.TOKEN = token;
        this.config = config;
        this.info = info;
        this.intervals = new Set();
    }

    maskToken(token) {
        const parts = token.split('.');
        if (parts.length < 2) return token;
        const maskedPart = '#'.repeat(10);
        return `${parts[0]}.${maskedPart}`;
    }

    startInterval(callback, interval) {
        const intervalId = setInterval(callback, interval);
        this.intervals.add(intervalId);
        return intervalId;
    }

    stopAllIntervals() {
        this.intervals.forEach(clearInterval);
        this.intervals.clear();
    }

    _encrypt(buffer, secret_key) {
        const encryptedMessage = secretbox(buffer, this._nonceBuffer, secret_key);
        return [encryptedMessage, this._nonceBuffer.slice(0, 4)];
    }

    async connect(channelId, selfMute = true, selfDeaf = true, createStream = false) {
        try {
            const connectionOptions = { selfMute, selfDeaf, selfVideo: false };
            const channel = this.channels.cache.get(channelId);
            if (!channel) throw new Error("Channel not found");

            let connection = await this.voice.joinChannel(channel, connectionOptions);

            if (createStream && connection && typeof connection.createStreamConnection === 'function') {
                await connection.createStreamConnection().catch(() => {});
            }

            this.startInterval(async () => {
                connection = await this.voice.joinChannel(channel, connectionOptions);
                if (createStream && connection && typeof connection.createStreamConnection === 'function') {
                    await connection.createStreamConnection().catch(() => {});
                }
            }, 30000);

            return connection;
        } catch (error) {
            console.error(`Failed to connect to channel ${channelId}: ${error.message}`);
            throw error;
        }
    }

    async start() {
        try {
            console.log(`[*] Attempting to login with token: ${this.maskToken(this.TOKEN)}`.yellow);
            await this.login(this.TOKEN);
            const { channelId, selfMute, selfDeaf, stream } = this.config;

            if (!channelId) {
                throw new Error("Channel ID not provided in config");
            }

            const { tag } = this.user;
            const result = { success: true, tag };

            await this.connect(channelId, selfMute, selfDeaf, stream).then(connection => {
                const { name, id } = connection.channel;
                console.log(`[+] Connected ${tag} to ${name} (${id})`.green);
            }).catch(error => {
                console.log(`[!] Failed to connect ${tag} to channel: ${error.message}`.yellow);
            });

            return result;
        } catch (error) {
            this.destroy();
            const errorMessage = error.message.toUpperCase().replace(/\./g, '');
            const result = { success: false, error: errorMessage };
            console.log(`[-] Failed login: ${this.maskToken(this.TOKEN)} : ${errorMessage}`.red);
            return result;
        }
    }
}

const wait = seconds => new Promise(resolve => setTimeout(resolve, 1000 * seconds));

function loadConfig() {
    try {
        if (fs.existsSync('./config.yml')) {
            const fileContents = fs.readFileSync('./config.yml', 'utf8');
            const config = yaml.load(fileContents);
            
            if (config && config.INPUTS) {
                console.log('Loaded'.blue);
                return config.INPUTS.map(input => ({
                    tk: input.token,
                    config: {
                        channelId: input.channelId,
                        selfMute: input.selfMute !== undefined ? input.selfMute : true,
                        selfDeaf: input.selfDeaf !== undefined ? input.selfDeaf : true,
                        stream: input.stream !== undefined ? input.stream : false
                    }
                }));
            }
        }
        
        if (fs.existsSync('./setup/starter.js') || fs.existsSync('./setup/starter.json')) {
            console.log('[+] Loading configuration from setup/starter'.blue);
            return require("./setup/starter");
        }
        
        throw new Error('No configuration file found');
    } catch (error) {
        console.log(`[-] Error loading configuration: ${error.message}`.red);
        return [];
    }
}

(async () => {
    const modInfo = {
        name: "ONLINE VC",
        version: "1.0.3",
        update: "09:23 8/8/2024",
        limitToken: 5
    };

    const users = loadConfig();
    
    if (users.length === 0) {
        console.log("[-] No valid configuration found. Please check your config.yml or setup/starter files.".red);
        process.exit(1);
    }

    const connectedClients = new Map();

    await wait(3);
    console.clear();
    console.log(`[+] ${modInfo.name} : ${modInfo.version} - ${modInfo.update}`.blue);
    console.log(`[+] Loading ${users.length} tokens...`.blue);
    
    const loginResults = await Promise.allSettled(users.map(async (user) => {
        const client = new ModClient(user.tk, user.config, modInfo);
        return client.start().then(result => ({client, result}));
    }));

    loginResults.forEach(({status, value}) => {
        if (status === 'fulfilled' && value.result.success) {
            connectedClients.set(`ID:${value.client.user.id}`, value.client);
        }
    });

    console.log(`[+] Successfully connected: ${connectedClients.size}/${users.length}`.magenta);

    if (!connectedClients.size) {
        console.log('');
        console.log("[-] No successful connections, closing...".red);
        setTimeout(() => process.exit(), 3000);
    }
})();