// เอาไปแจกต่อให้เครดิตด้วย | Deobf by 4levy ใครเปลี่ยนขอให้ไม่เจอดี

// revere engineer

const { Client, Options } = require("discord.js-selfbot-v13");
require("colors");

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
            await this.login(this.TOKEN);
            const { channelId, selfMute, selfDeaf, stream } = this.config;

            if (!channelId) {
                throw new Error("Channel ID not provided in config");
            }

            const { tag } = this.user;
            const result = { success: true };

            await this.connect(channelId, selfMute, selfDeaf, stream).then(connection => {
                const { name, id } = connection.channel;
                console.log(`[+] ${id} : ${name} => ${tag}`.green);
            }).catch(error => {
                const errorMessage = error.message.toUpperCase();
                console.log(`[+] ${channelId} : ${errorMessage} => ${tag}`.red);
            });

            return result;
        } catch (error) {
            this.destroy();
            const errorMessage = error.message.toUpperCase().replace(/\./g, '');
            const result = { success: false };
            console.log(`[-] ${this.maskToken(this.TOKEN)} : ${errorMessage}`.red);
            return result;
        }
    }
}

const wait = seconds => new Promise(resolve => setTimeout(resolve, 1000 * seconds));

(async () => {
    const modInfo = {
        name: "ONLINE VC",
        version: "1.0.3",
        update: "09:23 8/8/2024",
        limitToken: 5
    };

    const users = require("./setup/starter");
    const work = new Map();

    await wait(3);
    console.clear();
    console.log(`[+] ${modInfo.name} : ${modInfo.version} - ${modInfo.update}`.blue);
    console.log(`[+] TOKENS : ${users.length}`.blue);
    console.log(`[+] ✨ | Premium user | SUPPORT?? | nyaa!! `.blue);
    console.log(`[+] Deobf ก็ยากอยู่นะ | ใช้เวลาไป 1 ชั่วโมง 50 นาที 😭`.green);
    console.log(" ↓ ".white);

    await Promise.all(users.map(async (user) => {
        const client = new ModClient(user.tk, user.config, modInfo);
        const result = await client.start();
        if (result.success) {
            work.set(`ID:${client.user.id}`, client);
        }
    }));

    console.log(" ↑ ".white);
    console.log(`[+] DEOBF BY 4levy : ${work.size}/${users.length}`.magenta);

    if (!work.size) {
        console.log('');
        console.log("[-] CLOSING. . . ".red);
        setTimeout(() => process.exit(), 3000);
    }
})();
