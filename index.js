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

async function updatePrayerTimes() {
    for (const city of CONFIG.CITIES) {
        try {
            const res = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Saudi%20Arabia&method=4`);
            prayerTimesCache[city] = res.data.data.timings;
        } catch (e) { console.error(`خطأ في تحديث ${city}:`, e); }
    }
}

client.once('ready', async () => {
    await updatePrayerTimes();
    console.log("البوت متصل ويعمل!");

    // 1. الستريمنق
    client.user.setActivity('قصص دينية وعبر', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/monstercat' });

    // 2. دخول الروم الصوتي وقفله
    const voiceChannel = client.channels.cache.get(CONFIG.VOICE_CHANNEL_ID);
    if (voiceChannel) {
        joinVoiceChannel({ channelId: voiceChannel.id, guildId: CONFIG.GUILD_ID, adapterCreator: voiceChannel.guild.voiceAdapterCreator });
        voiceChannel.permissionOverwrites.edit(voiceChannel.guild.id, { Connect: false });
    }

    // 3. أذكار الصباح الكاملة
    cron.schedule('0 5 * * *', () => sendEmbed('🌅 أذكار الصباح', 
        '• آية الكرسي\n• سورة الإخلاص، والفلق، والناس (ثلاث مرات)\n• اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك النشور\n• أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير\n• اللهم ما أصبح بي من نعمة أو بأحد من خلقك فمنك وحدك لا شريك لك، فلك الحمد ولك الشكر\n• رضيت بالله رباً، وبالإسلام ديناً، وبمحمد صلى الله عليه وسلم نبياً (ثلاث مرات)\n• سبحان الله وبحمده عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته (ثلاث مرات)', 0x2a4660));

    // 4. أذكار المساء الكاملة
    cron.schedule('0 17 * * *', () => sendEmbed('🌆 أذكار المساء', 
        '• آية الكرسي\n• سورة الإخلاص، والفلق، والناس (ثلاث مرات)\n• أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير\n• اللهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك المصير\n• اللهم ما أمسى بي من نعمة أو بأحد من خلقك فمنك وحدك لا شريك لك، فلك الحمد ولك الشكر\n• بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم (ثلاث مرات)\n• أعوذ بكلمات الله التامات من شر ما خلق (ثلاث مرات)', 0x2a4660));

    cron.schedule('0 1 * * *', updatePrayerTimes);
});

// 5. نظام الأوامر (!اذكار)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith('!اذكار')) {
        if (!message.member.roles.cache.has(CONFIG.ROLE_ID)) return message.reply("عذراً، ليس لديك الرتبة المطلوبة.");
        const text = message.content.replace('!اذكار', '').trim();
        if (text) { sendEmbed('✨ ذكر من العضو', text, 0x2a4660); }
    }
});

// دالة موحدة للإرسال
function sendEmbed(title, description, color) {
    client.channels.cache.get(CONFIG.CHANNEL_ID)?.send({
        content: `<@&${CONFIG.ROLE_ID}>`,
        embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(color)]
    });
}

// 6. مواقيت الصلاة
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
