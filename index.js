require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

const CONFIG = {
    ROLE_ID: '1090454328302649364',
    CHANNEL_ID: '1518140531006246982',
    VOICE_CHANNEL_ID: '1518748309400060024',
    GUILD_ID: '1009291746410254337', 
    HISTORY_FILE: 'sent_stories.json',
    CITIES: ['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Taif', 'Tabuk', 'Abha', 'Jazan', 'Najran', 'Hail', 'Arar', 'Sakaka', 'Al Bahah']
};

let prayerTimesCache = {};
const adhkarList = ["سبحان الله وبحمده", "استغفر الله العظيم", "لا إله إلا الله", "اللهم صلِ وسلم على نبينا محمد", "الحمد لله", "الله أكبر"];

async function updatePrayerTimes() {
    for (const city of CONFIG.CITIES) {
        try {
            const res = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Saudi%20Arabia&method=4`);
            prayerTimesCache[city] = res.data.data.timings;
        } catch (e) { console.error(`خطأ في تحديث ${city}:`, e); }
    }
}

async function sendNewStory() {
    try {
        const { data } = await axios.get('https://islamstory.com/ar/artical/category/25/%D9%82%D8%B5%D8%B5-%D8%A7%D9%84%D8%B5%D8%AD%D8%A7%D8%A8%D8%A9');
        const $ = cheerio.load(data);
        const stories = [];
        $('.item-title a').each((i, el) => {
            stories.push({ title: $(el).text().trim(), link: 'https://islamstory.com' + $(el).attr('href') });
        });

        let history = [];
        if (fs.existsSync(CONFIG.HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(CONFIG.HISTORY_FILE, 'utf8'));
        }
        
        const newStory = stories.find(s => !history.includes(s.title));

        if (newStory) {
            // رسالة القصة مستقلة
            sendEmbed(`📖 ${newStory.title}`, `لقراءة القصة كاملة: ${newStory.link}`, 0x2a4660);
            history.push(newStory.title);
            fs.writeFileSync(CONFIG.HISTORY_FILE, JSON.stringify(history));
        }
    } catch (e) { console.error("خطأ في جلب القصة:", e); }
}

function sendDhikr() {
    // رسالة الذكر مستقلة
    sendEmbed("✨ ذكر", adhkarList[Math.floor(Math.random() * adhkarList.length)], 0x2a4660);
}

client.once('ready', async () => {
    await updatePrayerTimes();
    console.log("البوت متصل ويعمل!");

    // إرسال فوري ومستقل
    sendDhikr();
    sendNewStory();

    client.user.setActivity('قصص دينية وعبر', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/monstercat' });

    const voiceChannel = client.channels.cache.get(CONFIG.VOICE_CHANNEL_ID);
    if (voiceChannel) {
        joinVoiceChannel({ channelId: voiceChannel.id, guildId: CONFIG.GUILD_ID, adapterCreator: voiceChannel.guild.voiceAdapterCreator });
        voiceChannel.permissionOverwrites.edit(voiceChannel.guild.id, { Connect: false });
    }

    // ذكر كل ساعة
    cron.schedule('0 * * * *', sendDhikr);

    // قصة كل نصف ساعة
    cron.schedule('*/30 * * * *', sendNewStory);

    cron.schedule('0 1 * * *', updatePrayerTimes);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith('!اذكار')) {
        if (!message.member.roles.cache.has(CONFIG.ROLE_ID)) return message.reply("عذراً، ليس لديك الرتبة المطلوبة.");
        const text = message.content.replace('!اذكار', '').trim();
        if (text) { sendEmbed('✨ ذكر من العضو', text, 0x2a4660); }
    }
});

function sendEmbed(title, description, color) {
    client.channels.cache.get(CONFIG.CHANNEL_ID)?.send({
        content: `<@&${CONFIG.ROLE_ID}>`,
        embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(color)]
    });
}

cron.schedule('* * * * *', () => {
    const timeString = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    for (const city in prayerTimesCache) {
        const timings = prayerTimesCache[city];
        for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
            if (timings[prayer] === timeString) {
                client.channels.cache.get(CONFIG.CHANNEL_ID).send({ 
                    content: `<@&${CONFIG.ROLE_ID}>`,
                    embeds: [new EmbedBuilder().setTitle(`🕋 وقت أذان ${prayer} في ${city}`).setDescription("دعاء بين الأذان والإقامة لا يُرد.").setColor(0x2a4660)] 
                });
            }
        }
    }
});

client.login(process.env.TOKEN);
