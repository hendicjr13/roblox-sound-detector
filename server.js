const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fungsi buat delay (mencegah Rate Limit / 429 Too Many Requests)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/detect-sounds', async (req, res) => {
    const cookie = process.env.ROBLOX_COOKIE;
    const { userId } = req.body;

    if (!cookie) {
        return res.status(500).json({ error: 'Server error: ROBLOX_COOKIE belum di-setting di Railway!' });
    }
    if (!userId) {
        return res.status(400).json({ error: 'User ID wajib diisi!' });
    }

    try {
        let allSounds = [];
        let cursor = '';
        let page = 1;

        console.log(`[INFO] Memulai scanning inventory untuk User ID: ${userId}`);

        // STEP 1: Ambil semua Asset ID dari Inventory API
        while (true) {
            console.log(`[INFO] Fetching halaman ${page}...`);
            
            let invUrl = `https://inventory.roblox.com/v2/users/${userId}/inventory/3?limit=100`;
            if (cursor) {
                invUrl += `&cursor=${cursor}`;
            }

            const invRes = await axios.get(invUrl, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
                }
            });

            // Ambil data dari inventory
            invRes.data.data.forEach(item => {
                allSounds.push({
                    assetId: item.assetId,
                    name: item.name || `Sound ${item.assetId}` // Fallback ke Asset ID kalau name undefined
                });
            });

            if (!invRes.data.nextPageCursor) {
                break;
            }

            cursor = invRes.data.nextPageCursor;
            page++;
            await sleep(800); 
        }

        console.log(`[SUCCESS] Selesai! Total ${allSounds.length} sound ditemukan.`);

        res.json({
            success: true,
            userId: userId,
            totalSounds: allSounds.length,
            sounds: allSounds
        });

    } catch (error) {
        console.error('[ERROR]', error.response?.data || error.message);
        
        if (error.response?.status === 401 || error.response?.status === 403) {
            return res.status(401).json({ error: 'Cookie ROBLOSECURITY invalid atau expired. Tolong update di Railway!' });
        }
        if (error.response?.status === 429) {
            return res.status(429).json({ error: 'Rate limit terdeteksi. Coba lagi beberapa saat.' });
        }

        res.status(500).json({ 
            error: 'Gagal fetch data.',
            details: error.response?.data?.errors || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
