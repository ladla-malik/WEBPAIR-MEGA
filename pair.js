import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser } from '@whiskeysockets/baileys';
import { upload } from './mega.js';

const router = express.Router();

// Ensure the session directory exists
function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    let dirs = './' + (num || `session`);
    
    // Remove existing session if present
    await removeFile(dirs);
    
    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            let GlobalTechInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            if (!GlobalTechInc.authState.creds.registered) {
                await delay(2000);
                num = num.replace(/[^0-9]/g, '');
                const code = await GlobalTechInc.requestPairingCode(num);
                if (!res.headersSent) {
                    console.log({ num, code });
                    await res.send({ code });
                }
            }

            GlobalTechInc.ev.on('creds.update', saveCreds);
            GlobalTechInc.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(10000);
                    const sessionGlobal = fs.readFileSync(dirs + '/creds.json');

                    // Helper to generate a random Mega file ID
                    function generateRandomId(length = 6, numberLength = 4) {
                        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                        let result = '';
                        for (let i = 0; i < length; i++) {
                            result += characters.charAt(Math.floor(Math.random() * characters.length));
                        }
                        const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                        return `${result}${number}`;
                    }

                    // Upload session file to Mega
                    const megaUrl = await upload(fs.createReadStream(`${dirs}/creds.json`), `${generateRandomId()}.json`);
                    let stringSession = megaUrl.replace('https://mega.nz/file/', ''); // Extract session ID from URL
                    stringSession = 'SILENT-SOBX-MD~' + stringSession;  // Prepend your name to the session ID

                    // Send the session ID to the target number
                    const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                    await GlobalTechInc.sendMessage(userJid, { text: stringSession });

                    // Send confirmation message
                    await GlobalTechInc.sendMessage(userJid, { text: '┏━━━━━━━━━━━━━━ \n┃𝐒𝐇𝐄𝐈𝐊𝐇-𝐀𝐋𝐈-𝐌𝐃 𝐒𝐄𝐒𝐒𝐈𝐎𝐍 𝐈𝐒\n┃𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋𝐋𝐘\n┃𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 ✅🔥\n┗━━━━━━━━━━━━━━━\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n1️⃣ || ᴄʀᴇᴀᴛᴏʀ = 𖥘⚡ 𝐀𝐋 𝐀𝐇𝐌𝐀𝐃•••²⁴⁰⁶ ⚡𖥘\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n2️⃣ || ᴏᴡɴᴇʀ = https://wa.me/923143702270\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n3️⃣ || ʀᴇᴘᴏ = https://github.com/Sheikh-ali-2412/SHEIKH-ALI-MD\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n4️⃣ || ᴡʜᴀᴛsᴀᴘᴘ ᴄʜᴀɴɴᴇʟ = https://whatsapp.com/channel/0029Vao1lnR1nozDF8jBNh3B\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n5️⃣ || ʏᴏᴜᴛᴜʙᴇ ᴄʜᴀɴɴᴇʟ = https://youtube.com/@sheikh-ali-2412?si=0WslRm5BX7pUymxX\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𓄂𝕚𝕥𝕩.𝑺𝑯𝑬𝑰𝑲𝑯 𝑨𝑳𝑰 🔥༽༼ ♡ \n' });

                    // Clean up session after use
                    await delay(100);
                    removeFile(dirs);
                    process.exit(0);
                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    console.log('Connection closed unexpectedly:', lastDisconnect.error);
                    await delay(10000);
                    initiateSession(); // Retry session initiation if needed
                }
            });
        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service Unavailable' });
            }
        }
    }

    await initiateSession();
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
    console.log('Caught exception: ' + err);
});

export default router;
