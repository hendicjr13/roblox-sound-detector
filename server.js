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

        console.log(`[INFO] Memulai scanning inventory untuk User ID: ${userId}`);

        // STEP 1: Ambil semua Asset ID dari Inventory
        while (true) {
            console.log(`[INFO] Fetching halaman ${page}...`);
            
            let invUrl = `https://inventory.roblox.com/v2/users/${userId}/inventory/3?limit=100`;
            if (cursor) invUrl += `&cursor=${cursor}`;

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

        console.log(`[INFO] Ditemukan ${allAssetIds.length} Asset ID. Mengecek status masing-masing...`);

        // STEP 2: Cek Status (Aktif vs Deleted/Copyright)
        let allSounds = [];
        
        for (let i = 0; i < allAssetIds.length; i++) {
            const assetId = allAssetIds[i];
            let status = "ACTIVE";
            let soundName = "Unknown";

            try {
                // Cek detail asset di Economy API
                const detailsRes = await axios.get(
                    `https://economy.roblox.com/v2/assets/${assetId}/details`,
                    {
                        headers: {
                            'Cookie': `.ROBLOSECURITY=${cookie}`,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        timeout: 5000
                    }
                );

                soundName = detailsRes.data.Name || detailsRes.data.name || "Unknown";

                // Logic Status:
                // Jika IsPublic = false, berarti asset dihapus/di-private/dikenai copyright oleh Roblox
                if (detailsRes.data.IsPublic === false) {
                    status = "DELETED / COPYRIGHT";
                }

            } catch (err) {
                // Jika API nolak (404/403), berarti asset udah ilang total dari database
                if (err.response?.status === 404 || err.response?.status === 403) {
                    status = "DELETED / COPYRIGHT";
                    soundName = "Unknown / Deleted";
                } else {
                    status = "ERROR";
                    soundName = "Fetch Error";
                }
            }

            allSounds.push({
                assetId: assetId,
                name: soundName,
                status: status
            });

            await sleep(300);

            if ((i + 1) % 10 === 0 || i === allAssetIds.length - 1) {
                console.log(`[INFO] Progress: ${i + 1}/${allAssetIds.length}`);
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
        res.status(500).json({ 
            error: 'Gagal fetch data.',
            details: error.response?.data?.errors || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
