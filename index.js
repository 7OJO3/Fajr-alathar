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

// قائمة الأذكار المحدثة بدون إيموجيات
const adhkarList = [
    "اللهم بك نحيا وبك نموت واليك النشور",
    "اصبحنا واصبح الملك لله والحمدلله ولا اله الا الله وحده لا شريك له له الملك وله الحمد وهو على كل شي قدير. ربِّ أسألك خير ما في هذا اليوم وخير ما بعده، وأعوذ بك من شر ما في هذا اليوم وشر ما بعده. ربِّ أعوذ بك من الكسل وسوء الكِبَر، ربِّ أعوذ بك من عذاب في النار وعذاب في القبر",
    "بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم (٣ مرات)",
    "اللهم إني أصبحت أشهدك، وأشهد حملة عرشك، وملائكتك، وجميع خلقك، أنك أنت الله، لا إله إلا أنت، وحدك لا شريك لك، وأن محمداً عبدك ورسولك (٤ مرات)",
    "اللهم من أرادني بسوء، فأشغله في نفسه، ورد كيده في نحره، واجعل تدبيره تدميره، اللهم إني فوضت أمري إليك، فاكفنيهم بما شئت",
    "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم (٧ مرات)",
    "رضيت بالله ربا وبالإسلام دينا وبمحمد ﷺ نبياً (٣ مرات)",
    "يا حيُّ يا قيُّوم، برحمتك أستغيث، أصلح لي شأني كلَّه، ولا تكلني إلى نفسي طرفة عين",
    "اللهم إني أسألك علما نافعا، ورزقا طيبا، وعملا متقبلا وشفاءً من كل داء",
    "اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت. اللهم إني أعوذ بك من الكفر والفقر، وأعوذ بك من عذاب القبر، لا إله إلا أنت (٣ مرات)",
    "أعوذ بكلمات الله التامات من شر ما خلق (٣ مرات)",
    "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير (١٠ مرات)"
];

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
        // تم تغيير المصدر إلى صيد الفوائد لقوة استقرار الرابط
        const { data } = await axios.get('https://saaid.net/wahiaat/index.php', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        const stories = [];
        
        // جلب عناوين القصص والفوائد من الموقع الجديد
        $('a').each((i, el) => {
            const title = $(el).text().trim();
            const href = $(el).attr('href');
            if (title.length > 20 && href && href.includes('wahiaat')) {
                stories.push({ title: title, link: 'https://saaid.net/wahiaat/' + href });
            }
        });

        let history = [];
        if (fs.existsSync(CONFIG.HISTORY_FILE)) {
            try { history = JSON.parse(fs.readFileSync(CONFIG.HISTORY_FILE, 'utf8')); } catch (e) { history = []; }
        }
        
        const newStory = stories.find(s => !history.includes(s.title));

        if (newStory) {
            sendEmbed(`📖 ${newStory.title}`, `لقراءة القصة كاملة: ${newStory.link}`, 0x2a4660);
            history.push(newStory.title);
            fs.writeFileSync(CONFIG.HISTORY_FILE, JSON.stringify(history));
        }
    } catch (e) { console.error("خطأ في جلب القصة:", e); }
}

function sendDhikr() {
    sendEmbed("ذكر", adhkarList[Math.floor(Math.random() * adhkarList.length)], 0x2a4660);
}

client.once('ready', async () => {
    await updatePrayerTimes();
    console.log("البوت متصل ويعمل!");

    sendDhikr();
    sendNewStory();

    client.user.setActivity('قصص دينية وعبر', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/monstercat' });

    const voiceChannel = client.channels.cache.get(CONFIG.VOICE_CHANNEL_ID);
    if (voiceChannel) {
        joinVoiceChannel({ channelId: voiceChannel.id, guildId: CONFIG.GUILD_ID, adapterCreator: voiceChannel.guild.voiceAdapterCreator });
        voiceChannel.permissionOverwrites.edit(voiceChannel.guild.id, { Connect: false });
    }

    cron.schedule('0 * * * *', sendDhikr);
    cron.schedule('*/30 * * * *', sendNewStory);
    cron.schedule('0 1 * * *', updatePrayerTimes);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith('!اذكار')) {
        if (!message.member.roles.cache.has(CONFIG.ROLE_ID)) return message.reply("عذراً، ليس لديك الرتبة المطلوبة.");
        const text = message.content.replace('!اذكار', '').trim();
        if (text) { sendEmbed('ذكر من العضو', text, 0x2a4660); }
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
                    embeds: [new EmbedBuilder().setTitle(`وقت أذان ${prayer} في ${city}`).setDescription("دعاء بين الأذان والإقامة لا يُرد.").setColor(0x2a4660)] 
                });
            }
        }
    }
});

client.login(process.env.TOKEN);
