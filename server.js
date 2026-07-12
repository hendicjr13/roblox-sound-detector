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

        // STEP 1: Ambil semua Asset ID dari Inventory
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

        console.log(`[INFO] Ditemukan ${allAssetIds.length} Asset ID. Testing Audio Delivery...`);

        // STEP 2: Cek Status Asli via Audio Delivery API
        let allSounds = [];
        
        for (let i = 0; i < allAssetIds.length; i++) {
            const assetId = allAssetIds[i];
            let status = "DELETED / COPYRIGHT"; // Default
            let soundName = "Unknown";
            let createdDate = null;

            try {
                // 1. Ambil Nama & Tanggal Upload Asli dari Economy API
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
                createdDate = detailsRes.data.Created || detailsRes.data.created || null;

                // 2. CEK STATUS ASLI: HTTP 200 = file audio dikirim (binary Ogg/JSON error),
                //    403/401 = kena moderasi/copyright, 404 = gak ketemu
                let deliveryRes;
                let attempt = 0;
                const maxAttempts = 3;

                while (attempt < maxAttempts) {
                    try {
                        deliveryRes = await axios.get(
                            `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`,
                            {
                                headers: {
                                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                                    'User-Agent': 'Roblox/WinInet'
                                },
                                timeout: 5000,
                                validateStatus: (s) => s < 500 // biar 400/403/404 gak throw
                            }
                        );
                        break; // sukses, keluar dari retry loop
                    } catch (retryErr) {
                        attempt++;
                        if (attempt >= maxAttempts) throw retryErr;
                        await sleep(800 * attempt); // backoff sebelum retry (biasanya 502 sementara)
                    }
                }

                if (deliveryRes.status === 200) {
                    // Roblox ngirim file audio langsung (binary Ogg) kalau asset available
                    status = "ACTIVE";
                } else if (deliveryRes.status === 403 || deliveryRes.status === 401) {
                    // Terbukti: 403/401 di endpoint ini konsisten sama asset yang kena moderasi/copyright
                    status = "DELETED / COPYRIGHT (moderated)";
                } else if (deliveryRes.status === 404) {
                    status = "DELETED / COPYRIGHT";
                } else {
                    // Status gak dikenali -> jangan asal cap COPYRIGHT
                    status = "UNKNOWN / ERROR";
                }

                console.log(`[DEBUG] Asset ${assetId} -> HTTP ${deliveryRes.status} -> ${status}`);

            } catch (err) {
                status = "UNKNOWN / ERROR";
                console.log(`[DEBUG] Asset ${assetId} -> request gagal setelah retry: ${err.message}`);
            }

            allSounds.push({
                assetId: assetId,
                name: soundName,
                status: status,
                created: createdDate
            });

            await sleep(500);

            if ((i + 1) % 10 === 0 || i === allAssetIds.length - 1) {
                console.log(`[INFO] Progress: ${i + 1}/${allAssetIds.length} | ID: ${assetId} | Status: ${status}`);
            }
        }

        console.log(`[SUCCESS] Total ${allSounds.length} sounds processed.`);

        // Urutin dari yang paling baru di-upload ke paling lama.
        // Pakai tanggal "Created" asli kalau ada, fallback ke Asset ID (lebih besar = lebih baru)
        // kalau tanggalnya gak kebaca dari API.
        allSounds.sort((a, b) => {
            if (a.created && b.created) {
                return new Date(b.created) - new Date(a.created);
            }
            return Number(b.assetId) - Number(a.assetId);
        });

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
