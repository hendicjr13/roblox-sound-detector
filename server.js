const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/detect-sounds', async (req, res) => {
    const cookie = process.env.ROBLOX_COOKIE;
    const { userId } = req.body;

    if (!cookie) {
        return res.status(500).json({ error: 'Server error: ROBLOX_COOKIE belum di-setting!' });
    }
    if (!userId) {
        return res.status(400).json({ error: 'User ID wajib diisi!' });
    }

    try {
        let allAssetIds = [];
        let cursor = '';
        let page = 1;

        console.log(`[INFO] Scanning inventory User ID: ${userId}`);

        // STEP 1: Ambil semua Asset ID
        while (true) {
            let invUrl = `https://inventory.roblox.com/v2/users/${userId}/inventory/3?limit=100`;
            if (cursor) invUrl += `&cursor=${cursor}`;

            const invRes = await axios.get(invUrl, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            const assetIds = invRes.data.data.map(item => item.assetId);
            allAssetIds.push(...assetIds);

            if (!invRes.data.nextPageCursor) break;
            cursor = invRes.data.nextPageCursor;
            page++;
            await sleep(600);
        }

        console.log(`[INFO] Ditemukan ${allAssetIds.length} Asset ID. Testing playability...`);

        // STEP 2: Test apakah audio bisa diputer (bukan cuma cek database)
        let allSounds = [];
        
        for (let i = 0; i < allAssetIds.length; i++) {
            const assetId = allAssetIds[i];
            let status = "ACTIVE";
            let soundName = "Unknown";

            try {
                // 1. Cek detail asset
                const detailsRes = await axios.get(
                    `https://economy.roblox.com/v2/assets/${assetId}/details`,
                    {
                        headers: {
                            'Cookie': `.ROBLOSECURITY=${cookie}`,
                            'User-Agent': 'Mozilla/5.0'
                        },
                        timeout: 5000
                    }
                );

                soundName = detailsRes.data.Name || detailsRes.data.name || "Unknown";

                // 2. Coba akses audio file langsung (ini yang detect copyright block)
                try {
                    const audioRes = await axios.get(
                        `https://www.roblox.com/library/${assetId}`,
                        {
                            headers: {
                                'Cookie': `.ROBLOSECURITY=${cookie}`,
                                'User-Agent': 'Mozilla/5.0'
                            },
                            timeout: 5000,
                            maxRedirects: 0,
                            validateStatus: () => true // Terima semua status code
                        }
                    );

                    // Kalau redirect ke error page atau ada kata "unavailable"
                    if (audioRes.status !== 200 || 
                        audioRes.data?.includes('unavailable') ||
                        audioRes.data?.includes('This item is no longer available')) {
                        status = "DELETED / COPYRIGHT";
                    }

                } catch (audioErr) {
                    // Kalau gagal akses library page = pasti blocked/deleted
                    status = "DELETED / COPYRIGHT";
                }

                // 3. Fallback: kalau IsPublic = false, pasti deleted
                if (detailsRes.data.IsPublic === false) {
                    status = "DELETED / COPYRIGHT";
                }

            } catch (err) {
                // Kalau Economy API error 404/403 = deleted
                if (err.response?.status === 404 || err.response?.status === 403) {
                    status = "DELETED / COPYRIGHT";
                    soundName = "Unknown / Deleted";
                }
            }

            allSounds.push({
                assetId: assetId,
                name: soundName,
                status: status
            });

            await sleep(400); // Sedikit lebih lambat buat test library access

            if ((i + 1) % 10 === 0 || i === allAssetIds.length - 1) {
                console.log(`[INFO] Progress: ${i + 1}/${allAssetIds.length}`);
            }
        }

        console.log(`[SUCCESS] Total ${allSounds.length} sounds`);

        res.json({
            success: true,
            userId: userId,
            totalSounds: allSounds.length,
            sounds: allSounds
        });

    } catch (error) {
        console.error('[ERROR]', error.message);
        res.status(500).json({ error: 'Gagal fetch data', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
