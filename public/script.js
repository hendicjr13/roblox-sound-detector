let currentSoundsData = [];

async function detectSounds() {
    const userId = document.getElementById('userIdInput').value.trim();
    const btn = document.getElementById('detectBtn');
    const status = document.getElementById('status');
    const resultArea = document.getElementById('resultArea');

    if (!userId) {
        alert('User ID gak boleh kosong bro!');
        return;
    }

    // UI Loading State
    btn.disabled = true;
    btn.innerText = 'Scanning...';
    status.innerText = '⏳ Sedang scanning inventory... Ini bisa memakan waktu tergantung jumlah sound. Jangan refresh halaman!';
    status.classList.remove('hidden');
    status.className = 'text-center text-yellow-400 mb-4'; // Reset class ke kuning
    resultArea.classList.add('hidden');

    try {
        const response = await fetch('/api/detect-sounds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Terjadi kesalahan pada server');
        }

        // Success
        currentSoundsData = data.sounds;
        document.getElementById('totalSounds').innerText = data.totalSounds;
        
        const tbody = document.getElementById('soundTableBody');
        tbody.innerHTML = ''; // Clear old data

        data.sounds.forEach(sound => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-800';
            row.innerHTML = `
                <td class="px-4 py-2 font-mono text-blue-300">${sound.assetId}</td>
                <td class="px-4 py-2 text-gray-300">${sound.name}</td>
            `;
            tbody.appendChild(row);
        });

        status.innerText = `✅ Selesai! Berhasil menemukan ${data.totalSounds} sound.`;
        status.className = 'text-center text-green-400 mb-4';
        resultArea.classList.remove('hidden');

    } catch (error) {
        status.innerText = `❌ Error: ${error.message}`;
        status.className = 'text-center text-red-400 mb-4';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Detect';
    }
}

function copyAllIds() {
    if (currentSoundsData.length === 0) return;
    
    // ✅ FIX: Pastikan pakai backslash-n (\n) buat newline, bukan huruf n biasa
    const ids = currentSoundsData.map(s => s.assetId).join('\n');
    
    navigator.clipboard.writeText(ids).then(() => {
        alert('Semua Asset ID berhasil di-copy ke clipboard!');
    }).catch(err => {
        console.error('Gagal copy:', err);
        alert('Gagal copy, coba manual.');
    });
}

function downloadCsv() {
    if (currentSoundsData.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Asset ID,Name\n"; // Header (pakai \n)

    currentSoundsData.forEach(row => {
        // Escape double quote di nama file biar CSV gak rusak
        const safeName = row.name.replace(/"/g, '""'); 
        csvContent += `${row.assetId},"${safeName}"\n`; // Pakai \n
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "roblox_sounds.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
