const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fungsi buat delay
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
        let allAssetIds = [];
        let cursor = '';
        let page = 1;

        console.log(`[INFO] Memulai scanning inventory untuk User ID: ${userId}`);

        // ==========================================
        // STEP 1: Ambil semua Asset ID dari Inventory
        // ==========================================
        while (true) {
            console.log(`[INFO] Fetching halaman ${page}...`);
            
            let invUrl = `https://inventory.roblox.com/v2/users/${userId}/inventory/3?limit=100`;
            if (cursor) {
                invUrl += `&cursor=${cursor}`;
            }

            const invRes = await axios.get(invUrl, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const assetIds = invRes.data.data.map(item => item.assetId);
            allAssetIds.push(...assetIds);

            if (!invRes.data.nextPageCursor) break;
            cursor = invRes.data.nextPageCursor;
            page++;
            await sleep(600); 
        }

        console.log(`[INFO] Ditemukan ${allAssetIds.length} Asset ID. Sekarang fetching nama asli dari Economy API...`);

        // ==========================================
        // STEP 2: Fetch Nama Asli dari Economy API
        // ==========================================
        let allSounds = [];
        
        for (let i = 0; i < allAssetIds.length; i++) {
            const assetId = allAssetIds[i];
            
            try {
                // Endpoint Economy API buat dapetin detail asset (termasuk Nama)
                const detailsRes = await axios.get(
                    `https://economy.roblox.com/v2/assets/${assetId}/details`,
                    {
                        headers: {
                            'Cookie': `.ROBLOSECURITY=${cookie}`,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                );

                // Economy API ngasih nama di field 'Name' (huruf besar) atau 'name'
                const soundName = detailsRes.data.Name || detailsRes.data.name || "Unknown Sound";

                allSounds.push({
                    assetId: assetId,
                    name: soundName
                });

                // Delay 300ms per request (Cukup cepat tapi aman dari rate limit)
                await sleep(300);

                // Log progress setiap 10 asset
                if ((i + 1) % 10 === 0 || i === allAssetIds.length - 1) {
                    console.log(`[INFO] Progress: ${i + 1}/${allAssetIds.length} asset diproses`);
                }

            } catch (err) {
                // Kalau asset di-deleted atau error, kasih nama Unknown
                console.warn(`[WARN] Gagal fetch detail untuk ID ${assetId}`);
                allSounds.push({ 
                    assetId: assetId, 
                    name: "Unknown / Deleted" 
                });
                await sleep(300);
            }
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
            return res.status(401).json({ error: 'Cookie ROBLOSECURITY invalid atau expired.' });
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
