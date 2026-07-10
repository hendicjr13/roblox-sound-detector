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
        let allAssetIds = [];
        let cursor = '';
        let page = 1;

        console.log(`[INFO] Memulai scanning inventory untuk User ID: ${userId}`);

        // STEP 1: Ambil semua Asset ID dulu dari Inventory API
        while (true) {
            console.log(`[INFO] Fetching halaman ${page}...`);
            
            // ✅ FIX: Bikin URL dinamis. Kalau cursor kosong (request pertama), jangan tempel parameter cursor.
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

            // Ambil assetId doang dari response
            const assetIds = invRes.data.data.map(item => item.assetId);
            allAssetIds.push(...assetIds);

            // Cek apakah masih ada halaman selanjutnya
            if (!invRes.data.nextPageCursor) {
                break; // Berhenti kalau cursor habis
            }

            cursor = invRes.data.nextPageCursor;
            page++;

            // DELAY WAJIB! 800ms biar aman dari banned IP Railway
            await sleep(800); 
        }

        console.log(`[INFO] Ditemukan ${allAssetIds.length} Asset ID. Sekarang fetching detail nama dari Catalog API...`);

        // STEP 2: Fetch detail nama dari Catalog API
        let allSounds = [];
        
        // Roblox Catalog API cuma bisa handle sekitar 10-20 asset per request
        // Kita proses dalam batch kecil
        for (let i = 0; i < allAssetIds.length; i += 10) {
            const batchIds = allAssetIds.slice(i, i + 10);
            
            try {
                console.log(`[INFO] Fetching batch ${Math.floor(i/10) + 1} dari ${Math.ceil(allAssetIds.length/10)}...`);
                
                const catalogRes = await axios.get(
                    `https://catalog.roblox.com/v1/assets?assetIds=${batchIds.join(',')}`,
                    {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
                        }
                    }
                );

                const catalogData = catalogRes.data.data || [];
                
                // Mapping hasil catalog ke format yang kita mau
                catalogData.forEach(asset => {
                    allSounds.push({
                        assetId: asset.id,
                        name: asset.name || "Unknown Sound"
                    });
                });

                // Delay biar gak kena rate limit Catalog API
                await sleep(500);
                
                console.log(`[INFO] Progress: ${Math.min(i + 10, allAssetIds.length)}/${allAssetIds.length} asset diproses`);
                
            } catch (err) {
                console.error(`[ERROR] Gagal fetch batch ${Math.floor(i/10) + 1}:`, err.message);
                
                // Kalau gagal fetch, tetap masukin dengan nama "Unknown"
                batchIds.forEach(id => {
                    allSounds.push({ 
                        assetId: id, 
                        name: "Unknown (Fetch Failed)" 
                    });
                });
                
                // Tetap delay walaupun error
                await sleep(500);
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
        
        // Handle error spesifik
        if (error.response?.status === 401 || error.response?.status === 403) {
            return res.status(401).json({ error: 'Cookie ROBLOSECURITY invalid atau expired. Tolong update di Railway!' });
        }
        if (error.response?.status === 429) {
            return res.status(429).json({ error: 'Rate limit terdeteksi. Coba lagi beberapa saat.' });
        }

        res.status(500).json({ 
            error: 'Gagal fetch data. Pastikan User ID benar dan akun tidak di-private.',
            details: error.response?.data?.errors || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
